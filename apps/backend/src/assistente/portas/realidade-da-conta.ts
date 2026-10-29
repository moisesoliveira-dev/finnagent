import type { BaseDaRealidade } from "../dominio/fatos-do-plano.js";

export const REALIDADE_DA_CONTA = Symbol("REALIDADE_DA_CONTA");

/** O que a conta tem hoje (lançamentos, padrões de vencimento e feriados), para o plano ser medido contra ela. */
export interface RealidadeDaConta {
  base(tenantId: string): Promise<BaseDaRealidade>;
}
