import type {
  CategoriaTransacao,
  EfeitoTransacao,
  FinancasResposta,
  Lancamento,
  ModoTransacao,
  CalendarioDeDiasUteis,
  PrioridadeTransacao,
  Recorrencia,
  RegraDeVencimento,
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
  dueRule: RegraDeVencimento;
  /** Lançamento que já conta este valor. Este deixa de entrar na sobra. */
  coveredById?: string | null;
};

export type FalhaDeLancamento =
  | "identificador"
  | "sessao-ausente"
  | "sessao-encerrada"
  | "tipo-valor"
  | "tipo-acumulo"
  | "valor-base"
  | "valor-lancada"
  | "ausente"
  | "categoria"
  | "encerrada"
  | "concluida"
  | "compromisso-ausente"
  | "sincronizado"
  | "base"
  | "ocorrencia"
  | "bloqueada"
  | "reserva"
  | "cobertura";

export type ValorFixo = { id: string; cents: number };

export interface FinancasRepositorio {
  garantirWorkflow(tenantId: string): Promise<Workflow>;
  semearLancamentos(tenantId: string): Promise<void>;
  listar(tenantId: string, incluirEncerradas?: boolean): Promise<FinancasResposta>;
  /** Uma leitura só, com ocorrências, valores e ajustes daquele mês. Abertas são as de sessão ainda viva. */
  listarNoMes(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<{ abertas: Lancamento[]; todas: Lancamento[] }>;
  obter(tenantId: string, id: string): Promise<Lancamento | null>;
  /** O lançamento, se a sessão ainda não foi encerrada. */
  obterAberto(tenantId: string, id: string): Promise<Lancamento | null>;
  /** O calendário decide as datas dos vencimentos pela regra (feriados nacionais e os locais da conta). */
  criar(
    tenantId: string,
    pedido: NovoLancamento,
    calendario: CalendarioDeDiasUteis,
  ): Promise<Lancamento | FalhaDeLancamento>;
  atualizar(
    tenantId: string,
    pedido: NovoLancamento,
    calendario: CalendarioDeDiasUteis,
  ): Promise<Lancamento | FalhaDeLancamento>;
  /**
   * Recalcula as datas das ocorrências ainda pendentes pela regra de cada lançamento; as pagas ficam.
   * Sem `entryId`, passa pelos lançamentos da conta que têm regra. Devolve quantos mudaram.
   */
  redatar(tenantId: string, calendario: CalendarioDeDiasUteis, entryId?: string): Promise<number>;
  atualizarStatus(
    tenantId: string,
    id: string,
    status: StatusTransacao,
  ): Promise<Lancamento | FalhaDeLancamento>;
  atualizarOcorrencia(
    tenantId: string,
    id: string,
    number: number,
    pedido: { status?: StatusTransacao; dueDate?: string; plannedCents?: number },
  ): Promise<Lancamento | FalhaDeLancamento>;
  associarCompromisso(
    tenantId: string,
    id: string,
    commitmentId: string,
  ): Promise<Lancamento | FalhaDeLancamento>;
  pagarPeloExtrato(
    tenantId: string,
    id: string,
    date: string,
    cents: number,
  ): Promise<Lancamento | FalhaDeLancamento>;
  reabrirPeloExtrato(
    tenantId: string,
    id: string,
    date: string,
    cents: number,
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
  excluir(tenantId: string, id: string): Promise<void | FalhaDeLancamento>;
  excluirOcorrencia(
    tenantId: string,
    id: string,
    number: number,
  ): Promise<"entry" | "occurrence" | FalhaDeLancamento>;
}
