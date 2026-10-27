import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthRepositorio,
  MotivoDoFim,
  NovaSessao,
  NovoMembro,
  NovoUsuario,
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
});
