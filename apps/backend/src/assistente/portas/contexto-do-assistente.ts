export const CONTEXTO_DO_ASSISTENTE = Symbol("CONTEXTO_DO_ASSISTENTE");

export type Contexto = { hoje: string; usuario: string; fuso: string };

/** O dia de hoje no fuso da conta e o nome de quem conversa. */
export interface ContextoDoAssistente {
  obter(tenantId: string, userId: string): Promise<Contexto>;
}
