import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  loginDispensado,
  type PerfilDoUsuario,
  type SessaoAberta,
  type SessoesDoUsuario,
  type UsuarioDaConta,
} from "@finnagent/contracts";
import { dispositivoDe } from "../dominio/dispositivo.js";
import {
  CredenciaisInvalidas,
  EmailEmUso,
  MasterIntocavel,
  NaoAutenticado,
  TentativasEsgotadas,
} from "../dominio/erros.js";
import { Limitador } from "../dominio/limitador.js";
import { interpretarCadastro, interpretarEntrada } from "../dominio/pedido.js";
import { interpretarPerfil, interpretarTroca } from "../dominio/perfil.js";
import { conferirSenha, gerarHash, hashDeReferencia } from "../dominio/senha.js";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import {
  AUTH_REPOSITORIO,
  type AuthRepositorio,
  type PerfilGravado,
  type Usuario,
} from "../portas/auth-repositorio.js";

/** Tenant dos dados criados antes de existir login. */
export const TENANT_LEGADO = "00000000-0000-4000-8000-000000000001";

/** Identidade de quem entra sem login em desenvolvimento. Não existe na tabela de usuários. */
export const USUARIO_SEM_LOGIN = "sem-login";

export const DURACAO_DA_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const FALHAS_ATE_TRAVAR = 5;
const TRAVA_MS = 15 * 60 * 1000;

const TENTATIVAS_DE_SENHA = 5;
const JANELA_DE_SENHA_MS = 15 * 60 * 1000;

export type Origem = { ip: string; userAgent: string };

const PERFIL_SEM_LOGIN: PerfilDoUsuario = {
  id: USUARIO_SEM_LOGIN,
  name: "Desenvolvimento",
  email: "sem-login@local",
  role: "master",
  semLogin: true,
  headline: "Modo de desenvolvimento",
  location: "",
  bio: "Você entrou sem login. Cadastre uma conta para ter um perfil só seu.",
  avatarTone: "ink",
  createdAt: null,
};

function perfilDoUsuario(perfil: PerfilGravado): PerfilDoUsuario {
  return {
    id: perfil.id,
    name: perfil.name,
    email: perfil.email,
    role: perfil.role,
    headline: perfil.headline,
    location: perfil.location,
    bio: perfil.bio,
    avatarTone: perfil.avatarTone,
    createdAt: perfil.createdAt.toISOString(),
  };
}

export function hashDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  // Teto por origem, antes de qualquer consulta ao banco: segura quem tenta e-mails em série.
  private readonly porOrigem = new Limitador(30, 10 * 60 * 1000);
  // Quem já está logado também não testa senhas à vontade na troca de senha.
  private readonly porUsuario = new Limitador(TENTATIVAS_DE_SENHA, JANELA_DE_SENHA_MS);

  constructor(@Inject(AUTH_REPOSITORIO) private readonly repositorio: AuthRepositorio) {}

  async cadastrar(corpo: unknown, origem: Origem): Promise<SessaoAberta> {
    this.limitar(origem);
    const pedido = interpretarCadastro(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const dono = (process.env.AUTH_EMAIL_DONO ?? "").trim().toLowerCase();
    const criado = await this.repositorio.criarUsuario({
      id: randomUUID(),
      email: pedido.email,
      name: pedido.name,
      passwordHash: await gerarHash(pedido.password),
      // Só o dono declarado herda os dados de antes do login. Sem isso, quem chegasse primeiro levaria tudo.
      tenantPreferido: dono && dono === pedido.email ? TENANT_LEGADO : null,
    });
    if (criado === "email-em-uso") throw new EmailEmUso();
    return this.abrirSessao(criado, origem);
  }

  async entrar(corpo: unknown, origem: Origem): Promise<SessaoAberta> {
    this.limitar(origem);
    const pedido = interpretarEntrada(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const usuario = await this.repositorio.buscarPorEmail(pedido.email);
    const agora = new Date();
    if (usuario?.lockedUntil && usuario.lockedUntil > agora) {
      throw new TentativasEsgotadas((usuario.lockedUntil.getTime() - agora.getTime()) / 1000);
    }
    // Sem conta, confere contra um hash de referência: o tempo da resposta é o mesmo.
    const correta = await conferirSenha(pedido.password, usuario?.passwordHash ?? (await hashDeReferencia()));
    if (!usuario || !correta) {
      if (usuario) await this.repositorio.registrarFalha(usuario.id, FALHAS_ATE_TRAVAR, TRAVA_MS, agora);
      throw new CredenciaisInvalidas();
    }
    await this.repositorio.zerarFalhas(usuario.id);
    return this.abrirSessao(usuario, origem);
  }

  async sair(token: string) {
    await this.repositorio.removerSessao(hashDoToken(token), "sair");
  }

  /** Troca o token do cookie pelo usuário e pelo tenant. Devolve null se não vale mais. */
  async resolver(token: string) {
    if (!token) return null;
    const id = hashDoToken(token);
    const sessao = await this.repositorio.buscarSessao(id);
    if (!sessao) return null;
    if (sessao.expiresAt <= new Date()) {
      await this.repositorio.removerSessao(id, "expirada");
      return null;
    }
    return { userId: sessao.userId, tenantId: sessao.tenantId, role: sessao.role };
  }

  async eu(userId: string): Promise<UsuarioDaConta> {
    if (userId === USUARIO_SEM_LOGIN && loginDispensado(process.env)) {
      return { id: USUARIO_SEM_LOGIN, name: "Desenvolvimento", email: "sem-login@local", role: "master", semLogin: true };
    }
    const usuario = await this.repositorio.buscarUsuario(userId);
    if (!usuario) throw new NaoAutenticado();
    return { id: usuario.id, name: usuario.name, email: usuario.email, role: usuario.role };
  }

  async perfil(userId: string): Promise<PerfilDoUsuario> {
    if (this.semLogin(userId)) return PERFIL_SEM_LOGIN;
    const perfil = await this.repositorio.buscarPerfil(userId);
    if (!perfil) throw new NaoAutenticado();
    return perfilDoUsuario(perfil);
  }

  async atualizarPerfil(userId: string, corpo: unknown): Promise<PerfilDoUsuario> {
    this.exigirConta(userId);
    const dados = interpretarPerfil(corpo);
    if (typeof dados === "string") throw new PedidoInvalido(dados);
    const salvo = await this.repositorio.atualizarPerfil(userId, dados);
    if (salvo === "ausente") throw new NaoAutenticado();
    return perfilDoUsuario(salvo);
  }

  /** Confere a senha atual, troca e encerra as outras sessões. A sessão de quem trocou continua. */
  async trocarSenha(userId: string, token: string, corpo: unknown) {
    this.exigirConta(userId);
    const espera = this.porUsuario.registrar(userId);
    if (espera > 0) throw new TentativasEsgotadas(espera);
    const usuario = await this.repositorio.buscarComSenha(userId);
    if (!usuario) throw new NaoAutenticado();
    const pedido = interpretarTroca(corpo, usuario.email);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    // Erro 400 e não 401: o BFF trata 401 como sessão vencida e apagaria o cookie de quem só errou a senha.
    if (!(await conferirSenha(pedido.currentPassword, usuario.passwordHash))) {
      throw new PedidoInvalido("A senha atual está incorreta.");
    }
    const encerradas = await this.repositorio.trocarSenha(userId, await gerarHash(pedido.newPassword), hashDoToken(token));
    if (encerradas === "ausente") throw new NaoAutenticado();
    return { sessoesEncerradas: encerradas };
  }

  async sessoes(userId: string, token: string): Promise<SessoesDoUsuario> {
    if (this.semLogin(userId)) return { sessions: [] };
    const atual = hashDoToken(token);
    const linhas = await this.repositorio.listarSessoes(userId, new Date());
    return {
      sessions: linhas.map((linha) => ({
        ref: linha.id.slice(0, 12),
        device: dispositivoDe(linha.userAgent),
        createdAt: linha.createdAt.toISOString(),
        expiresAt: linha.expiresAt.toISOString(),
        current: linha.id === atual,
      })),
    };
  }

  async encerrarOutras(userId: string, token: string) {
    this.exigirConta(userId);
    return { sessoesEncerradas: await this.repositorio.encerrarOutras(userId, hashDoToken(token)) };
  }

  private semLogin(userId: string) {
    return userId === USUARIO_SEM_LOGIN && loginDispensado(process.env);
  }

  private exigirConta(userId: string) {
    if (this.semLogin(userId)) {
      throw new PedidoInvalido("Você entrou sem login, em modo de desenvolvimento. Cadastre uma conta para usar o perfil.");
    }
  }

  async listarUsuarios(tenantId: string): Promise<UsuarioDaConta[]> {
    const usuarios = await this.repositorio.listarDoTenant(tenantId);
    return usuarios.map((usuario) => ({ id: usuario.id, name: usuario.name, email: usuario.email, role: usuario.role }));
  }

  /** O master acrescenta um membro à própria conta. A senha segue a mesma regra do cadastro. */
  async criarMembro(tenantId: string, corpo: unknown): Promise<UsuarioDaConta> {
    const pedido = interpretarCadastro(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const criado = await this.repositorio.criarMembro(tenantId, {
      id: randomUUID(),
      email: pedido.email,
      name: pedido.name,
      passwordHash: await gerarHash(pedido.password),
    });
    if (criado === "email-em-uso") throw new EmailEmUso();
    return { id: criado.id, name: criado.name, email: criado.email, role: criado.role };
  }

  async removerUsuario(tenantId: string, id: string) {
    const resultado = await this.repositorio.removerMembro(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado();
    if (resultado === "master") throw new MasterIntocavel();
  }

  private limitar(origem: Origem) {
    const espera = this.porOrigem.registrar(origem.ip);
    if (espera > 0) throw new TentativasEsgotadas(espera);
  }

  private async abrirSessao(usuario: Usuario, origem: Origem): Promise<SessaoAberta> {
    const token = randomBytes(32).toString("base64url");
    const agora = new Date();
    const expiresAt = new Date(agora.getTime() + DURACAO_DA_SESSAO_MS);
    // Só o hash fica no banco: um vazamento da tabela não entrega sessões utilizáveis.
    await this.repositorio.criarSessao(
      {
        id: hashDoToken(token),
        tenantId: usuario.tenantId,
        userId: usuario.id,
        expiresAt,
        userAgent: origem.userAgent.slice(0, 200),
      },
      agora,
    );
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: usuario.id, name: usuario.name, email: usuario.email, role: usuario.role },
    };
  }
}
