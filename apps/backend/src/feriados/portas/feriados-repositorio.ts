import type { FeriadoLocal } from "@finnagent/contracts";

export const FERIADOS_REPOSITORIO = Symbol("FERIADOS_REPOSITORIO");

/** Cada método que muda estado grava o evento no outbox, na mesma transação. */
export interface FeriadosRepositorio {
  listar(tenantId: string): Promise<FeriadoLocal[]>;
  /** "repetido" quando a conta já tem feriado no mesmo dia e mês. */
  criar(tenantId: string, feriado: FeriadoLocal): Promise<FeriadoLocal | "repetido">;
  remover(tenantId: string, id: string): Promise<boolean>;
}
