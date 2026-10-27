import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthRepositorio,
  MotivoDoFim,
  NovaSessao,
  NovoUsuario,
  SessaoGravada,
  Usuario,
  UsuarioComSenha,
} from "../portas/auth-repositorio.js";
import { CredenciaisInvalidas, EmailEmUso, TentativasEsgotadas } from "../dominio/erros.js";
import { PedidoInvalido } from "../../grupos/dominio/erros.js";
import { AuthService, DURACAO_DA_SESSAO_MS, TENANT_LEGADO, hashDoToken } from "./auth.service.js";

class Memoria implements AuthRepositorio {
  usuarios = new Map<string, UsuarioComSenha & { falhas: number }>();
  sessoes = new Map<string, SessaoGravada & { userId: string }>();
  novos: NovoUsuario[] = [];
  fins: string[] = [];

  async criarUsuario(novo: NovoUsuario) {
    if ([...this.usuarios.values()].some((item) => item.email === novo.email)) return "email-em-uso" as const;
    this.novos.push(novo);
    const tenantId = novo.tenantPreferido ?? `tenant-${novo.id}`;
    const usuario: Usuario = { id: novo.id, tenantId, email: novo.email, name: novo.name };
    this.usuarios.set(novo.id, { ...usuario, passwordHash: novo.passwordHash, lockedUntil: null, falhas: 0 });
    return usuario;
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
  async buscarSessao(id: string) {
    return this.sessoes.get(id) ?? null;
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
