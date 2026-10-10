import type {
  CategoriaTransacao,
  EfeitoTransacao,
  FinancasResposta,
  Lancamento,
  ModoTransacao,
  PrioridadeTransacao,
  Recorrencia,
  StatusTransacao,
  TipoLancamento,
  TipoTransacao,
  Workflow,
} from "@finnagent/contracts";

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
  name: string;
  date: string;
  mode: ModoTransacao;
  status: StatusTransacao;
  transactionType: TipoTransacao;
  category: CategoriaTransacao;
  priority: PrioridadeTransacao;
  installmentNumber: number | null;
  dueDate: string | null;
  interestRate: number | null;
  nextDueDate: string | null;
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
};

export type FalhaDeLancamento =
  | "identificador"
  | "sessao-ausente"
  | "sessao-encerrada"
  | "ausente"
  | "categoria"
  | "encerrada"
  | "concluida"
  | "compromisso-ausente";

export type ValorFixo = { id: string; cents: number };

export interface FinancasRepositorio {
  garantirWorkflow(tenantId: string): Promise<Workflow>;
  semearLancamentos(tenantId: string): Promise<void>;
  listar(tenantId: string): Promise<FinancasResposta>;
  criar(
    tenantId: string,
    pedido: NovoLancamento,
  ): Promise<Lancamento | FalhaDeLancamento>;
  atualizar(
    tenantId: string,
    pedido: NovoLancamento,
  ): Promise<Lancamento | FalhaDeLancamento>;
  atualizarStatus(
    tenantId: string,
    id: string,
    status: StatusTransacao,
  ): Promise<Lancamento | FalhaDeLancamento>;
  associarCompromisso(
    tenantId: string,
    id: string,
    commitmentId: string,
  ): Promise<Lancamento | FalhaDeLancamento>;
  adiantar(
    tenantId: string,
    id: string,
    category: "installment" | "loan",
  ): Promise<Lancamento | FalhaDeLancamento>;
  cancelarSerie(
    tenantId: string,
    id: string,
    category: "installment" | "loan",
  ): Promise<Lancamento | FalhaDeLancamento>;
  ajustarMes(
    tenantId: string,
    id: string,
    year: number,
    month: number,
    effect: EfeitoTransacao,
  ): Promise<Lancamento | FalhaDeLancamento>;
  atualizarValorFixo(
    tenantId: string,
    valores: ValorFixo[],
  ): Promise<Lancamento[] | FalhaDeLancamento>;
}
