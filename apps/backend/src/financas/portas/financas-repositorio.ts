import type { FinancasResposta, Lancamento, TipoLancamento, Workflow } from "@finnagent/contracts";

export const FINANCAS_REPOSITORIO = Symbol("FINANCAS_REPOSITORIO");

export type NovoLancamento = {
  id: string;
  sessionId: string;
  type: TipoLancamento;
  description: string;
  justification: string;
  day: number;
  cents: number;
  startYear: number;
  startMonth: number;
  installments: number | null;
};

export type FalhaDeLancamento = "identificador" | "sessao-ausente";

export interface FinancasRepositorio {
  garantirWorkflow(tenantId: string): Promise<Workflow>;
  semearLancamentos(tenantId: string): Promise<void>;
  listar(tenantId: string): Promise<FinancasResposta>;
  criar(
    tenantId: string,
    pedido: NovoLancamento,
  ): Promise<Lancamento | FalhaDeLancamento>;
}
