import type { Meta } from "@finnagent/contracts";

export const METAS_REPOSITORIO = Symbol("METAS_REPOSITORIO");

export type NovaMeta = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  dueYear: number | null;
  dueMonth: number | null;
  /** A sessão do grupo "Metas" que o serviço criou para a meta. */
  sessionId: string | null;
};

export type DivisaoGravada = { goalId: string; percent: number; approvedCents: number | null };

export interface MetasRepositorio {
  listar(tenantId: string): Promise<Meta[]>;
  criar(tenantId: string, pedido: NovaMeta): Promise<Meta | "identificador">;
  excluir(tenantId: string, id: string): Promise<boolean>;
  divisoes(tenantId: string, year: number, month: number): Promise<DivisaoGravada[]>;
  /** Grava a divisão do mês. A meta já aprovada não muda; a que ficou de fora e ainda não foi aprovada sai da divisão. */
  dividir(tenantId: string, year: number, month: number, percentuais: Record<string, number>): Promise<"ok" | "meta-ausente">;
  /** Marca a meta como aprovada com o valor; a aprovação só vale uma vez por mês. */
  aprovar(tenantId: string, goalId: string, year: number, month: number, cents: number): Promise<"ok" | "sem-divisao" | "ja-aprovada">;
  /** Desfaz a marca de aprovação, quando o lançamento não pôde ser feito. */
  reabrir(tenantId: string, goalId: string, year: number, month: number): Promise<void>;
  /** Grava a ordem de prioridade: o primeiro id é a posição 1. Os ids precisam ser todas as metas da conta. */
  reordenar(tenantId: string, ids: string[]): Promise<"ok" | "diferente">;
}
