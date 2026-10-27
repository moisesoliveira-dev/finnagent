export const AUTH_REPOSITORIO = Symbol("AUTH_REPOSITORIO");

export type Usuario = { id: string; tenantId: string; email: string; name: string };

export type UsuarioComSenha = Usuario & {
  passwordHash: string;
  lockedUntil: Date | null;
};

export type NovoUsuario = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Tenant que o usuário assume, se ainda estiver livre. Sem ele, nasce um tenant novo. */
  tenantPreferido: string | null;
};

export type NovaSessao = {
  id: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
  userAgent: string;
};

export type SessaoGravada = { tenantId: string; userId: string; expiresAt: Date };

/** Por que a sessão acabou: a pessoa saiu ou o prazo venceu. */
export type MotivoDoFim = "sair" | "expirada";

/** Cada método que muda estado grava o evento no outbox, na mesma transação. */
export interface AuthRepositorio {
  criarUsuario(novo: NovoUsuario): Promise<Usuario | "email-em-uso">;
  buscarPorEmail(email: string): Promise<UsuarioComSenha | null>;
  buscarUsuario(id: string): Promise<Usuario | null>;
  /** Soma uma falha. Ao chegar no limite, trava a conta e zera o contador. */
  registrarFalha(id: string, limite: number, bloqueioMs: number, agora: Date): Promise<void>;
  zerarFalhas(id: string): Promise<void>;
  criarSessao(sessao: NovaSessao, agora: Date): Promise<void>;
  buscarSessao(id: string): Promise<SessaoGravada | null>;
  removerSessao(id: string, motivo: MotivoDoFim): Promise<void>;
}
