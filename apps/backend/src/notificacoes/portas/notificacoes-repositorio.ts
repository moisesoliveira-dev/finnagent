import type {
  CanalDeNotificacao,
  DispositivoDeNotificacao,
  Notificacao,
  PreferenciasDeNotificacao,
} from "@finnagent/contracts";

export const NOTIFICACOES_REPOSITORIO = Symbol("NOTIFICACOES_REPOSITORIO");

export type NovaNotificacao = Omit<Notificacao, "criadaEm" | "lidaEm"> & {
  userId: string;
  /** Idempotência: tenant, usuário e o fato. A segunda tentativa com a mesma chave não cria nada. */
  chave: string;
};

export type NotificacaoGravada = Notificacao & { userId: string };

export type DispositivoGravado = {
  id: string;
  canal: Exclude<CanalDeNotificacao, "central">;
  endpoint: string;
  p256dh: string;
  auth: string;
  plataforma: string;
};

/** Cada método que muda estado grava o evento no outbox, na mesma transação. Toda leitura filtra o tenant. */
export interface NotificacoesRepositorio {
  /** Cria as que ainda não existem e devolve quantas entraram. Cada nova grava `criar-notificacao`. */
  criar(tenantId: string, itens: NovaNotificacao[]): Promise<number>;
  /** Da mais nova para a mais velha. `antes` é o cursor da página. */
  listar(tenantId: string, userId: string, antes: Date | null, limite: number): Promise<Notificacao[]>;
  contarNaoLidas(tenantId: string, userId: string): Promise<number>;
  obter(tenantId: string, id: string): Promise<NotificacaoGravada | null>;
  marcarLida(tenantId: string, userId: string, id: string): Promise<boolean>;
  marcarTodas(tenantId: string, userId: string): Promise<number>;
  preferencias(tenantId: string, userId: string): Promise<PreferenciasDeNotificacao>;
  salvarPreferencias(tenantId: string, userId: string, preferencias: PreferenciasDeNotificacao): Promise<void>;
  /** O mesmo endpoint passa para o usuário que registrou por último: um aparelho é de quem está logado nele. */
  registrarDispositivo(tenantId: string, userId: string, dispositivo: DispositivoDeNotificacao): Promise<void>;
  removerDispositivo(tenantId: string, userId: string, endpoint: string): Promise<boolean>;
  dispositivos(tenantId: string, userId: string, canal: Exclude<CanalDeNotificacao, "central">): Promise<DispositivoGravado[]>;
  /** O serviço de push disse que a inscrição não existe mais. */
  esquecerDispositivo(tenantId: string, id: string): Promise<void>;
}
