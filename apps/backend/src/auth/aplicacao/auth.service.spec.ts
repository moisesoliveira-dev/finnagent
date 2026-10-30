import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DadosDoPerfil } from "@finnagent/contracts";
import type {
  AuthRepositorio,
  MotivoDoFim,
  NovaSessao,
  NovoMembro,
  NovoUsuario,
  PerfilGravado,
  SessaoDeAcessoGravada,
  SessaoGravada,
  Usuario,
  UsuarioComSenha,
} from "../portas/auth-repositorio.js";
import {
  CredenciaisInvalidas,
  EmailEmUso,
  MasterIntocavel,
  NaoAutenticado,
  TentativasEsgotadas,
} from "../dominio/erros.js";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import { AuthService, DURACAO_DA_SESSAO_MS, TENANT_LEGADO, USUARIO_SEM_LOGIN, hashDoToken } from "./auth.service.js";

class Memoria implements AuthRepositorio {
  usuarios = new Map<string, UsuarioComSenha & { falhas: number }>();
  sessoes = new Map<string, NovaSessao>();
  novos: NovoUsuario[] = [];
  fins: string[] = [];

  async criarUsuario(novo: NovoUsuario) {
    if ([...this.usuarios.values()].some((item) => item.email === novo.email)) return "email-em-uso" as const;
    this.novos.push(novo);
    const tenantId = novo.tenantPreferido ?? `tenant-${novo.id}`;
    const usuario: Usuario = { id: novo.id, tenantId, email: novo.email, name: novo.name, role: "master" };
    this.usuarios.set(novo.id, { ...usuario, passwordHash: novo.passwordHash, lockedUntil: null, falhas: 0 });
    return usuario;
  }
  async criarMembro(tenantId: string, novo: NovoMembro) {
    if ([...this.usuarios.values()].some((item) => item.email === novo.email)) return "email-em-uso" as const;
    const usuario: Usuario = { id: novo.id, tenantId, email: novo.email, name: novo.name, role: "membro" };
    this.usuarios.set(novo.id, { ...usuario, passwordHash: novo.passwordHash, lockedUntil: null, falhas: 0 });
    return usuario;
  }
  async listarTenants() {
    return [...new Set([...this.usuarios.values()].map((item) => item.tenantId))];
  }
  async listarDoTenant(tenantId: string) {
    return [...this.usuarios.values()].filter((item) => item.tenantId === tenantId);
  }
  async removerMembro(tenantId: string, id: string) {
    const alvo = this.usuarios.get(id);
    if (!alvo || alvo.tenantId !== tenantId) return "ausente" as const;
    if (alvo.role === "master") return "master" as const;
    this.usuarios.delete(id);
    for (const [chave, sessao] of this.sessoes) if (sessao.userId === id) this.sessoes.delete(chave);
    return "removido" as const;
  }
  async buscarPorEmail(email: string) {
    return [...this.usuarios.values()].find((item) => item.email === email) ?? null;
  }
  async buscarUsuario(id: string) {
    return this.usuarios.get(id) ?? null;
  }
  async registrarFalha(id: string, limite: number, bloqueioMs: number, agora: Date) {
    const usuario = this.usuarios.get(id);
    if (!usuario) return;
    usuario.falhas += 1;
    if (usuario.falhas >= limite) {
      usuario.falhas = 0;
      usuario.lockedUntil = new Date(agora.getTime() + bloqueioMs);
    }
  }
  async zerarFalhas(id: string) {
    const usuario = this.usuarios.get(id);
    if (usuario) {
      usuario.falhas = 0;
      usuario.lockedUntil = null;
    }
  }
  async criarSessao(sessao: NovaSessao) {
    this.sessoes.set(sessao.id, sessao);
  }
  async buscarSessao(id: string): Promise<SessaoGravada | null> {
    const sessao = this.sessoes.get(id);
    if (!sessao) return null;
    const dono = this.usuarios.get(sessao.userId);
    return { tenantId: sessao.tenantId, userId: sessao.userId, role: dono?.role ?? "membro", expiresAt: sessao.expiresAt };
  }
  async removerSessao(id: string, motivo: MotivoDoFim) {
    this.sessoes.delete(id);
    this.fins.push(motivo);
  }
  perfis = new Map<string, DadosDoPerfil>();
  async buscarComSenha(id: string) {
    return this.usuarios.get(id) ?? null;
  }
  async buscarPerfil(id: string): Promise<PerfilGravado | null> {
    const usuario = this.usuarios.get(id);
    if (!usuario) return null;
    const perfil = this.perfis.get(id);
    return {
      id: usuario.id,
      tenantId: usuario.tenantId,
      email: usuario.email,
      role: usuario.role,
      name: perfil?.name ?? usuario.name,
      headline: perfil?.headline ?? "",
      location: perfil?.location ?? "",
      bio: perfil?.bio ?? "",
      avatarTone: perfil?.avatarTone ?? "brand",
      createdAt: new Date("2026-10-01T00:00:00Z"),
    };
  }
  async atualizarPerfil(id: string, dados: DadosDoPerfil) {
    const usuario = this.usuarios.get(id);
    if (!usuario) return "ausente" as const;
    usuario.name = dados.name;
    this.perfis.set(id, dados);
    return (await this.buscarPerfil(id)) as PerfilGravado;
  }
  async trocarSenha(id: string, passwordHash: string, manterSessao: string) {
    const usuario = this.usuarios.get(id);
    if (!usuario) return "ausente" as const;
    usuario.passwordHash = passwordHash;
    return this.encerrarOutras(id, manterSessao);
  }
  async listarSessoes(userId: string, agora: Date): Promise<SessaoDeAcessoGravada[]> {
    return [...this.sessoes.values()]
      .filter((sessao) => sessao.userId === userId && sessao.expiresAt > agora)
      .map((sessao) => ({
        id: sessao.id,
        userAgent: sessao.userAgent,
        createdAt: new Date("2026-10-27T12:00:00Z"),
        expiresAt: sessao.expiresAt,
      }));
  }
  async encerrarOutras(userId: string, manterSessao: string) {
    let encerradas = 0;
    for (const [chave, sessao] of this.sessoes) {
      if (sessao.userId === userId && chave !== manterSessao) {
        this.sessoes.delete(chave);
        encerradas += 1;
      }
    }
    return encerradas;
  }
}

const origem = { ip: "10.0.0.1", userAgent: "teste" };
const cadastro = { name: "Ana", email: "ana@exemplo.com", password: "cavalo-bateria-2026" };

describe("autenticação", () => {
  let repositorio: Memoria;
  let servico: AuthService;

  beforeEach(() => {
    delete process.env.AUTH_EMAIL_DONO;
    repositorio = new Memoria();
    servico = new AuthService(repositorio);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("só devolve o usuário sem login em desenvolvimento", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "");
    expect(await servico.eu(USUARIO_SEM_LOGIN)).toMatchObject({ id: USUARIO_SEM_LOGIN, semLogin: true });
    vi.stubEnv("APP_ENV", "");
    await expect(servico.eu(USUARIO_SEM_LOGIN)).rejects.toBeInstanceOf(NaoAutenticado);
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "production");
    await expect(servico.eu(USUARIO_SEM_LOGIN)).rejects.toBeInstanceOf(NaoAutenticado);
  });

  it("cadastra, guarda só o hash do token e abre a sessão", async () => {
    const aberta = await servico.cadastrar(cadastro, origem);
    expect(aberta.user).toMatchObject({ name: "Ana", email: "ana@exemplo.com" });
    expect(repositorio.sessoes.has(aberta.token)).toBe(false);
    expect(repositorio.sessoes.has(hashDoToken(aberta.token))).toBe(true);
    expect(repositorio.novos[0].passwordHash).not.toContain(cadastro.password);
    const resolvida = await servico.resolver(aberta.token);
    expect(resolvida?.userId).toBe(aberta.user.id);
  });

  it("quem se cadastra vira o master de uma conta nova, cada um na sua", async () => {
    const ana = await servico.cadastrar(cadastro, origem);
    const bia = await servico.cadastrar({ ...cadastro, name: "Bia", email: "bia@exemplo.com" }, origem);
    expect(ana.user.role).toBe("master");
    expect(bia.user.role).toBe("master");
    const [a, b] = [...repositorio.usuarios.values()];
    expect(a.tenantId).not.toBe(b.tenantId);
  });

  it("o master cria membros na própria conta, e o membro entra vendo a mesma conta", async () => {
    const ana = await servico.cadastrar(cadastro, origem);
    const tenant = [...repositorio.usuarios.values()][0].tenantId;
    const membro = await servico.criarMembro(tenant, {
      name: "Caio",
      email: "caio@exemplo.com",
      password: "outra-senha-forte-1",
    });
    expect(membro.role).toBe("membro");
    const entrada = await servico.entrar({ email: "caio@exemplo.com", password: "outra-senha-forte-1" }, origem);
    expect(entrada.user.role).toBe("membro");
    expect(await servico.resolver(entrada.token)).toMatchObject({ tenantId: tenant, role: "membro" });
    expect((await servico.listarUsuarios(tenant)).map((item) => item.role).sort()).toEqual(["master", "membro"]);
    expect(ana.user.role).toBe("master");
  });

  it("não cria membro com e-mail já usado nem com senha fraca", async () => {
    await servico.cadastrar(cadastro, origem);
    const tenant = [...repositorio.usuarios.values()][0].tenantId;
    await expect(
      servico.criarMembro(tenant, { name: "Outra Ana", email: cadastro.email, password: "outra-senha-forte-1" }),
    ).rejects.toBeInstanceOf(EmailEmUso);
    await expect(
      servico.criarMembro(tenant, { name: "Caio", email: "caio@exemplo.com", password: "123" }),
    ).rejects.toBeInstanceOf(PedidoInvalido);
  });

  it("remove membro, que perde a sessão, mas nunca o master", async () => {
    const ana = await servico.cadastrar(cadastro, origem);
    const tenant = [...repositorio.usuarios.values()][0].tenantId;
    const membro = await servico.criarMembro(tenant, { name: "Caio", email: "caio@exemplo.com", password: "outra-senha-forte-1" });
    const sessaoDele = await servico.entrar({ email: "caio@exemplo.com", password: "outra-senha-forte-1" }, origem);
    await servico.removerUsuario(tenant, membro.id);
    expect(await servico.resolver(sessaoDele.token)).toBeNull();
    await expect(servico.removerUsuario(tenant, membro.id)).rejects.toBeInstanceOf(NaoEncontrado);
    await expect(servico.removerUsuario(tenant, ana.user.id)).rejects.toBeInstanceOf(MasterIntocavel);
  });

  it("não mexe em usuário de outra conta", async () => {
    await servico.cadastrar(cadastro, origem);
    const bia = await servico.cadastrar({ ...cadastro, name: "Bia", email: "bia@exemplo.com" }, origem);
    const tenantDeAna = [...repositorio.usuarios.values()][0].tenantId;
    await expect(servico.removerUsuario(tenantDeAna, bia.user.id)).rejects.toBeInstanceOf(NaoEncontrado);
    expect(await servico.listarUsuarios(tenantDeAna)).toHaveLength(1);
  });

  it("recusa e-mail repetido e pedido inválido", async () => {
    await servico.cadastrar(cadastro, origem);
    await expect(servico.cadastrar(cadastro, origem)).rejects.toBeInstanceOf(EmailEmUso);
    await expect(servico.cadastrar({ ...cadastro, password: "curta" }, origem)).rejects.toBeInstanceOf(PedidoInvalido);
  });

  it("só o dono declarado herda o tenant dos dados antigos", async () => {
    await servico.cadastrar({ ...cadastro, email: "outra@exemplo.com" }, origem);
    process.env.AUTH_EMAIL_DONO = "Ana@Exemplo.com";
    await servico.cadastrar(cadastro, origem);
    expect(repositorio.novos.map((item) => item.tenantPreferido)).toEqual([null, TENANT_LEGADO]);
  });

  it("entra com a senha certa", async () => {
    await servico.cadastrar(cadastro, origem);
    const aberta = await servico.entrar({ email: "ANA@exemplo.com", password: cadastro.password }, origem);
    expect(aberta.user.email).toBe("ana@exemplo.com");
  });

  it("responde igual para senha errada e para e-mail sem conta", async () => {
    await servico.cadastrar(cadastro, origem);
    const errada = await servico.entrar({ email: cadastro.email, password: "senha-errada-123" }, origem).catch((e) => e);
    const sem = await servico.entrar({ email: "ninguem@exemplo.com", password: "senha-errada-123" }, origem).catch((e) => e);
    expect(errada).toBeInstanceOf(CredenciaisInvalidas);
    expect(sem).toBeInstanceOf(CredenciaisInvalidas);
    expect(errada.message).toBe(sem.message);
  });

  it("trava a conta na quinta falha, mesmo com a senha certa depois", async () => {
    await servico.cadastrar(cadastro, origem);
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      await servico.entrar({ email: cadastro.email, password: "senha-errada-123" }, origem).catch(() => undefined);
    }
    const travado = await servico.entrar({ email: cadastro.email, password: cadastro.password }, origem).catch((e) => e);
    expect(travado).toBeInstanceOf(TentativasEsgotadas);
    expect(travado.segundos).toBeGreaterThan(14 * 60);
  });

  it("zera as falhas quando a pessoa acerta", async () => {
    await servico.cadastrar(cadastro, origem);
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      await servico.entrar({ email: cadastro.email, password: "senha-errada-123" }, origem).catch(() => undefined);
    }
    await servico.entrar({ email: cadastro.email, password: cadastro.password }, origem);
    await servico.entrar({ email: cadastro.email, password: "senha-errada-123" }, origem).catch(() => undefined);
    const [usuario] = [...repositorio.usuarios.values()];
    expect(usuario.falhas).toBe(1);
    expect(usuario.lockedUntil).toBeNull();
  });

  it("encerra a sessão no sair e depois do prazo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const aberta = await servico.cadastrar(cadastro, origem);
    vi.setSystemTime(new Date(Date.now() + DURACAO_DA_SESSAO_MS + 1000));
    expect(await servico.resolver(aberta.token)).toBeNull();
    expect(repositorio.sessoes.size).toBe(0);
    expect(repositorio.fins).toEqual(["expirada"]);

    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const outra = await servico.entrar({ email: cadastro.email, password: cadastro.password }, origem);
    await servico.sair(outra.token);
    expect(repositorio.fins).toEqual(["expirada", "sair"]);
    expect(await servico.resolver(outra.token)).toBeNull();
    expect(await servico.resolver("")).toBeNull();
    expect(await servico.resolver("token-inventado")).toBeNull();
  });

  it("segura uma origem que insiste", async () => {
    const insistente = { ip: "10.9.9.9", userAgent: "teste" };
    let barrado: unknown = null;
    for (let tentativa = 0; tentativa < 31; tentativa += 1) {
      barrado = await servico.entrar({ email: "x@exemplo.com", password: "y" }, insistente).catch((e) => e);
    }
    expect(barrado).toBeInstanceOf(TentativasEsgotadas);
  });

  describe("perfil", () => {
    const dados = { name: "Ana Souza", headline: "Analista", location: "Recife", bio: "Gosto de planilhas.", avatarTone: "event" };

    it("cada usuário tem o seu perfil, mesmo na mesma conta", async () => {
      const ana = await servico.cadastrar(cadastro, origem);
      const membro = await servico.criarMembro([...repositorio.usuarios.values()][0].tenantId, {
        name: "Caio",
        email: "caio@exemplo.com",
        password: "outra-senha-forte-7",
      });
      await servico.atualizarPerfil(ana.user.id, dados);
      expect(await servico.perfil(ana.user.id)).toMatchObject({ name: "Ana Souza", headline: "Analista", avatarTone: "event" });
      expect(await servico.perfil(membro.id)).toMatchObject({ name: "Caio", headline: "", avatarTone: "brand" });
    });

    it("recusa nome vazio e cor desconhecida sem gravar nada", async () => {
      const ana = await servico.cadastrar(cadastro, origem);
      await expect(servico.atualizarPerfil(ana.user.id, { ...dados, name: " " })).rejects.toBeInstanceOf(PedidoInvalido);
      await expect(servico.atualizarPerfil(ana.user.id, { ...dados, avatarTone: "rosa" })).rejects.toBeInstanceOf(
        PedidoInvalido,
      );
      expect(repositorio.perfis.size).toBe(0);
    });

    it("quem entrou sem login vê um perfil de leitura e não edita", async () => {
      vi.stubEnv("APP_ENV", "development");
      vi.stubEnv("RAILWAY_ENVIRONMENT", "");
      expect(await servico.perfil(USUARIO_SEM_LOGIN)).toMatchObject({ semLogin: true, createdAt: null });
      await expect(servico.atualizarPerfil(USUARIO_SEM_LOGIN, dados)).rejects.toBeInstanceOf(PedidoInvalido);
      expect(await servico.sessoes(USUARIO_SEM_LOGIN, "")).toEqual({ sessions: [] });
    });

    it("troca a senha, encerra as outras sessões e mantém a atual", async () => {
      const aberta = await servico.cadastrar(cadastro, origem);
      const outra = await servico.entrar({ email: cadastro.email, password: cadastro.password }, origem);
      const troca = await servico.trocarSenha(aberta.user.id, aberta.token, {
        currentPassword: cadastro.password,
        newPassword: "nova-senha-forte-88",
      });
      expect(troca).toEqual({ sessoesEncerradas: 1 });
      expect(await servico.resolver(aberta.token)).not.toBeNull();
      expect(await servico.resolver(outra.token)).toBeNull();
      await expect(
        servico.entrar({ email: cadastro.email, password: cadastro.password }, origem),
      ).rejects.toBeInstanceOf(CredenciaisInvalidas);
      await servico.entrar({ email: cadastro.email, password: "nova-senha-forte-88" }, origem);
    });

    it("recusa a troca com a senha atual errada, como pedido inválido", async () => {
      const aberta = await servico.cadastrar(cadastro, origem);
      const erro = await servico
        .trocarSenha(aberta.user.id, aberta.token, { currentPassword: "errada-1234", newPassword: "nova-senha-forte-88" })
        .catch((e) => e);
      expect(erro).toBeInstanceOf(PedidoInvalido);
      expect(erro.message).toBe("A senha atual está incorreta.");
      expect(await servico.resolver(aberta.token)).not.toBeNull();
    });

    it("segura quem tenta a senha atual em série", async () => {
      const aberta = await servico.cadastrar(cadastro, origem);
      let barrado: unknown = null;
      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        barrado = await servico
          .trocarSenha(aberta.user.id, aberta.token, { currentPassword: "errada-1234", newPassword: "nova-senha-forte-88" })
          .catch((e) => e);
      }
      expect(barrado).toBeInstanceOf(TentativasEsgotadas);
    });

    it("lista as sessões marcando a deste aparelho e encerra as outras", async () => {
      const aberta = await servico.cadastrar(cadastro, { ip: "10.0.0.1", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36" });
      await servico.entrar({ email: cadastro.email, password: cadastro.password }, { ip: "10.0.0.2", userAgent: "curl/8" });
      const { sessions } = await servico.sessoes(aberta.user.id, aberta.token);
      expect(sessions).toHaveLength(2);
      expect(sessions.filter((sessao) => sessao.current)).toHaveLength(1);
      expect(sessions.find((sessao) => sessao.current)?.device).toBe("Chrome em Windows");
      expect(await servico.encerrarOutras(aberta.user.id, aberta.token)).toEqual({ sessoesEncerradas: 1 });
      expect((await servico.sessoes(aberta.user.id, aberta.token)).sessions).toHaveLength(1);
    });
  });
});
