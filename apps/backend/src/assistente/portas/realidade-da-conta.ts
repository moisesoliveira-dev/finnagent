import type { BaseDaRealidade } from "../dominio/fatos-do-plano.js";

export const REALIDADE_DA_CONTA = Symbol("REALIDADE_DA_CONTA");

/** O que a conta tem hoje (lançamentos, padrões de vencimento e feriados), para o plano ser medido contra ela. */
export type LinhaDaRealidade = { date: string; cents: number; description: string; entryId: string | null };

export type ChaveDaLinha = { statementId: string; line: number };

export interface RealidadeDaConta {
  base(tenantId: string): Promise<BaseDaRealidade>;
  linhaDoExtrato(tenantId: string, statementId: string, line: number): Promise<LinhaDaRealidade | null>;
  linhasDoExtrato(tenantId: string, chaves: ChaveDaLinha[]): Promise<Map<string, LinhaDaRealidade>>;
}
