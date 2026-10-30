import type { DadosDoPerfil, PapelDoUsuario, TomDoAvatar } from "@finnagent/contracts";

export const AUTH_REPOSITORIO = Symbol("AUTH_REPOSITORIO");

export type Usuario = { id: string; tenantId: string; email: string; name: string; role: PapelDoUsuario };

export type PerfilGravado = Usuario & {
  headline: string;
  location: string;
  bio: string;
  avatarTone: TomDoAvatar;
  createdAt: Date;
};

export type SessaoDeAcessoGravada = { id: string; userAgent: string; createdAt: Date; expiresAt: Date };

export type UsuarioComSenha = Usuario & {
  passwordHash: string;
  lockedUntil: Date | null;
};

/** Quem se cadastra pela tela vira master de uma conta nova. */
export type NovoUsuario = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Tenant que o usuário assume, se ainda estiver livre. Sem ele, nasce um tenant novo. */
  tenantPreferido: string | null;
};

/** Usuário que o master acrescenta à própria conta. */
export type NovoMembro = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

export type NovaSessao = {
  id: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
  userAgent: string;
};

export type SessaoGravada = { tenantId: string; userId: string; role: PapelDoUsuario; expiresAt: Date };

/** Por que a sessão acabou: a pessoa saiu ou o prazo venceu. */
export type MotivoDoFim = "sair" | "expirada";

/** Cada método que muda estado grava o evento no outbox, na mesma transação. */
export interface AuthRepositorio {
  /** Cria o master de uma conta nova. */
  criarUsuario(novo: NovoUsuario): Promise<Usuario | "email-em-uso">;
  /** Cria um membro na conta existente. */
  criarMembro(tenantId: string, novo: NovoMembro): Promise<Usuario | "email-em-uso">;
  listarDoTenant(tenantId: string): Promise<Usuario[]>;
  /** As contas que têm ao menos um usuário: quem roda por conta (os avisos agendados) percorre esta lista. */
  listarTenants(): Promise<string[]>;
  /** Nunca remove o master. */
  removerMembro(tenantId: string, id: string): Promise<"removido" | "ausente" | "master">;
  buscarPorEmail(email: string): Promise<UsuarioComSenha | null>;
  buscarUsuario(id: string): Promise<Usuario | null>;
  buscarComSenha(id: string): Promise<UsuarioComSenha | null>;
  buscarPerfil(id: string): Promise<PerfilGravado | null>;
  /** Sem mudança real, não grava nem registra evento. */
  atualizarPerfil(id: string, dados: DadosDoPerfil): Promise<PerfilGravado | "ausente">;
  /** Troca o hash e encerra as demais sessões do usuário. Devolve quantas encerrou. */
  trocarSenha(id: string, passwordHash: string, manterSessao: string): Promise<number | "ausente">;
  listarSessoes(userId: string, agora: Date): Promise<SessaoDeAcessoGravada[]>;
  /** Encerra todas as sessões do usuário, menos a indicada. Devolve quantas encerrou. */
  encerrarOutras(userId: string, manterSessao: string): Promise<number>;
  /** Soma uma falha. Ao chegar no limite, trava a conta e zera o contador. */
  registrarFalha(id: string, limite: number, bloqueioMs: number, agora: Date): Promise<void>;
  zerarFalhas(id: string): Promise<void>;
  criarSessao(sessao: NovaSessao, agora: Date): Promise<void>;
  buscarSessao(id: string): Promise<SessaoGravada | null>;
  removerSessao(id: string, motivo: MotivoDoFim): Promise<void>;
}
