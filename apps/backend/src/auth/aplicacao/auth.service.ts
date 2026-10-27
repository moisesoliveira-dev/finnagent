import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { SessaoAberta, UsuarioDaConta } from "@finnagent/contracts";
import { CredenciaisInvalidas, EmailEmUso, NaoAutenticado, TentativasEsgotadas } from "../dominio/erros.js";
import { Limitador } from "../dominio/limitador.js";
import { interpretarCadastro, interpretarEntrada } from "../dominio/pedido.js";
import { conferirSenha, gerarHash, hashDeReferencia } from "../dominio/senha.js";
import { PedidoInvalido } from "../../grupos/dominio/erros.js";
import { AUTH_REPOSITORIO, type AuthRepositorio, type Usuario } from "../portas/auth-repositorio.js";

/** Tenant dos dados criados antes de existir login. */
export const TENANT_LEGADO = "00000000-0000-4000-8000-000000000001";

export const DURACAO_DA_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const FALHAS_ATE_TRAVAR = 5;
const TRAVA_MS = 15 * 60 * 1000;

export type Origem = { ip: string; userAgent: string };

export function hashDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  // Teto por origem, antes de qualquer consulta ao banco: segura quem tenta e-mails em série.
  private readonly porOrigem = new Limitador(30, 10 * 60 * 1000);

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
    return { userId: sessao.userId, tenantId: sessao.tenantId };
  }

  async eu(userId: string): Promise<UsuarioDaConta> {
    const usuario = await this.repositorio.buscarUsuario(userId);
    if (!usuario) throw new NaoAutenticado();
    return { id: usuario.id, name: usuario.name, email: usuario.email };
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
      user: { id: usuario.id, name: usuario.name, email: usuario.email },
    };
  }
}
