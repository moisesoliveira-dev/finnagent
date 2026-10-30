import { z } from "zod";

export type TenantId = string;

export type Grupo = {
  id: string;
  name: string;
  description: string;
};

export const TIPOS_SESSAO = ["valor", "acumulo"] as const;
export type TipoSessao = (typeof TIPOS_SESSAO)[number];

export type Acrescimo = {
  id: string;
  cents: number;
  note: string;
};

export type Sessao = {
  id: string;
  groupId: string;
  name: string;
  description: string;
  justification: string;
  startedAt: string | null;
  endedAt: string | null;
  kind: TipoSessao;
  categories: CategoriaTransacao[];
  available: boolean;
  cents: number;
  additions: Acrescimo[];
  totalCents: number;
};

export type GruposResposta = {
  groups: Grupo[];
  sessions: Sessao[];
};

export type ViradaGrupo = {
  id: string;
  name: string;
  sessions: Array<{ id: string; name: string }>;
};

export type ViradaResposta =
  | { pendente: false }
  | { pendente: true; year: number; groups: ViradaGrupo[] };

export const TIPOS_LANCAMENTO = [
  "adicional",
  "parcela",
  "empréstimo",
  "fixo",
  "variável",
] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export const MODOS_TRANSACAO = ["inflows", "outflows"] as const;
export type ModoTransacao = (typeof MODOS_TRANSACAO)[number];

export const STATUS_TRANSACAO = ["pending", "completed", "cancelled", "refunded"] as const;
export type StatusTransacao = (typeof STATUS_TRANSACAO)[number];

export type Ocorrencia = {
  number: number;
  dueDate: string;
  plannedCents: number;
  paidCents: number | null;
  paidOn: string | null;
  status: StatusTransacao;
};

export type SituacaoOcorrencia = StatusTransacao | "late";

export const TIPOS_TRANSACAO = ["appointment", "unusual"] as const;
export type TipoTransacao = (typeof TIPOS_TRANSACAO)[number];

export const CATEGORIAS_TRANSACAO = [
  "additional",
  "installment",
  "loan",
  "fixed",
  "unique",
] as const;
export type CategoriaTransacao = (typeof CATEGORIAS_TRANSACAO)[number];

export const PRIORIDADES_TRANSACAO = ["low", "normal", "high", "nopriority"] as const;
export type PrioridadeTransacao = (typeof PRIORIDADES_TRANSACAO)[number];

export function categoriaSempreEntrada(category: CategoriaTransacao) {
  return category === "additional";
}

export function categoriaSempreSaida(category: CategoriaTransacao) {
  return category === "installment";
}

export function categoriaDeCompromisso(category: CategoriaTransacao) {
  return category === "fixed" || category === "installment" || category === "loan";
}

export function prioridadeAplicavel(category: CategoriaTransacao, mode: ModoTransacao) {
  if (category === "installment") return true;
  return mode === "outflows" && !categoriaSempreEntrada(category);
}

export function ajustarTransacao<
  T extends {
    category: CategoriaTransacao;
    mode: ModoTransacao;
    priority: PrioridadeTransacao;
    transactionType: TipoTransacao;
  },
>(pedido: T): T {
  const mode = categoriaSempreEntrada(pedido.category)
    ? "inflows"
    : categoriaSempreSaida(pedido.category)
      ? "outflows"
      : pedido.mode;
  const priority = prioridadeAplicavel(pedido.category, mode)
    ? pedido.priority === "nopriority"
      ? "normal"
      : pedido.priority
    : "nopriority";
  const transactionType = categoriaDeCompromisso(pedido.category)
    ? "appointment"
    : pedido.transactionType;
  return { ...pedido, mode, priority, transactionType };
}

export type BaseLancamento = {
  category: CategoriaTransacao;
  mode: ModoTransacao;
  transactionType: TipoTransacao;
  installments: number | null;
  dueDate: string | null;
  interestRate: number | null;
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
};

export function alterouBase(atual: BaseLancamento, pedido: BaseLancamento) {
  return (
    atual.category !== pedido.category ||
    atual.mode !== pedido.mode ||
    atual.transactionType !== pedido.transactionType ||
    atual.installments !== pedido.installments ||
    atual.dueDate !== pedido.dueDate ||
    !mesmoPercentual(atual.interestRate, pedido.interestRate) ||
    atual.recurrence !== pedido.recurrence ||
    atual.recurrenceInterval !== pedido.recurrenceInterval
  );
}

function mesmoPercentual(atual: number | null, pedido: number | null) {
  if (atual == null || pedido == null) return atual == null && pedido == null;
  return Math.round(atual * 100) === Math.round(pedido * 100);
}

export function alterouIdentidade(atual: BaseLancamento, pedido: BaseLancamento) {
  return (
    atual.category !== pedido.category ||
    atual.mode !== pedido.mode ||
    atual.transactionType !== pedido.transactionType
  );
}

export type TermosLancamento = {
  installments: number | null;
  dueDate: string | null;
  interestRate: number | null;
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
  cents: number;
  date: string;
};

export function alterouTermos(atual: TermosLancamento, pedido: TermosLancamento) {
  return (
    atual.installments !== pedido.installments ||
    atual.dueDate !== pedido.dueDate ||
    !mesmoPercentual(atual.interestRate, pedido.interestRate) ||
    atual.recurrence !== pedido.recurrence ||
    atual.recurrenceInterval !== pedido.recurrenceInterval ||
    atual.cents !== pedido.cents ||
    atual.date !== pedido.date
  );
}

export const EFEITOS_TRANSACAO = ["cancelled", "suspended"] as const;
export type EfeitoTransacao = (typeof EFEITOS_TRANSACAO)[number];

export type AjusteTransacao = {
  year: number;
  month: number;
  effect: EfeitoTransacao;
};

export function tipoDaCategoria(category: CategoriaTransacao): TipoLancamento {
  if (category === "additional") return "adicional";
  if (category === "installment") return "parcela";
  if (category === "loan") return "empréstimo";
  if (category === "fixed") return "fixo";
  return "variável";
}

export function categoriaDoTipo(type: TipoLancamento): CategoriaTransacao {
  if (type === "adicional") return "additional";
  if (type === "parcela") return "installment";
  if (type === "empréstimo") return "loan";
  if (type === "fixo") return "fixed";
  return "unique";
}

export function modoDoValor(cents: number): ModoTransacao {
  return cents > 0 ? "inflows" : "outflows";
}

export function centavosComSinal(cents: number, mode: ModoTransacao) {
  const absoluto = Math.abs(cents);
  return mode === "outflows" ? -absoluto : absoluto;
}

export const RECORRENCIAS = [
  "weekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "customize",
] as const;
export type Recorrencia = (typeof RECORRENCIAS)[number];

const MESES_DA_RECORRENCIA = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
} as const;

export function vezesDaRecorrencia(
  recurrence: Recorrencia,
  interval: number,
  startYear: number,
  startMonth: number,
  day: number,
  year: number,
  monthIndex: number,
) {
  const passo = Math.max(interval, 1);
  const inicio = indice(startYear, startMonth - 1);
  const alvo = indice(year, monthIndex);
  if (alvo < inicio) return 0;
  if (recurrence === "weekly" || recurrence === "customize") {
    return diasNoMes(
      startYear,
      startMonth,
      day,
      year,
      monthIndex,
      recurrence === "weekly" ? 7 * passo : passo,
    );
  }
  const meses = MESES_DA_RECORRENCIA[recurrence] * passo;
  return (alvo - inicio) % meses === 0 ? 1 : 0;
}

export const NOME_MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

export type Workflow = {
  year: number;
  month: number;
  day: number;
};

export type MesLancamento = {
  year: number;
  month: number;
  cents: number;
};

export type Lancamento = {
  id: string;
  groupId: string;
  groupName: string;
  sessionId: string;
  sessionName: string;
  type: TipoLancamento;
  description: string;
  justification: string;
  day: number;
  cents: number;
  startYear: number;
  startMonth: number;
  installments: number | null;
  months: MesLancamento[];
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
  suspendedCents: number;
  commitmentId: string | null;
  adjustments: AjusteTransacao[];
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
  synced: boolean;
  /** Preenchido: este valor já entra em outro lançamento e não soma de novo na sobra. */
  coveredById?: string | null;
  occurrences?: Ocorrencia[];
  /** Como cada vencimento cai em dia útil. Sem regra, é o dia como está. */
  dueRule?: RegraDeVencimento;
};

export type FinancasResposta = {
  workflow: Workflow;
  entries: Lancamento[];
};

export type OcorrenciaVista = Ocorrencia & {
  situation: SituacaoOcorrencia;
  cents: number;
  next: StatusTransacao[];
  editable: boolean;
};

export type RegraCategoria = {
  mode: ModoTransacao | null;
  transactionType: TipoTransacao | null;
  priority: "sempre" | "saida" | "nunca";
  installments: boolean;
  loan: boolean;
  recurrence: boolean;
};

export type LancamentoVista = Omit<Lancamento, "occurrences"> & {
  occurrences: OcorrenciaVista[];
  situation: SituacaoOcorrencia;
  termsLocked: boolean;
  nextDue: string | null;
  contractCents: number;
  suspendedTotal: number;
  actions: {
    remove: boolean;
    series: "installment" | "loan" | null;
    fixedMonth: boolean;
  };
};

export type FinancasVista = {
  workflow: Workflow;
  entries: LancamentoVista[];
  rules: Record<CategoriaTransacao, RegraCategoria>;
};

export type LinhaBase = {
  entryId: string;
  number: number;
  dueDate: string;
  name: string;
  description: string;
  justification: string;
  groupName: string;
  sessionName: string;
  category: CategoriaTransacao;
  priority: PrioridadeTransacao;
  situation: SituacaoOcorrencia;
  cents: number;
  installment: { number: number; total: number } | null;
  remove: "entry" | "occurrence" | null;
  synced: boolean;
};

export type BaseResposta = {
  year: number;
  month: number | null;
  day: number | null;
  years: number[];
  months: number[];
  days: number[];
  groups: { id: string; name: string }[];
  rows: LinhaBase[];
  totalCents: number;
};

export type LinhaGeral = {
  id: string;
  sessionName: string;
  summary: string;
  cents: Array<number | null>;
  endsIn: number | null;
  totalCents: number;
};

export type GrupoGeral = {
  id: string;
  name: string;
  cents: number[];
  totalCents: number;
  entries: LinhaGeral[];
};

export type GeralResposta = {
  year: number;
  months: number[];
  groups: GrupoGeral[];
  totals: {
    inflows: number[];
    outflows: number[];
    surplus: number[];
    inflowsCents: number;
    outflowsCents: number;
    surplusCents: number;
  };
};

export function colunasDoAno(workflow: Workflow, year: number) {
  if (year < workflow.year) return [];
  const inicio = year === workflow.year ? workflow.month - 1 : 0;
  return Array.from({ length: 12 - inicio }, (_, offset) => inicio + offset);
}

export function centavosNoMes(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  monthIndex: number,
) {
  if (entry.coveredById) return undefined;
  const bruto = centavosAgendados(entry, year, monthIndex);
  if (bruto === undefined) return undefined;
  const cortaInicio =
    year === workflow.year &&
    monthIndex === workflow.month - 1 &&
    entry.day < workflow.day;
  if (cortaInicio) return undefined;
  return bruto;
}

export function encerraNoMes(entry: Lancamento, year: number, monthIndex: number) {
  if (entry.type !== "parcela" && entry.type !== "empréstimo") return false;
  const parcelas = entry.installments ?? 0;
  if (parcelas < 1) return false;
  return indice(year, monthIndex) === indice(entry.startYear, entry.startMonth - 1) + parcelas - 1;
}

export function textoDaLinha(entry: Lancamento) {
  if (entry.type === "parcela" || entry.type === "empréstimo") {
    const parcelas = entry.installments ?? 0;
    const fim = indice(entry.startYear, entry.startMonth - 1) + Math.max(parcelas, 1) - 1;
    return `${parcelas} parcelas · termina em ${NOME_MES[fim % 12]}`;
  }
  if (entry.type === "fixo") return `Só em ${entry.startYear}`;
  if (entry.type === "adicional") return "Avulso";
  return "Varia a cada mês";
}

export function primeiroMesVisivel(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  colunas: number[],
) {
  return colunas.find(
    (monthIndex) => centavosNoMes(entry, workflow, year, monthIndex) !== undefined,
  );
}

export function indiceDaParcela(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  monthIndex: number,
  colunas: number[],
) {
  if (entry.type !== "parcela" && entry.type !== "empréstimo") return undefined;
  const primeiro = primeiroMesVisivel(entry, workflow, year, colunas);
  if (primeiro === undefined) return undefined;
  return monthIndex - primeiro + 1;
}

export function totaisDoMes(
  entries: Lancamento[],
  workflow: Workflow,
  year: number,
  monthIndex: number,
) {
  const valores = entries.map((entry) => centavosNoMes(entry, workflow, year, monthIndex));
  const entradas = valores.reduce<number>((total, valor) => total + Math.max(valor ?? 0, 0), 0);
  const saidas = valores.reduce<number>((total, valor) => total + Math.min(valor ?? 0, 0), 0);
  return { entradas, saidas, sobra: entradas + saidas };
}

export function somaDosCentavos(valores: Array<number | undefined>) {
  return valores.reduce<number>((total, valor) => total + (valor ?? 0), 0);
}

export function ocorreNoMes(
  entry: Lancamento,
  workflow: Workflow,
  year: number,
  monthIndex: number,
) {
  if (valorDoCalendario(entry, year, monthIndex) === undefined) return false;
  return !(
    year === workflow.year &&
    monthIndex === workflow.month - 1 &&
    entry.day < workflow.day
  );
}

function centavosAgendados(entry: Lancamento, year: number, monthIndex: number) {
  const contaveis = ocorrenciasDoLancamento(entry).filter(
    (item) =>
      noMes(item.dueDate, year, monthIndex) &&
      (item.status === "pending" || item.status === "completed"),
  );
  if (contaveis.length === 0) return undefined;
  return contaveis.reduce(
    (total, item) =>
      total + (item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents),
    0,
  );
}

function noMes(iso: string, year: number, monthIndex: number) {
  const [ano, mes] = iso.split("-").map(Number);
  return ano === year && mes === monthIndex + 1;
}

function valorDoCalendario(entry: Lancamento, year: number, monthIndex: number) {
  if (entry.type === "adicional" || entry.type === "variável") {
    return entry.months.find((mes) => mes.year === year && mes.month === monthIndex + 1)?.cents;
  }
  const distancia = indice(year, monthIndex) - indice(entry.startYear, entry.startMonth - 1);
  if (distancia < 0) return undefined;
  if (entry.type === "fixo") {
    if (year !== entry.startYear) return undefined;
    const vezes = vezesDaRecorrencia(
      entry.recurrence ?? "monthly",
      entry.recurrenceInterval ?? 1,
      entry.startYear,
      entry.startMonth,
      entry.day,
      year,
      monthIndex,
    );
    if (vezes === 0) return undefined;
    if (entry.recurrence === "weekly" || entry.recurrence === "customize") return entry.cents * vezes;
    return entry.cents;
  }
  const parcelas = entry.installments ?? 0;
  if (distancia < parcelas) return entry.cents;
  return undefined;
}

function indice(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function diasNoMes(
  startYear: number,
  startMonth: number,
  day: number,
  year: number,
  monthIndex: number,
  stepDays: number,
) {
  return datasNoMes(startYear, startMonth, day, year, monthIndex, stepDays).length;
}

function datasNoMes(
  startYear: number,
  startMonth: number,
  day: number,
  year: number,
  monthIndex: number,
  stepDays: number,
) {
  const inicio = instante(startYear, startMonth, day);
  const inicioMes = Date.UTC(year, monthIndex, 1);
  const fimMes = Date.UTC(year, monthIndex + 1, 0);
  if (fimMes < inicio) return [];
  const passo = stepDays * 86_400_000;
  const aPartir = Math.max(inicio, inicioMes);
  const saltos = Math.ceil((aPartir - inicio) / passo);
  const datas: string[] = [];
  for (let quando = inicio + saltos * passo; quando <= fimMes; quando += passo) {
    datas.push(new Date(quando).toISOString().slice(0, 10));
    if (datas.length > 31) break;
  }
  return datas;
}

function instante(year: number, month: number, day: number) {
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Date.UTC(year, month - 1, Math.min(Math.max(day, 1), ultimo));
}

type ContratoLancamento = Pick<
  Lancamento,
  | "type"
  | "day"
  | "cents"
  | "startYear"
  | "startMonth"
  | "installments"
  | "status"
  | "months"
  | "recurrence"
  | "recurrenceInterval"
  | "adjustments"
  | "dueRule"
>;

export function ocorrenciasDoLancamento(entry: Lancamento) {
  if (entry.occurrences && entry.occurrences.length > 0) return entry.occurrences;
  return gradeDoLancamento(entry);
}

export function gradeDoLancamento(entry: ContratoLancamento, calendario: CalendarioDeDiasUteis = CALENDARIO_NACIONAL): Ocorrencia[] {
  if (entry.type === "adicional" || entry.type === "variável") {
    return [...entry.months]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((mes, index) =>
        montarOcorrencia(
          index + 1,
          isoDaData(mes.year, mes.month, entry.day),
          mes.cents,
          entry,
          entry.status,
        ),
      );
  }
  if (entry.type === "fixo") {
    return datasFixas(entry, calendario).map((dueDate, index) =>
      montarOcorrencia(index + 1, dueDate, entry.cents, entry, entry.status),
    );
  }
  const total = entry.installments ?? 0;
  const lista: Ocorrencia[] = [];
  for (let parcela = 0; parcela < total; parcela += 1) {
    const absoluto = indice(entry.startYear, entry.startMonth - 1) + parcela;
    const year = Math.floor(absoluto / 12);
    const month = (absoluto % 12) + 1;
    lista.push(
      montarOcorrencia(
        parcela + 1,
        dataPelaRegra(year, month, entry.day, entry.dueRule ?? REGRA_SEM_AJUSTE, calendario),
        entry.type === "empréstimo" ? centavosDaPrestacao(entry.cents) : entry.cents,
        entry,
        entry.status,
      ),
    );
  }
  return lista;
}

export function transicaoDaOcorrencia(atual: Ocorrencia, status: StatusTransacao): Ocorrencia | "bloqueada" {
  if (atual.status === status) return atual;
  if (atual.status === "pending" && status === "completed") return quitada(atual);
  if (atual.status === "pending" && status === "cancelled") {
    return { ...atual, status, paidCents: null, paidOn: null };
  }
  if (atual.status === "completed" && status === "refunded") return { ...atual, status };
  if (atual.status === "cancelled" && status === "pending") {
    return { ...atual, status, paidCents: null, paidOn: null };
  }
  return "bloqueada";
}

export function aplicarStatusNoConjunto(lista: Ocorrencia[], status: StatusTransacao) {
  return lista.map((item) => {
    if (status === "completed" && item.status === "pending") return quitada(item);
    if (status === "cancelled" && item.status === "pending") {
      return { ...item, status: "cancelled" as const, paidCents: null, paidOn: null };
    }
    if (status === "refunded" && item.status === "completed") return { ...item, status: "refunded" as const };
    if (status === "pending" && item.status === "cancelled") {
      return { ...item, status: "pending" as const, paidCents: null, paidOn: null };
    }
    return item;
  });
}

export function statusAgregado(lista: Ocorrencia[]): StatusTransacao {
  if (lista.some((item) => item.status === "pending")) return "pending";
  if (lista.some((item) => item.status === "completed")) return "completed";
  if (lista.length > 0 && lista.every((item) => item.status === "cancelled")) return "cancelled";
  if (lista.some((item) => item.status === "refunded")) return "refunded";
  return "pending";
}

export function parcelaAtual(lista: Ocorrencia[]) {
  const aberta = lista.find((item) => item.status === "pending");
  if (aberta) return aberta.number;
  const ultima = lista[lista.length - 1];
  return ultima ? ultima.number : null;
}

export function proximoVencimento(lista: Ocorrencia[]) {
  return lista.find((item) => item.status === "pending")?.dueDate ?? null;
}

export function termosTravados(lista: Ocorrencia[], synced: boolean) {
  return synced || lista.some((item) => item.status !== "pending");
}

/** A ocorrência já resolvida permanece. A grade nova só substitui o que ainda está pendente. */
export function mesclarGrade(anteriores: Ocorrencia[], nova: Ocorrencia[]): Ocorrencia[] {
  const porNumero = new Map(anteriores.map((item) => [item.number, item]));
  const daNova = new Set(nova.map((item) => item.number));
  const resultado = nova.map((item) => {
    const antiga = porNumero.get(item.number);
    return antiga && antiga.status !== "pending" ? antiga : item;
  });
  for (const antiga of anteriores) {
    if (!daNova.has(antiga.number) && antiga.status !== "pending") resultado.push(antiga);
  }
  return resultado.sort((a, b) => a.number - b.number);
}

/** A prestação que sai da conta. A taxa de juros fica no contrato e não é somada de novo. */
export function centavosDaPrestacao(cents: number) {
  return cents;
}

export function situacaoDaOcorrencia(item: Ocorrencia, hoje: string): SituacaoOcorrencia {
  if (item.status === "pending" && item.dueDate < hoje) return "late";
  return item.status;
}

export function situacaoDoLancamento(entry: Lancamento, hoje: string): SituacaoOcorrencia {
  const lista = ocorrenciasDoLancamento(entry);
  if (lista.some((item) => situacaoDaOcorrencia(item, hoje) === "late")) return "late";
  return statusAgregado(lista);
}

export function diaLocal(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function quitada(atual: Ocorrencia) {
  return {
    ...atual,
    status: "completed" as const,
    paidCents: atual.plannedCents,
    paidOn: atual.dueDate,
  };
}

function montarOcorrencia(
  number: number,
  dueDate: string,
  plannedCents: number,
  entry: Pick<ContratoLancamento, "adjustments">,
  statusPedido: StatusTransacao,
): Ocorrencia {
  const status = statusDaGrade(entry, dueDate, statusPedido);
  const paga = status === "completed";
  return {
    number,
    dueDate,
    plannedCents,
    paidCents: paga ? plannedCents : null,
    paidOn: paga ? dueDate : null,
    status,
  };
}

function statusDaGrade(
  entry: Pick<ContratoLancamento, "adjustments">,
  dueDate: string,
  statusPedido: StatusTransacao,
) {
  if (statusPedido === "cancelled" || statusPedido === "refunded") return statusPedido;
  const [year, month] = dueDate.split("-").map(Number);
  const ajuste = entry.adjustments.find((item) => item.year === year && item.month === month);
  if (ajuste?.effect === "cancelled" || ajuste?.effect === "suspended") return "cancelled" as const;
  return statusPedido;
}

function datasFixas(entry: ContratoLancamento, calendario: CalendarioDeDiasUteis) {
  const regra = entry.dueRule ?? REGRA_SEM_AJUSTE;
  const recurrence = entry.recurrence ?? "monthly";
  const passo = Math.max(entry.recurrenceInterval ?? 1, 1);
  if (recurrence === "weekly" || recurrence === "customize") {
    const stepDays = recurrence === "weekly" ? 7 * passo : passo;
    const datas: string[] = [];
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      datas.push(
        ...datasNoMes(entry.startYear, entry.startMonth, entry.day, entry.startYear, monthIndex, stepDays),
      );
    }
    // Semanal e a cada N dias: "Nº dia útil" não se aplica; só o ajuste quando cai em dia não útil.
    return datas.map((data) => ajustarAoDiaUtil(data, { ...regra, tipo: "dia" }, calendario));
  }
  const datas: string[] = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const vezes = vezesDaRecorrencia(
      recurrence,
      passo,
      entry.startYear,
      entry.startMonth,
      entry.day,
      entry.startYear,
      monthIndex,
    );
    if (vezes === 1) datas.push(dataPelaRegra(entry.startYear, monthIndex + 1, entry.day, regra, calendario));
  }
  return datas;
}

function isoDaData(year: number, month: number, day: number) {
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dia = Math.min(Math.max(day, 1), ultimo);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export const AGENDAS = ["Pessoal", "Trabalho"] as const;

export type NomeAgenda = (typeof AGENDAS)[number];

export const CATEGORIAS_COMPROMISSO = ["fixed", "periodical", "time"] as const;

export type CategoriaCompromisso = (typeof CATEGORIAS_COMPROMISSO)[number];

export const STATUS_COMPROMISSO = ["done", "undone"] as const;

export type StatusCompromisso = (typeof STATUS_COMPROMISSO)[number];

export const FUSOS_AGENDA = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
] as const;

export type FusoAgenda = (typeof FUSOS_AGENDA)[number];

export const FUSO_PADRAO: FusoAgenda = "America/Sao_Paulo";

export const TEMAS = ["auto", "light", "dark"] as const;

export type Tema = (typeof TEMAS)[number];

export const LIMITE_MODELOS_IA = 20;

export const LIMITE_ID_MODELO = 120;

export function idDeModelo(valor: string) {
  const nome = valor.trim();
  if (nome.length < 1 || nome.length > LIMITE_ID_MODELO) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(nome)) return "";
  return nome;
}

export const MODOS_CATEGORIA = ["confirmar", "aplicar"] as const;

export type ModoCategoria = (typeof MODOS_CATEGORIA)[number];

export const HORAS_PENDENTE = [12, 24, 48, 72] as const;

export type HorasPendente = (typeof HORAS_PENDENTE)[number];

export const LEMBRETES = ["15m", "1h", "1d"] as const;

export type Lembrete = (typeof LEMBRETES)[number];

export const RETENCOES = ["90d", "1a", "sempre"] as const;

export type Retencao = (typeof RETENCOES)[number];

export type Preferencias = {
  name: string;
  timezone: FusoAgenda;
  theme: Tema;
  workflowDate: string;
  personalCalendar: boolean;
  workCalendar: boolean;
  showEntries: boolean;
  categorize: ModoCategoria;
  pendingHours: HorasPendente;
  reminder: Lembrete;
  reminders: boolean;
  dueAlerts: boolean;
  emailAlerts: boolean;
  appAlerts: boolean;
  history: Retencao;
  googleClientId: string;
  googleClientSecret: string;
  limparSegredoGoogle: boolean;
  googleCalendarPersonal: string;
  googleCalendarWork: string;
  aiModels: string[];
  aiModel: string;
  aiApiKey: string;
  limparChaveIa: boolean;
  /** O ajuste sugerido por categoria quando um vencimento cai em dia não útil. */
  vencimentos: PadroesDeVencimento;
  feriadosNaAgenda: boolean;
  facultativosNaAgenda: boolean;
};

export type AgendaGoogle = {
  id: string;
  name: string;
};

export function rotuloDoGoogle(estado: EstadoGoogle) {
  if (estado === "sincronizado") return "Conectado";
  if (estado === "sincronizando") return "Sincronizando";
  if (estado === "erro") return "Erro na sincronização";
  return "Desconectado";
}

export type Configuracoes = Preferencias & {
  google: EstadoGoogle;
  googleSecretConfigured: boolean;
  googleConnected: boolean;
  googleAccount: string;
  googleCalendars: AgendaGoogle[];
  aiKeyConfigured: boolean;
};

export type EstadoGoogle = "desconectado" | "sincronizando" | "sincronizado" | "erro";

export type LancamentoDoMes = {
  id: string;
  /** A ocorrência do dia. A fixa semanal, ou um vencimento que o ajuste trouxe de outro mês, aparece mais de uma vez no mês. */
  number: number;
  description: string;
  day: number;
  groupName: string;
  sessionName: string;
  cents: number;
  situation: SituacaoOcorrencia;
};

export type Vinculo = {
  entryId: string;
  groupName: string;
  sessionName: string;
  cents: number;
  situation: SituacaoOcorrencia;
};

export type MovimentoCompromisso = {
  appointment: Compromisso;
  series: boolean;
};

export type Calendario = {
  name: NomeAgenda;
  timezone: FusoAgenda;
};

export type Compromisso = {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: StatusCompromisso;
  year: number;
  month: number;
  day: number;
  time: string | null;
  endTime?: string | null;
  anchorYear?: number;
  anchorMonth?: number;
  anchorDay?: number;
  calendar: NomeAgenda;
  timezone: FusoAgenda;
  category: CategoriaCompromisso;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  entryId: string | null;
  link: Vinculo | null;
  // Sessão que acumula os gastos deste compromisso. `spentCents` soma o que foi pago nela no dia dele.
  sessionId: string | null;
  sessionLabel: string | null;
  spentCents: number;
};

export type SessaoDaAgenda = {
  id: string;
  label: string;
};

export type AgendaResposta = {
  google: EstadoGoogle;
  calendars: Calendario[];
  appointments: Compromisso[];
  entries: LancamentoDoMes[];
  sessions: SessaoDaAgenda[];
  /** Feriados e pontos facultativos do mês, conforme as configurações de exibição. */
  holidays: Feriado[];
};

export const LIMITE_EXTRATO_BYTES = 5 * 1024 * 1024;

export const FORMATOS_EXTRATO = ["ofx", "csv", "ocr"] as const;

export type FormatoExtrato = (typeof FORMATOS_EXTRATO)[number];

export const STATUS_EXTRATO = ["importado", "com_erros", "processando", "falhou"] as const;

export type StatusExtrato = (typeof STATUS_EXTRATO)[number];

export type MapeamentoExtrato = {
  date: number;
  description: number;
  amount: number;
};

export type Conta = {
  id: string;
  name: string;
};

export type LinhaExtrato = {
  line: number;
  date: string | null;
  description: string;
  cents: number | null;
  error: string;
};

export type PedidoOrganizarExtrato = {
  tenantId: string;
  filename: string;
  mediaType: string;
  content: string;
  apiKey?: string;
  model?: string;
  /** Provedor no formato da OpenAI fora da OpenAI (OpenRouter, Ollama...). */
  baseUrl?: string;
};

export type Extrato = {
  id: string;
  filename: string;
  format: FormatoExtrato;
  accountId: string;
  accountName: string;
  startDate: string | null;
  endDate: string | null;
  lineCount: number;
  errorCount: number;
  status: StatusExtrato;
  message: string;
  importedAt: string;
};

export type ExtratosResposta = {
  accounts: Conta[];
  statements: Extrato[];
};

export type PreviaExtrato = {
  format: FormatoExtrato;
  columns: string[];
  mapping: MapeamentoExtrato | null;
  lines: LinhaExtrato[];
};

export type LinhasExtrato = {
  lines: LinhaExtrato[];
  total: number;
  matched: number;
};

export type ValorDoMes = "extrato" | "lancamento";

export type VinculoCruzado = {
  entryId: string;
  description: string;
  groupName: string;
  sessionName: string;
  day: number;
  cents: number;
  category: CategoriaTransacao;
};

export type LinhaConferencia = {
  statementId: string;
  line: number;
  date: string;
  description: string;
  cents: number;
  accountName: string;
  filename: string;
  entryId: string | null;
  link: VinculoCruzado | null;
  suggestion: VinculoCruzado | null;
  suggestionSource: OrigemDaProposta | null;
  candidates: VinculoCruzado[];
  sessionId: string | null;
  // De onde veio a sessão sugerida: do nome já lançado antes ou do compromisso que cai no dia da linha.
  sessionSource: OrigemDaSessao | null;
  appointmentTitle: string | null;
};

export type OrigemDaProposta = "nome" | "valor";

export type OrigemDaSessao = "nome" | "compromisso";

/** Linhas sem lançamento que a conferência entrega por página ao consultor. A tela pede o mês inteiro. */
export const LINHAS_DA_CONFERENCIA_POR_PAGINA = 10;

export type ConferenciaResposta = {
  year: number;
  month: number;
  pending: number;
  // O mês só está conferido quando há linhas e todas têm lançamento ou sessão.
  checked: boolean;
  lines: LinhaConferencia[];
  page?: { number: number; size: number; total: number };
};

export type FalhaDeAcumulo = {
  statementId: string;
  line: number;
  message: string;
};

export type AcumuloEmLote = {
  launched: number;
  failed: FalhaDeAcumulo[];
};

export type Meta = {
  id: string;
  name: string;
  targetCents: number;
  /** Com sessão, é o que a sessão da meta acumulou (lançamentos de saída, lidos como positivo). */
  savedCents: number;
  dueYear: number | null;
  dueMonth: number | null;
  /** A sessão do grupo "Metas" que guarda o valor separado; null nas metas criadas antes dela existir. */
  sessionId: string | null;
  /** A ordem de prioridade que a pessoa escolheu: 1 é a primeira a receber da sobra. */
  position: number;
};

/** O grupo que recebe uma sessão por meta. */
export const GRUPO_DAS_METAS = "Metas";

/** A parte da sobra do mês que a pessoa reservou para uma meta, e se já aprovou. */
export type DivisaoDaMeta = {
  /** De 0 a 100: a porcentagem da sobra do mês. */
  percent: number;
  /** Pendente: porcentagem da sobra de hoje. Aprovada: o valor que foi separado. */
  cents: number;
  approved: boolean;
};

export type MetasResposta = {
  goals: Meta[];
  /** A sobra do mês antes das metas: o que as metas disputam. */
  surplusCents: number;
  /** O que as metas já separaram neste mês (saída lançada nas sessões delas). */
  separatedCents: number;
  /** Quanto cada meta pede da sobra deste mês, pela prioridade. */
  suggested: Record<string, number>;
  /** A divisão da sobra deste mês que a pessoa escolheu, por meta. Meta sem divisão não aparece. */
  division: Record<string, DivisaoDaMeta>;
  year: number;
  month: number;
};

/**
 * As metas têm prioridade na sobra do mês, na ordem que a pessoa escolheu: a primeira recebe antes, cada uma até o
 * que precisa (a parcela por mês, ou o que falta se não há prazo). A alcançada não pede nada.
 */
export function alocarSobra(
  metas: Pick<Meta, "id" | "name" | "targetCents" | "savedCents" | "dueYear" | "dueMonth" | "position">[],
  hoje: { year: number; month: number },
  sobra: number,
): Record<string, number> {
  let resta = Math.max(sobra, 0);
  const pedido: Record<string, number> = {};
  const ordem = [...metas].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"));
  for (const meta of ordem) {
    const calculo = calcularMeta(meta, hoje, sobra);
    const precisa = calculo.alcancada ? 0 : (calculo.porMes ?? calculo.falta);
    const parte = Math.min(precisa, resta);
    pedido[meta.id] = parte;
    resta -= parte;
  }
  return pedido;
}

export type CalculoMeta = {
  falta: number;
  mesesNoPrazo: number | null;
  porMes: number | null;
  mesesNaSobra: number | null;
  prazoPassou: boolean;
  alcancada: boolean;
};

export function calcularMeta(
  meta: Pick<Meta, "targetCents" | "savedCents" | "dueYear" | "dueMonth">,
  hoje: { year: number; month: number },
  sobraMensal: number,
): CalculoMeta {
  const falta = Math.max(meta.targetCents - meta.savedCents, 0);
  let mesesNoPrazo: number | null = null;
  let prazoPassou = false;
  if (meta.dueYear !== null && meta.dueMonth !== null) {
    const meses = (meta.dueYear - hoje.year) * 12 + (meta.dueMonth - hoje.month) + 1;
    if (meses < 1) prazoPassou = true;
    else mesesNoPrazo = meses;
  }
  return {
    falta,
    mesesNoPrazo,
    porMes: mesesNoPrazo !== null && falta > 0 ? Math.ceil(falta / mesesNoPrazo) : null,
    mesesNaSobra: sobraMensal > 0 && falta > 0 ? Math.ceil(falta / sobraMensal) : null,
    prazoPassou,
    alcancada: falta === 0,
  };
}

export type RelatorioMes = {
  month: number;
  entradas: number;
  saidas: number;
  sobra: number;
};

export type RelatorioGrupo = {
  groupId: string;
  name: string;
  entradas: number;
  saidas: number;
  sobra: number;
};

export type RelatorioTipo = {
  type: TipoLancamento;
  entradas: number;
  saidas: number;
  sobra: number;
};

export type RelatorioResposta = {
  year: number;
  workflow: Workflow;
  entradas: number;
  saidas: number;
  sobra: number;
  months: RelatorioMes[];
  groups: RelatorioGrupo[];
  types: RelatorioTipo[];
};

export function montarRelatorio(
  entries: Lancamento[],
  workflow: Workflow,
  year: number,
): RelatorioResposta | null {
  const colunas = colunasDoAno(workflow, year);
  if (colunas.length === 0) return null;

  const months = colunas.map((monthIndex) => ({
    month: monthIndex + 1,
    ...totaisDoMes(entries, workflow, year, monthIndex),
  }));
  const entradas = months.reduce((total, mes) => total + mes.entradas, 0);
  const saidas = months.reduce((total, mes) => total + mes.saidas, 0);
  const grupos = new Map<string, RelatorioGrupo>();
  const tipos = new Map<TipoLancamento, RelatorioTipo>();

  for (const monthIndex of colunas) {
    for (const entry of entries) {
      const valor = centavosNoMes(entry, workflow, year, monthIndex);
      if (valor === undefined || valor === 0) continue;
      const grupo = grupos.get(entry.groupId) ?? {
        groupId: entry.groupId,
        name: entry.groupName,
        entradas: 0,
        saidas: 0,
        sobra: 0,
      };
      const tipo = tipos.get(entry.type) ?? {
        type: entry.type,
        entradas: 0,
        saidas: 0,
        sobra: 0,
      };
      if (valor > 0) {
        grupo.entradas += valor;
        tipo.entradas += valor;
      } else {
        grupo.saidas += valor;
        tipo.saidas += valor;
      }
      grupo.sobra = grupo.entradas + grupo.saidas;
      tipo.sobra = tipo.entradas + tipo.saidas;
      grupos.set(entry.groupId, grupo);
      tipos.set(entry.type, tipo);
    }
  }

  return {
    year,
    workflow,
    entradas,
    saidas,
    sobra: entradas + saidas,
    months,
    groups: [...grupos.values()].sort(
      (a, b) => a.saidas - b.saidas || a.name.localeCompare(b.name, "pt"),
    ),
    types: TIPOS_LANCAMENTO.flatMap((type) => {
      const item = tipos.get(type);
      return item ? [item] : [];
    }),
  };
}

export const ESCOPOS_PAINEL = ["dia", "mes", "ano"] as const;

export type EscopoPainel = (typeof ESCOPOS_PAINEL)[number];

export type ItemPainel = {
  id: string;
  kind: "compromisso" | "lancamento";
  year: number;
  month: number;
  day: number;
  time: string | null;
  title: string;
  detail: string;
  cents: number | null;
};

export type MesPainel = {
  month: number;
  entradas: number;
  saidas: number;
  sobra: number;
  compromissos: number;
  lancamentos: number;
};

export type PainelResposta = {
  scope: EscopoPainel;
  year: number;
  month: number | null;
  day: number | null;
  entradas: number;
  saidas: number;
  sobra: number;
  compromissos: number;
  lancamentos: number;
  items: ItemPainel[];
  months: MesPainel[];
  avisos: Aviso[];
  // Linhas de extrato do período sem lançamento. O dinheiro delas ainda não entrou nos totais.
  semConferir: number;
};

export type Aviso = {
  id: string;
  kind: "lembrete" | "vencimento";
  title: string;
  at: string;
};

const ANTECEDENCIA_MS: Record<Lembrete, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

export function propostaNoPrazo(importedAt: string, pendingHours: number, agora = new Date()) {
  const inicio = Date.parse(importedAt);
  if (Number.isNaN(inicio)) return false;
  return agora.getTime() - inicio <= pendingHours * 60 * 60 * 1000;
}

export function avisosDe(
  prefs: Pick<Preferencias, "reminders" | "reminder" | "dueAlerts" | "appAlerts">,
  compromissos: Compromisso[],
  entries: Lancamento[],
  agora = new Date(),
): Aviso[] {
  if (!prefs.appAlerts) return [];
  const avisos: Aviso[] = [];
  if (prefs.reminders) {
    const janela = ANTECEDENCIA_MS[prefs.reminder];
    const agoraMs = agora.getTime();
    for (const item of compromissos) {
      if (item.status === "done") continue;
      const inicio = Date.parse(item.startAt);
      if (Number.isNaN(inicio)) continue;
      const falta = inicio - agoraMs;
      if (falta < 0 || falta > janela) continue;
      avisos.push({
        id: `lembrete:${item.id}:${item.startAt}`,
        kind: "lembrete",
        title: item.title,
        at: item.startAt,
      });
    }
  }
  if (prefs.dueAlerts) {
    const hoje = diaLocal(agora);
    for (const entry of entries) {
      for (const ocorrencia of ocorrenciasDoLancamento(entry)) {
        if (ocorrencia.status !== "pending" || ocorrencia.dueDate !== hoje) continue;
        avisos.push({
          id: `vencimento:${entry.id}:${ocorrencia.number}`,
          kind: "vencimento",
          title: entry.description || entry.sessionName,
          at: ocorrencia.dueDate,
        });
      }
    }
  }
  return avisos;
}

export function montarPainel(
  scope: EscopoPainel,
  year: number,
  month: number | null,
  day: number | null,
  workflow: Workflow,
  entries: Lancamento[],
  appointments: Compromisso[],
): Omit<PainelResposta, "semConferir"> {
  const meses = scope === "ano" ? Array.from({ length: 12 }, (_, indice) => indice + 1) : [month ?? 1];
  const items: ItemPainel[] = [];
  const months: MesPainel[] = [];
  let entradas = 0;
  let saidas = 0;
  let compromissos = 0;
  let lancamentos = 0;

  const colunas = new Set(colunasDoAno(workflow, year));
  for (const mes of meses) {
    const ultimo = new Date(year, mes, 0).getDate();
    const visivel = colunas.has(mes - 1);
    let entradasMes = 0;
    let saidasMes = 0;
    let compromissosMes = 0;
    let lancamentosMes = 0;
    for (const entry of entries) {
      if (!visivel) continue;
      const cents = centavosNoMes(entry, workflow, year, mes - 1);
      if (cents === undefined) continue;
      const dia = Math.min(entry.day, ultimo);
      if (scope === "dia" && dia !== day) continue;
      lancamentosMes += 1;
      if (cents > 0) entradasMes += cents;
      else saidasMes += cents;
      if (scope !== "ano") {
        items.push({
          id: entry.id,
          kind: "lancamento",
          year,
          month: mes,
          day: dia,
          time: null,
          title: entry.description,
          detail: `${entry.groupName} · ${entry.sessionName}`,
          cents,
        });
      }
    }
    for (const compromisso of appointments) {
      if (compromisso.year !== year || compromisso.month !== mes) continue;
      if (scope === "dia" && compromisso.day !== day) continue;
      compromissosMes += 1;
      if (scope !== "ano") {
        items.push({
          id: `${compromisso.id}-${year}-${mes}-${compromisso.day}`,
          kind: "compromisso",
          year,
          month: mes,
          day: compromisso.day,
          time: compromisso.time,
          title: compromisso.title,
          detail: compromisso.calendar,
          cents: compromisso.link?.cents ?? null,
        });
      }
    }
    entradas += entradasMes;
    saidas += saidasMes;
    compromissos += compromissosMes;
    lancamentos += lancamentosMes;
    if (scope === "ano") {
      months.push({
        month: mes,
        entradas: entradasMes,
        saidas: saidasMes,
        sobra: entradasMes + saidasMes,
        compromissos: compromissosMes,
        lancamentos: lancamentosMes,
      });
    }
  }

  items.sort(
    (a, b) =>
      a.day - b.day ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.title.localeCompare(b.title, "pt"),
  );

  return {
    scope,
    year,
    month: scope === "ano" ? null : month,
    day: scope === "dia" ? day : null,
    entradas,
    saidas,
    sobra: entradas + saidas,
    compromissos,
    lancamentos,
    items,
    months,
    avisos: [],
  };
}

export const CATEGORIAS_EVENTO = [
  {
    code: "financeiro",
    name: "Financeiro",
    description: "Lançamentos, sessões, grupos, metas e feriados",
    active: true,
  },
  {
    code: "agenda",
    name: "Agenda",
    description: "Compromissos e a agenda",
    active: true,
  },
  {
    code: "extratos",
    name: "Extratos",
    description: "Importação, leitura e cruzamento de extratos",
    active: true,
  },
  {
    code: "agente",
    name: "Agente",
    description: "Conversas e mensagens do assistente de IA",
    active: true,
  },
  {
    code: "configuracoes",
    name: "Configurações",
    description: "Preferências, IA, dados e a conexão com o Google",
    active: true,
  },
  {
    code: "conta",
    name: "Conta",
    description: "Acesso, senha, perfil e usuários",
    active: true,
  },
  {
    code: "sistema",
    name: "Sistema",
    description: "Rotinas e falhas internas",
    active: false,
  },
] as const;

export type CodigoCategoriaEvento = (typeof CATEGORIAS_EVENTO)[number]["code"];

const CODIGOS_CATEGORIA_EVENTO = CATEGORIAS_EVENTO.map((item) => item.code) as [
  CodigoCategoriaEvento,
  ...CodigoCategoriaEvento[],
];

export const STATUS_EVENTO = ["pendente", "processando", "concluído", "com falha"] as const;

export type StatusEvento = (typeof STATUS_EVENTO)[number];

export const RESULTADOS_HISTORICO = ["sucesso", "falha", "iniciado"] as const;

export type ResultadoHistorico = (typeof RESULTADOS_HISTORICO)[number];

export type Evento = {
  id: string;
  type: string;
  category: CodigoCategoriaEvento;
  origin: string;
  aggregate: string;
  status: StatusEvento;
  occurredAt: string;
  /** Quando a fila publicou o evento; null enquanto está pendente. */
  publishedAt: string | null;
  /** Quando o consumidor processou; null enquanto não processou. */
  consumedAt: string | null;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string;
  schemaVersion: number;
  payload: unknown;
};

export type HistoricoEvento = {
  eventId: string;
  eventType: string;
  consumer: string;
  result: ResultadoHistorico;
  attempt: number;
  durationMs: number | null;
  occurredAt: string;
  error: string;
};

export type Paginacao = {
  /** A página atual, a partir de 1. */
  number: number;
  size: number;
  /** Quantos itens os filtros encontram, somando todas as páginas. */
  total: number;
};

export type VolumeDeEventosNoDia = { date: string; total: number; status: Record<StatusEvento, number> };

/**
 * Uma página da lista de eventos. Cada contagem ignora o próprio filtro (a de categoria ignora a categoria
 * escolhida; a de status, o status), para mostrar quanto há em cada opção. O volume ignora o dia.
 */
export type PaginaDeEventos = {
  categories: Array<(typeof CATEGORIAS_EVENTO)[number]>;
  /** O fuso da conta: as datas da tela e o volume por dia seguem ele. */
  timezone: string;
  /** Hoje no fuso da conta (AAAA-MM-DD). */
  today: string;
  events: Evento[];
  page: Paginacao;
  counts: { categories: Record<CodigoCategoriaEvento, number>; status: Record<StatusEvento, number> };
  volume: VolumeDeEventosNoDia[];
};

export type PaginaDoHistorico = {
  timezone: string;
  today: string;
  /** Até quando o histórico volta, pela preferência da conta. */
  retention: Retencao;
  history: HistoricoEvento[];
  page: Paginacao;
};

export type DetalheDoEvento = { timezone: string; event: Evento; history: HistoricoEvento[] };

export const EVENTOS_POR_PAGINA = 50;

export const DIAS_DO_VOLUME_DE_EVENTOS = 30;

const paginaPedida = z.coerce.number().int().min(1).max(100_000).catch(1);
const buscaPedida = z
  .string()
  .catch("")
  .transform((texto) => texto.trim().slice(0, 120));

/** Os filtros da lista de eventos, vindos da URL ou da query. Valor inválido vira o padrão, sem erro. */
export const ESQUEMA_FILTRO_DE_EVENTOS = z.object({
  pagina: paginaPedida,
  categoria: z.enum(CODIGOS_CATEGORIA_EVENTO).nullable().catch(null),
  status: z.enum(STATUS_EVENTO).nullable().catch(null),
  q: buscaPedida,
  dia: z.iso.date().nullable().catch(null),
});

export type FiltroDeEventos = z.infer<typeof ESQUEMA_FILTRO_DE_EVENTOS>;

export const ESQUEMA_FILTRO_DO_HISTORICO = z.object({
  pagina: paginaPedida,
  resultado: z.enum(RESULTADOS_HISTORICO).nullable().catch(null),
  q: buscaPedida,
});

export type FiltroDoHistorico = z.infer<typeof ESQUEMA_FILTRO_DO_HISTORICO>;

/** Uma linha da outbox, com o momento em que foi consumida. */
export type LinhaOutbox = {
  id: string;
  operation: string;
  idempotencyKey: string;
  payload: string;
  occurredAt: string;
  publishedAt: string | null;
  consumedAt: string | null;
};

type InfoDaOperacao = { category: CodigoCategoriaEvento; aggregate: string };

function grupo(category: CodigoCategoriaEvento, aggregate: string, operacoes: string[]) {
  return operacoes.map((operation): [string, InfoDaOperacao] => [operation, { category, aggregate }]);
}

// Cada operação que vai para a outbox, com a categoria e o nome do agregado. Operação nova que não entrar
// aqui aparece como "Sistema · Registro".
const INFO_DA_OPERACAO = new Map<string, InfoDaOperacao>([
  ...grupo("financeiro", "Fluxo", ["definir-workflow"]),
  ...grupo("financeiro", "Lançamento", [
    "criar-lancamento",
    "atualizar-lancamento",
    "excluir-lancamento",
    "atualizar-status-lancamento",
    "associar-compromisso",
    "adiantar-parcelas",
    "cancelar-parcelas",
    "adiantar-emprestimo",
    "cancelar-emprestimo",
    "cancelar-fixo",
    "suspender-fixo",
    "atualizar-valor-fixo",
    "atualizar-ocorrencia",
    "excluir-ocorrencia",
    "redatar-vencimentos",
  ]),
  ...grupo("financeiro", "Grupo", ["criar-grupo", "atualizar-grupo", "remover-grupo", "permanecer-ano"]),
  ...grupo("financeiro", "Sessão", ["criar-sessao", "atualizar-sessao", "encerrar-sessao", "remover-sessao"]),
  ...grupo("financeiro", "Meta", ["criar-meta", "excluir-meta", "reordenar-metas", "dividir-sobra-das-metas", "aprovar-sobra-da-meta"]),
  ...grupo("financeiro", "Feriado", ["criar-feriado-local", "remover-feriado-local"]),
  ...grupo("agenda", "Compromisso", [
    "criar-compromisso",
    "atualizar-compromisso",
    "excluir-compromisso",
    "atualizar-status-compromisso",
  ]),
  ...grupo("agenda", "Calendário", ["sincronizar-google-agenda", "atualizar-fuso-calendario"]),
  ...grupo("agenda", "Configurações", ["atualizar-fuso"]),
  ...grupo("extratos", "Extrato", ["importar-extrato", "reprocessar-extrato", "excluir-extrato", "associar-nome-extrato"]),
  ...grupo("extratos", "Linha de extrato", ["cruzar-linha", "desfazer-cruzamento"]),
  ...grupo("extratos", "Lançamento", ["pagar-pelo-extrato"]),
  ...grupo("agente", "Conversa", [
    "criar-conversa",
    "renomear-conversa",
    "remover-conversa",
    "remover-conversas",
    "expirar-conversas",
  ]),
  ...grupo("agente", "Mensagem", ["registrar-mensagem-do-assistente"]),
  ...grupo("configuracoes", "Configurações", [
    "salvar-configuracoes",
    "iniciar-google",
    "conectar-google",
    "desconectar-google",
  ]),
  ...grupo("configuracoes", "Assistente de IA", ["salvar-assistente-de-ia"]),
  ...grupo("configuracoes", "Provedor de IA", ["criar-provedor-de-ia", "atualizar-provedor-de-ia", "remover-provedor-de-ia"]),
  ...grupo("configuracoes", "Dados", ["importar-dados", "zerar-dados"]),
  ...grupo("conta", "Acesso", [
    "abrir-sessao",
    "encerrar-sessao-de-acesso",
    "encerrar-outras-sessoes",
    "registrar-falha-de-acesso",
    "zerar-falhas-de-acesso",
    "bloquear-conta",
    "trocar-senha",
  ]),
  ...grupo("conta", "Perfil", ["atualizar-perfil"]),
  ...grupo("conta", "Usuário", ["criar-usuario", "remover-usuario"]),
]);

const VINDAS_DA_IMPORTACAO = new Set(["importar-extrato", "reprocessar-extrato"]);

export const CATEGORIA_DE_OPERACAO_DESCONHECIDA: CodigoCategoriaEvento = "sistema";
export const AGREGADO_DE_OPERACAO_DESCONHECIDA = "Registro";
export const ORIGEM_PADRAO_DO_EVENTO = "sistema";

function origemDe(operation: string) {
  return VINDAS_DA_IMPORTACAO.has(operation) ? "importação" : ORIGEM_PADRAO_DO_EVENTO;
}

/**
 * As operações conhecidas, para o banco filtrar e buscar pelo mesmo critério da tela: a busca acha o texto no
 * tipo, no nome do agregado ou na origem; e, quando o texto parece começo de id, o id do evento ou do agregado.
 */
export const OPERACOES_DE_EVENTO: ReadonlyArray<InfoDaOperacao & { operation: string; origin: string }> = [
  ...INFO_DA_OPERACAO,
].map(([operation, info]) => ({ operation, ...info, origin: origemDe(operation) }));

/** Os campos do payload que dão o id do agregado, na ordem em que valem. */
export const CAMPOS_DO_ID_DO_AGREGADO = ["id", "statementId", "userId"] as const;

/** Quem consome o evento hoje: a publicação da outbox. */
export const CONSUMIDOR_DA_OUTBOX = "Publicar outbox";

/** O status pelo andamento na fila. O banco usa os mesmos nomes para filtrar e contar. */
export const STATUS_DA_LINHA = {
  semPublicar: "pendente",
  semConsumir: "processando",
  consumida: "concluído",
} as const satisfies Record<string, StatusEvento>;

export function statusDaLinha(linha: Pick<LinhaOutbox, "publishedAt" | "consumedAt">): StatusEvento {
  if (!linha.publishedAt) return STATUS_DA_LINHA.semPublicar;
  return linha.consumedAt ? STATUS_DA_LINHA.consumida : STATUS_DA_LINHA.semConsumir;
}

/** O evento da tela a partir da linha da outbox. O payload sai com os campos sensíveis mascarados. */
export function eventoDaLinha(linha: LinhaOutbox): Evento {
  const bruto = lerJson(linha.payload);
  const info = INFO_DA_OPERACAO.get(linha.operation);
  return {
    id: linha.id,
    type: linha.operation,
    category: info?.category ?? CATEGORIA_DE_OPERACAO_DESCONHECIDA,
    origin: origemDe(linha.operation),
    aggregate: agregadoDe(info?.aggregate ?? AGREGADO_DE_OPERACAO_DESCONHECIDA, bruto),
    status: statusDaLinha(linha),
    occurredAt: linha.occurredAt,
    publishedAt: linha.publishedAt,
    consumedAt: linha.consumedAt,
    correlationId: null,
    causationId: null,
    idempotencyKey: linha.idempotencyKey,
    schemaVersion: 1,
    payload: mascararValor(bruto),
  };
}

/** O processamento do evento: hoje é um passo só, a publicação da outbox, quando ela foi consumida. */
export function historicoDoEvento(evento: Evento): HistoricoEvento[] {
  if (!evento.consumedAt) return [];
  const publicado = evento.publishedAt ? Date.parse(evento.publishedAt) : Number.NaN;
  const consumido = Date.parse(evento.consumedAt);
  return [
    {
      eventId: evento.id,
      eventType: evento.type,
      consumer: CONSUMIDOR_DA_OUTBOX,
      result: "sucesso",
      attempt: 1,
      durationMs: Number.isNaN(publicado) || Number.isNaN(consumido) ? null : Math.max(0, consumido - publicado),
      occurredAt: evento.consumedAt,
      error: "",
    },
  ];
}

function agregadoDe(nome: string, payload: unknown) {
  if (!payload || typeof payload !== "object") return nome;
  const registro = payload as Record<string, unknown>;
  const campo = CAMPOS_DO_ID_DO_AGREGADO.find((chave) => typeof registro[chave] === "string" && registro[chave]);
  return campo ? `${nome} · ${String(registro[campo])}` : nome;
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return {};
  }
}

function mascararValor(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(mascararValor);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        sensivel(chave) ? "••••" : mascararValor(item),
      ]),
    );
  }
  if (typeof valor === "string" && /^\d{6,}$/.test(valor)) return "••••";
  return valor;
}

function sensivel(chave: string) {
  return (
    /(token|senha|password|secret|authorization|cpf|apikey|api_key|chave)/i.test(chave) ||
    /^(conta|account|cartao|cartão)$/i.test(chave)
  );
}

export const SENHA_MINIMA = 10;
export const SENHA_MAXIMA = 128;

export const PAPEIS = ["master", "membro"] as const;

export type PapelDoUsuario = (typeof PAPEIS)[number];

export type UsuarioDaConta = {
  id: string;
  name: string;
  email: string;
  /** Cada conta tem um só master. Os demais usuários são membros. */
  role: PapelDoUsuario;
  /** Só vem como `true` no ambiente de desenvolvimento, quando o login foi dispensado. */
  semLogin?: boolean;
};

// Cores do avatar: cada uma é um par de tokens da interface (fundo e texto). O avatar mostra as iniciais.
export const TONS_DO_AVATAR = ["brand", "event", "pos", "pending", "neg", "cta", "ink"] as const;

export type TomDoAvatar = (typeof TONS_DO_AVATAR)[number];

export const LIMITES_DO_PERFIL = { name: 80, headline: 80, location: 80, bio: 240 } as const;

/** O perfil é de cada usuário, não da conta: dois usuários do mesmo tenant têm perfis diferentes. */
export type PerfilDoUsuario = UsuarioDaConta & {
  headline: string;
  location: string;
  bio: string;
  avatarTone: TomDoAvatar;
  /** Vazio só para quem entrou sem login em desenvolvimento, que não tem linha na tabela. */
  createdAt: string | null;
};

export type DadosDoPerfil = Pick<PerfilDoUsuario, "name" | "headline" | "location" | "bio" | "avatarTone">;

export type SessaoDeAcesso = {
  /** Começo do identificador, só para a lista. Não serve para encerrar a sessão. */
  ref: string;
  device: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export type SessoesDoUsuario = { sessions: SessaoDeAcesso[] };

/** O que o backend devolve ao entrar ou cadastrar. O token para no BFF; o navegador recebe só `{ user }`. */
export type SessaoAberta = {
  token: string;
  expiresAt: string;
  user: UsuarioDaConta;
};

export const AMBIENTES = ["production", "development"] as const;

export type Ambiente = (typeof AMBIENTES)[number];

type Variaveis = Record<string, string | undefined>;

/** Só o valor `development` liga o modo de desenvolvimento. A falta da variável vale como produção. */
export function ambienteDe(env: Variaveis): Ambiente {
  return env.APP_ENV?.trim().toLowerCase() === "development" ? "development" : "production";
}

/** O Railway injeta estas variáveis em todo serviço; a máquina local não tem nenhuma delas. */
export function estaNoRailway(env: Variaveis) {
  return Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID);
}

/**
 * O login só é dispensado em desenvolvimento e fora do Railway. Se alguém colocar
 * `APP_ENV=development` no painel do Railway por engano, o login continua exigido.
 */
export function loginDispensado(env: Variaveis) {
  return ambienteDe(env) === "development" && !estaNoRailway(env);
}

// ─── Assistente de IA ────────────────────────────────────────────────────────────────────────────
// Provedores, agentes, configuração, mensagens do chat e o catálogo de ferramentas. O catálogo é a
// lista fechada do que a IA pode fazer: o backend só executa o que está aqui, com a sessão de quem pediu.

export const PROVEDORES_IA = ["openai", "anthropic", "google", "openai_compativel", "ollama"] as const;

export type ProvedorIa = (typeof PROVEDORES_IA)[number];

export type InfoDoProvedor = {
  nome: string;
  descricao: string;
  precisaChave: boolean;
  precisaUrl: boolean;
  urlPadrao: string;
  /** Lê foto e PDF de extrato. Só os provedores no formato da OpenAI, por enquanto. */
  leExtratos: boolean;
  dicaDaChave: string;
};

export const INFO_DOS_PROVEDORES: Record<ProvedorIa, InfoDoProvedor> = {
  openai: {
    nome: "OpenAI",
    descricao: "Modelos GPT, direto na API da OpenAI.",
    precisaChave: true,
    precisaUrl: false,
    urlPadrao: "",
    leExtratos: true,
    dicaDaChave: "Gere em platform.openai.com, em API keys.",
  },
  anthropic: {
    nome: "Anthropic",
    descricao: "Modelos Claude, direto na API da Anthropic.",
    precisaChave: true,
    precisaUrl: false,
    urlPadrao: "",
    leExtratos: false,
    dicaDaChave: "Gere em console.anthropic.com, em API keys.",
  },
  google: {
    nome: "Google Gemini",
    descricao: "Modelos Gemini, pelo Google AI Studio.",
    precisaChave: true,
    precisaUrl: false,
    urlPadrao: "",
    leExtratos: false,
    dicaDaChave: "Gere em aistudio.google.com, em Get API key.",
  },
  openai_compativel: {
    nome: "Compatível com OpenAI",
    descricao: "OpenRouter, Groq, Mistral, DeepSeek, Together, xAI ou qualquer API no formato da OpenAI.",
    precisaChave: true,
    precisaUrl: true,
    urlPadrao: "https://openrouter.ai/api/v1",
    leExtratos: true,
    dicaDaChave: "A chave do serviço escolhido.",
  },
  ollama: {
    nome: "Ollama",
    descricao: "Modelos rodando no seu computador ou num servidor seu.",
    precisaChave: false,
    precisaUrl: true,
    urlPadrao: "http://host.docker.internal:11434/v1",
    leExtratos: true,
    dicaDaChave: "",
  },
};

export const AGENTES_IA = ["coordenador", "financas", "agenda", "organizacao", "metas", "extratos", "analise"] as const;

export type AgenteIa = (typeof AGENTES_IA)[number];

export const ESPECIALISTAS_IA = ["financas", "agenda", "organizacao", "metas", "extratos", "analise"] as const;

export type EspecialistaIa = (typeof ESPECIALISTAS_IA)[number];

export const INFO_DOS_AGENTES: Record<AgenteIa, { nome: string; resumo: string }> = {
  // O assistente é um agente só: o consultor entende, propõe o plano e executa. Os demais nomes ficam para as
  // conversas antigas, que guardaram o especialista em cada mensagem.
  coordenador: { nome: "Consultor", resumo: "Entende o pedido, propõe o plano e executa depois da sua aprovação." },
  financas: { nome: "Finanças", resumo: "Lançamentos, parcelas, empréstimos, fixos e pagamentos." },
  agenda: { nome: "Agenda", resumo: "Compromissos e a sincronização com o Google Calendar." },
  organizacao: { nome: "Organização", resumo: "Grupos, sessões e a virada do ano." },
  metas: { nome: "Metas", resumo: "Metas de economia, valores e prazos." },
  extratos: { nome: "Extratos", resumo: "Conferência e cruzamento das linhas importadas." },
  analise: { nome: "Análise", resumo: "Responde perguntas com o painel, os relatórios e o histórico." },
};

/** Cada função pode usar um modelo próprio. `leitor` é a leitura de extrato por foto ou PDF. */
export const FUNCOES_DE_MODELO = [...AGENTES_IA, "leitor"] as const;

export type FuncaoDeModelo = (typeof FUNCOES_DE_MODELO)[number];

export const INFO_DA_LEITURA = {
  nome: "Leitura de extratos",
  resumo: "Lê a foto ou o PDF do extrato e transforma em linhas.",
};

export const LIMITE_MODELOS_POR_PROVEDOR = 40;
export const LIMITE_INSTRUCOES_IA = 2000;
export const LIMITE_MENSAGEM_DO_CHAT = 4000;

export const PASSOS_DO_ASSISTENTE = [4, 8, 12] as const;

export type PassosDoAssistente = (typeof PASSOS_DO_ASSISTENTE)[number];

export const CRIATIVIDADES = ["precisa", "equilibrada", "criativa"] as const;

export type Criatividade = (typeof CRIATIVIDADES)[number];

export function temperaturaDa(criatividade: Criatividade) {
  return criatividade === "precisa" ? 0 : criatividade === "equilibrada" ? 0.4 : 0.8;
}

export const RETENCOES_DO_CHAT = ["30d", "90d", "1a", "sempre"] as const;

export type RetencaoDoChat = (typeof RETENCOES_DO_CHAT)[number];

export type EscolhaDeModelo = { providerId: string; model: string };

export type ProvedorConfigurado = {
  id: string;
  kind: ProvedorIa;
  label: string;
  baseUrl: string;
  models: string[];
  hasKey: boolean;
  updatedAt: string;
};

export type PedidoDeProvedor = {
  kind: ProvedorIa;
  label: string;
  /** Vazio mantém a chave já salva. */
  apiKey: string;
  limparChave: boolean;
  baseUrl: string;
  models: string[];
};

export type ComportamentoDoAssistente = {
  confirmarExclusao: boolean;
  maxPassos: PassosDoAssistente;
  criatividade: Criatividade;
  instrucoes: string;
  retencao: RetencaoDoChat;
};

export type ConfiguracaoDoAssistente = {
  padrao: EscolhaDeModelo | null;
  funcoes: Partial<Record<FuncaoDeModelo, EscolhaDeModelo | null>>;
  comportamento: ComportamentoDoAssistente;
};

export const COMPORTAMENTO_PADRAO: ComportamentoDoAssistente = {
  confirmarExclusao: true,
  maxPassos: 8,
  criatividade: "precisa",
  instrucoes: "",
  retencao: "1a",
};

export type ConfiguracaoDeIa = {
  provedores: ProvedorConfigurado[];
  assistente: ConfiguracaoDoAssistente;
  /** Só o master muda provedores e o comportamento do assistente. */
  podeEditar: boolean;
};

export type ResultadoDoTeste = { ok: boolean; models: string[]; message: string; ms: number };

// Mensagens do chat, como a tela mostra.

export type EstadoDaAcao = "executando" | "feita" | "falhou" | "cancelada";

export type AcaoDoAssistente = {
  id: string;
  ferramenta: string;
  rotulo: string;
  estado: EstadoDaAcao;
  detalhe: string;
};

export type OpcaoDaPergunta = { rotulo: string; descricao?: string };

/** Um passo do plano como a tela mostra: a frase e se apaga ou encerra algo. */
export type PassoDoPlano = { ferramenta: string; descricao: string; destrutiva: boolean };

/** As datas reais de um passo que lança dinheiro, já com fim de semana, feriado e regra de vencimento. */
export type FatoDoPasso = {
  /** O número do passo, a partir de 1. */
  passo: number;
  valorCents: number;
  recorrente: boolean;
  datas: Array<{ data: string; base: string; feriado: string | null }>;
  /** Qual valor do extrato vale no mês, quando a linha cruza com um lançamento. */
  nota?: string;
};

/** O que o sistema calcula sobre o plano, sem depender do modelo: datas, a sobra do mês e os alertas. */
export type FatosDoPlano = {
  mes: { ano: number; mes: number; sobraAntesCents: number; sobraDepoisCents: number } | null;
  passos: FatoDoPasso[];
  alertas: string[];
};

export type PlanoDoAssistente = {
  objetivo: string;
  entendimento: string;
  suposicoes: string[];
  passos: PassoDoPlano[];
  fatos: FatosDoPlano;
};

export const APROVAR_PLANO = "Aprovar e executar";
export const CANCELAR_PLANO = "Cancelar";

export type PerguntaDoAssistente = {
  id: string;
  /** plano: o consultor mostra o que vai fazer; nada muda no sistema antes da aprovação. */
  tipo: "pergunta" | "confirmacao" | "plano";
  texto: string;
  opcoes: OpcaoDaPergunta[];
  resposta: string | null;
  plano?: PlanoDoAssistente;
};

export type ParteDaMensagem =
  | { tipo: "texto"; texto: string }
  | { tipo: "acao"; acao: AcaoDoAssistente }
  | { tipo: "pergunta"; pergunta: PerguntaDoAssistente }
  | { tipo: "agente"; agente: AgenteIa };

export type MensagemDoChat = {
  id: string;
  role: "user" | "assistant";
  partes: ParteDaMensagem[];
  agente: AgenteIa | null;
  createdAt: string;
};

/** `emAndamento`: o servidor está respondendo nesta conversa agora, mesmo que a pessoa tenha saído da tela. */
export type ConversaResumo = { id: string; title: string; updatedAt: string; pendente: boolean; emAndamento?: boolean };

/** `emAndamento`: o servidor ainda está respondendo, mesmo que a tela tenha perdido a conexão. */
export type ConversaCompleta = ConversaResumo & { emAndamento: boolean; mensagens: MensagemDoChat[] };

export type PedidoDeMensagem = {
  conversationId: string | null;
  texto?: string;
  resposta?: { perguntaId: string; escolha: string };
};

/** O que o backend manda para a tela, uma linha JSON por evento, enquanto o assistente trabalha. */
export type EventoDoChat =
  | { tipo: "conversa"; conversa: ConversaResumo }
  | { tipo: "inicio"; usuario: MensagemDoChat | null; assistenteId: string }
  | { tipo: "agente"; agente: AgenteIa }
  | { tipo: "texto"; delta: string }
  | { tipo: "acao"; acao: AcaoDoAssistente }
  | { tipo: "pergunta"; pergunta: PerguntaDoAssistente }
  | { tipo: "resposta"; perguntaId: string; escolha: string }
  | { tipo: "fim"; mensagem: MensagemDoChat }
  | { tipo: "erro"; message: string };

// Conversa entre o backend (que orquestra e executa) e o agents (que raciocina).

export type ModeloResolvido = { kind: ProvedorIa; apiKey: string; baseUrl: string; model: string };

/** `idGerado`: o id que o passo de um plano dá ao que cria, para os passos seguintes apontarem para ele. */
export type ChamadaDeFerramenta = { id: string; nome: string; args: Record<string, unknown>; idGerado?: string };

export type MensagemDoModelo =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; agente: AgenteIa | null; toolCalls?: ChamadaDeFerramenta[] }
  | { role: "tool"; content: string; toolCallId: string; nome: string; agente: AgenteIa | null };

export type PedidoDePasso = {
  modelos: Partial<Record<AgenteIa, ModeloResolvido>>;
  temperatura: number;
  instrucoes: string;
  contexto: { hoje: string; usuario: string; fuso: string };
  mensagens: MensagemDoModelo[];
  agenteAtivo: EspecialistaIa | null;
};

/** Notas: encaminhamentos entre agentes neste passo, para o backend guardar no histórico do turno. */
export type EventoDoPasso =
  | { tipo: "agente"; agente: AgenteIa }
  | { tipo: "texto"; delta: string }
  | { tipo: "chamadas"; agente: AgenteIa; texto: string; chamadas: ChamadaDeFerramenta[]; notas: string[] }
  | { tipo: "resposta"; agente: AgenteIa; texto: string; notas: string[] }
  | { tipo: "erro"; message: string };

export type PedidoDeTesteDoProvedor = { kind: ProvedorIa; apiKey: string; baseUrl: string; model: string };

// Catálogo de ferramentas. Os nomes e os campos seguem a API, para o backend repassar sem traduzir.

const idDoSistema = z.uuid();
const dataDoSistema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data no formato AAAA-MM-DD.");
const anoDoSistema = z.number().int().min(2000).max(2100);
const mesDoSistema = z.number().int().min(1).max(12).describe("Mês de 1 a 12.");
const diaDoSistema = z.number().int().min(1).max(31);
const horaDoSistema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("Hora no formato HH:MM, 24 horas.");
const centavosPositivos = z
  .number()
  .int()
  .positive()
  .max(2_147_483_647)
  .describe("Valor em centavos, sempre positivo. R$ 12,50 vira 1250.");
const resumoDoQueApaga = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .describe("Em português, o que será apagado, para a pessoa confirmar. Ex.: 'o lançamento Aluguel de outubro'.");

const camposDoLancamento = z.object({
  sessionId: idDoSistema.describe(
    "Sessão onde o lançamento entra, com grupo e nome que combinam com o valor. Consulte com listar_grupos_e_sessoes; se nenhuma combinar, pergunte à pessoa antes.",
  ),
  name: z.string().trim().min(1).max(160).describe("Nome curto do lançamento, como 'Aluguel'."),
  description: z.string().trim().max(160).optional().describe("Detalhe opcional."),
  justification: z.string().trim().max(160).optional().describe("Por que existe. Se a pessoa não disser, deixe vazio."),
  date: dataDoSistema.describe("Data do lançamento (AAAA-MM-DD)."),
  mode: z.enum(MODOS_TRANSACAO).describe("inflows = entrada de dinheiro; outflows = saída."),
  category: z
    .enum(CATEGORIAS_TRANSACAO)
    .describe(
      "unique = única (avulsa); additional = extra (sempre entrada); installment = parcela (sempre saída, exige installments e installmentNumber); loan = empréstimo (exige installments, installmentNumber, dueDate e interestRate); fixed = fixa (recorrente, exige recurrence, recurrenceInterval e nextDueDate). Sessão do tipo 'valor' só aceita unique.",
    ),
  cents: centavosPositivos,
  status: z
    .enum(STATUS_TRANSACAO)
    .optional()
    .describe("pending = pendente (padrão); completed = paga; cancelled = cancelada; refunded = estornada."),
  priority: z.enum(PRIORIDADES_TRANSACAO).optional().describe("low, normal, high ou nopriority. Padrão: nopriority."),
  installments: z.number().int().min(1).max(360).optional().describe("Total de parcelas."),
  installmentNumber: z.number().int().min(1).max(360).optional().describe("Parcela atual."),
  dueDate: dataDoSistema.optional().describe("Vencimento do empréstimo."),
  interestRate: z.number().min(0).max(1000).optional().describe("Taxa de juros do empréstimo, em % ao mês."),
  nextDueDate: dataDoSistema.optional().describe("Próximo vencimento da fixa."),
  recurrence: z
    .enum(RECORRENCIAS)
    .optional()
    .describe("Recorrência da fixa: weekly, monthly, quarterly, semi_annual, annual ou customize."),
  recurrenceInterval: z.number().int().min(1).max(3660).optional().describe("Intervalo da recorrência. Mensal = 1."),
  dueRule: z
    .object({
      tipo: z
        .enum(["dia", "dia_util", "ultimo_dia_util"])
        .describe("dia = o dia da data; dia_util = o Nº dia útil do mês (ex.: 5º dia útil); ultimo_dia_util = último dia útil."),
      ordem: z.number().int().min(1).max(23).nullable().optional().describe("O N do Nº dia útil. Só com tipo dia_util."),
      ajuste: z
        .enum(["manter", "antecipar", "adiar", "adiar_no_mes"])
        .describe("Se o dia cair em fim de semana ou feriado: manter, antecipar, adiar ou adiar sem trocar de mês. Só com tipo dia."),
      contagem: z
        .enum(["bancaria", "clt"])
        .optional()
        .describe("bancaria = seg a sex (padrão); clt = o sábado conta, como no 5º dia útil do salário."),
    })
    .optional()
    .describe(
      "Só para fixa, parcela e empréstimo, quando a pessoa disser como cai em dia útil. Sem isso vale o padrão da conta. Ex.: salário no 5º dia útil = { tipo: dia_util, ordem: 5, ajuste: antecipar, contagem: clt }.",
    ),
});

const camposDoCompromisso = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  allDay: z.boolean().optional().describe("Dia inteiro. Sem hora, use true."),
  year: anoDoSistema,
  month: mesDoSistema,
  day: diaDoSistema,
  time: horaDoSistema.nullable().optional().describe("Hora de início. Obrigatória se não for o dia inteiro."),
  endTime: horaDoSistema.nullable().optional().describe("Hora de fim. Obrigatória se não for o dia inteiro."),
  calendar: z.enum(AGENDAS).describe("Agenda: Pessoal ou Trabalho."),
  category: z
    .enum(CATEGORIAS_COMPROMISSO)
    .describe("time = acontece uma vez; fixed = se repete todo mês no mesmo dia; periodical = vai de uma data até outra."),
  endYear: anoDoSistema.nullable().optional().describe("Fim do período (só periodical)."),
  endMonth: mesDoSistema.nullable().optional(),
  endDay: diaDoSistema.nullable().optional(),
  entryId: idDoSistema.nullable().optional().describe("Lançamento ligado a este compromisso, se houver."),
  sessionId: idDoSistema
    .nullable()
    .optional()
    .describe(
      "Sessão de acúmulo que soma os gastos pagos no dia do compromisso, se houver. Não é o valor do compromisso: valor é lançamento, de finanças.",
    ),
});

export type FerramentaDoAssistente = {
  nome: string;
  agentes: readonly EspecialistaIa[];
  descricao: string;
  /** Apaga ou encerra algo. O backend pede confirmação antes, se o comportamento mandar. */
  destrutiva: boolean;
  /** Só lê. */
  leitura: boolean;
  /** Mexe com dinheiro: a pessoa confirma antes, mesmo que o comportamento dispense a confirmação de exclusão. */
  exigeConfirmacao: boolean;
  esquema: z.ZodObject;
  /** Frase curta do que foi feito, para a tela. */
  rotulo: (args: Record<string, unknown>) => string;
};

function ferramenta<T extends z.ZodObject>(definicao: {
  nome: string;
  agentes: readonly EspecialistaIa[];
  descricao: string;
  destrutiva?: boolean;
  leitura?: boolean;
  exigeConfirmacao?: boolean;
  esquema: T;
  rotulo: (args: z.infer<T>) => string;
}): FerramentaDoAssistente {
  return {
    nome: definicao.nome,
    agentes: definicao.agentes,
    descricao: definicao.descricao,
    destrutiva: definicao.destrutiva ?? false,
    leitura: definicao.leitura ?? false,
    exigeConfirmacao: definicao.exigeConfirmacao ?? false,
    esquema: definicao.esquema,
    rotulo: (args) => definicao.rotulo(args as z.infer<T>),
  };
}

const vazio = z.object({});
const todosLeem = ["financas", "agenda", "organizacao", "metas", "extratos", "analise"] as const;
const entreAspas = (texto: unknown) => `“${String(texto ?? "").slice(0, 60)}”`;
const peloId = z.object({ id: idDoSistema });
const peloIdApagando = z.object({ id: idDoSistema, resumo: resumoDoQueApaga });

const ROTULO_DO_STATUS_PARA_ACAO: Record<StatusTransacao, string> = {
  pending: "Marcou o lançamento como pendente",
  completed: "Marcou o lançamento como pago",
  cancelled: "Cancelou o lançamento",
  refunded: "Marcou o lançamento como estornado",
};

export const FERRAMENTAS_DO_ASSISTENTE: FerramentaDoAssistente[] = [
  ferramenta({
    nome: "listar_grupos_e_sessoes",
    agentes: todosLeem,
    descricao: "Lista os grupos e as sessões, com ids, tipo e categorias aceitas. Use antes de lançar ou acumular.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou grupos e sessões",
  }),
  // Finanças
  ferramenta({
    nome: "consultar_lancamentos",
    agentes: ["financas", "analise", "extratos", "agenda"],
    descricao: "Busca lançamentos por período, grupo, categoria ou texto. Traz ids e valores.",
    leitura: true,
    esquema: z.object({
      year: anoDoSistema.optional(),
      month: mesDoSistema.optional(),
      day: diaDoSistema.optional(),
      groupId: idDoSistema.optional(),
      category: z.enum(CATEGORIAS_TRANSACAO).optional(),
      q: z.string().max(160).optional().describe("Texto para procurar no nome."),
    }),
    rotulo: (args) => (args.q ? `Procurou lançamentos com ${entreAspas(args.q)}` : "Consultou lançamentos"),
  }),
  ferramenta({
    nome: "consultar_mes_financeiro",
    agentes: ["financas", "analise"],
    descricao:
      "Resumo de um mês: entradas, saídas, sobra e os lançamentos com a situação de cada um. Mande o ano e o mês: para o mês de hoje, use a data que está no começo das instruções; para medir o efeito de um lançamento, o mês em que ele cai.",
    leitura: true,
    esquema: z.object({ year: anoDoSistema, month: mesDoSistema }),
    rotulo: () => "Consultou o mês financeiro",
  }),
  ferramenta({
    nome: "criar_lancamento",
    agentes: ["financas"],
    descricao: "Cria um lançamento (entrada ou saída) numa sessão.",
    esquema: camposDoLancamento,
    rotulo: (args) => `Criou o lançamento ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "editar_lancamento",
    agentes: ["financas"],
    descricao: "Edita um lançamento. Mande todos os campos, com os valores atuais nos que não mudam.",
    esquema: camposDoLancamento.extend({ id: idDoSistema }),
    rotulo: (args) => `Editou o lançamento ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "alterar_status_lancamento",
    agentes: ["financas"],
    descricao: "Marca o lançamento como pendente, pago, cancelado ou estornado.",
    esquema: z.object({ id: idDoSistema, status: z.enum(STATUS_TRANSACAO) }),
    rotulo: (args) => ROTULO_DO_STATUS_PARA_ACAO[args.status],
  }),
  ferramenta({
    nome: "atualizar_ocorrencia",
    agentes: ["financas"],
    descricao: "Muda uma ocorrência (parcela ou mês) de um lançamento: situação, vencimento ou valor previsto.",
    esquema: z.object({
      id: idDoSistema,
      number: z.number().int().min(1).describe("Número da ocorrência."),
      status: z.enum(STATUS_TRANSACAO).optional(),
      dueDate: dataDoSistema.optional(),
      plannedCents: z.number().int().optional().describe("Valor previsto em centavos."),
    }),
    rotulo: (args) => `Atualizou a ocorrência ${args.number}`,
  }),
  ferramenta({
    nome: "excluir_ocorrencia",
    agentes: ["financas"],
    descricao: "Apaga uma ocorrência de um lançamento.",
    destrutiva: true,
    esquema: z.object({ id: idDoSistema, number: z.number().int().min(1), resumo: resumoDoQueApaga }),
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "excluir_lancamento",
    agentes: ["financas"],
    descricao: "Apaga um lançamento.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "adiantar_parcelas",
    agentes: ["financas"],
    descricao: "Adianta as parcelas restantes de um parcelamento.",
    esquema: peloId,
    rotulo: () => "Adiantou as parcelas",
  }),
  ferramenta({
    nome: "cancelar_parcelas",
    agentes: ["financas"],
    descricao: "Cancela as parcelas restantes de um parcelamento.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Cancelou ${args.resumo}`,
  }),
  ferramenta({
    nome: "adiantar_emprestimo",
    agentes: ["financas"],
    descricao: "Quita adiantado o restante de um empréstimo.",
    esquema: peloId,
    rotulo: () => "Adiantou o empréstimo",
  }),
  ferramenta({
    nome: "cancelar_emprestimo",
    agentes: ["financas"],
    descricao: "Cancela o restante de um empréstimo.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Cancelou ${args.resumo}`,
  }),
  ferramenta({
    nome: "cancelar_fixo_no_mes",
    agentes: ["financas"],
    descricao: "Cancela uma fixa só em um mês.",
    destrutiva: true,
    esquema: z.object({ id: idDoSistema, year: anoDoSistema, month: mesDoSistema, resumo: resumoDoQueApaga }),
    rotulo: (args) => `Cancelou ${args.resumo}`,
  }),
  ferramenta({
    nome: "suspender_fixo_no_mes",
    agentes: ["financas"],
    descricao: "Suspende uma fixa em um mês, sem cancelar.",
    esquema: z.object({ id: idDoSistema, year: anoDoSistema, month: mesDoSistema }),
    rotulo: (args) => `Suspendeu a fixa em ${args.month}/${args.year}`,
  }),
  ferramenta({
    nome: "atualizar_valor_dos_fixos",
    agentes: ["financas"],
    descricao: "Muda o valor de uma ou mais fixas.",
    esquema: z.object({
      updates: z.array(z.object({ id: idDoSistema, cents: centavosPositivos })).min(1).max(50),
    }),
    rotulo: (args) => (args.updates.length === 1 ? "Mudou o valor da fixa" : `Mudou o valor de ${args.updates.length} fixas`),
  }),
  ferramenta({
    nome: "associar_compromisso",
    agentes: ["financas", "agenda"],
    descricao: "Liga um lançamento a um compromisso da agenda.",
    esquema: z.object({
      id: idDoSistema.describe("Id do lançamento."),
      commitmentId: idDoSistema.describe("Id do compromisso."),
    }),
    rotulo: () => "Ligou o lançamento ao compromisso",
  }),
  // Organização
  ferramenta({
    nome: "criar_grupo",
    // Finanças também cria: lançar um valor numa sessão que não existe é o caso mais comum, e passar o pedido
    // para outro agente no meio dele é onde o modelo costumava parar.
    agentes: ["organizacao", "financas"],
    descricao: "Cria um grupo.",
    esquema: z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(160).optional() }),
    rotulo: (args) => `Criou o grupo ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "editar_grupo",
    agentes: ["organizacao"],
    descricao: "Renomeia um grupo ou muda a descrição.",
    esquema: z.object({ id: idDoSistema, name: z.string().trim().min(1).max(80), description: z.string().trim().max(160) }),
    rotulo: (args) => `Editou o grupo ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "excluir_grupo",
    agentes: ["organizacao"],
    descricao: "Apaga um grupo vazio.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "criar_sessao",
    agentes: ["organizacao", "financas"],
    descricao: "Cria uma sessão dentro de um grupo.",
    esquema: z.object({
      groupId: idDoSistema,
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(160).optional(),
      justification: z.string().trim().max(160).optional(),
      kind: z
        .enum(TIPOS_SESSAO)
        .describe(
          "valor = recebe um só lançamento, da categoria única (unique); acumulo = junta vários lançamentos de qualquer categoria, inclusive fixa, parcela e empréstimo.",
        ),
    }),
    rotulo: (args) => `Criou a sessão ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "editar_sessao",
    agentes: ["organizacao"],
    descricao: "Edita uma sessão ou muda de grupo.",
    esquema: z.object({
      id: idDoSistema,
      groupId: idDoSistema,
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(160),
      justification: z.string().trim().max(160),
    }),
    rotulo: (args) => `Editou a sessão ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "excluir_sessao",
    agentes: ["organizacao"],
    descricao: "Apaga uma sessão sem lançamentos.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "consultar_virada_do_ano",
    agentes: ["organizacao"],
    descricao: "Mostra o que fica e o que sai na virada do ano.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou a virada do ano",
  }),
  ferramenta({
    nome: "confirmar_virada_do_ano",
    agentes: ["organizacao"],
    descricao: "Decide quais grupos e sessões continuam no ano novo. O que não for listado sai.",
    destrutiva: true,
    esquema: z.object({
      year: anoDoSistema,
      groupIds: z.array(idDoSistema),
      sessionIds: z.array(idDoSistema),
      resumo: resumoDoQueApaga,
    }),
    rotulo: (args) => `Fechou a virada de ${args.year}`,
  }),
  // Agenda
  ferramenta({
    nome: "consultar_agenda",
    agentes: ["agenda", "analise", "financas"],
    descricao: "Lista os compromissos de um mês, com ids.",
    leitura: true,
    esquema: z.object({ year: anoDoSistema, month: mesDoSistema }),
    rotulo: (args) => `Consultou a agenda de ${args.month}/${args.year}`,
  }),
  ferramenta({
    nome: "criar_compromisso",
    agentes: ["agenda"],
    descricao: "Cria um compromisso na agenda.",
    esquema: camposDoCompromisso,
    rotulo: (args) => `Criou o compromisso ${entreAspas(args.title)}`,
  }),
  ferramenta({
    nome: "editar_compromisso",
    agentes: ["agenda"],
    descricao: "Edita um compromisso. Mande todos os campos, com os valores atuais nos que não mudam.",
    esquema: camposDoCompromisso.extend({ id: idDoSistema }),
    rotulo: (args) => `Editou o compromisso ${entreAspas(args.title)}`,
  }),
  ferramenta({
    nome: "mover_compromisso",
    agentes: ["agenda"],
    descricao: "Muda o compromisso de dia.",
    esquema: z.object({ id: idDoSistema, year: anoDoSistema, month: mesDoSistema, day: diaDoSistema }),
    rotulo: (args) => `Moveu o compromisso para ${args.day}/${args.month}/${args.year}`,
  }),
  ferramenta({
    nome: "alterar_status_compromisso",
    agentes: ["agenda"],
    descricao: "Marca o compromisso como feito ou não feito.",
    esquema: z.object({ id: idDoSistema, status: z.enum(STATUS_COMPROMISSO) }),
    rotulo: (args) => (args.status === "done" ? "Marcou o compromisso como feito" : "Reabriu o compromisso"),
  }),
  ferramenta({
    nome: "excluir_compromisso",
    agentes: ["agenda"],
    descricao: "Apaga um compromisso.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "sincronizar_google_calendar",
    agentes: ["agenda"],
    descricao: "Busca e envia as mudanças para o Google Calendar conectado.",
    esquema: vazio,
    rotulo: () => "Sincronizou com o Google Calendar",
  }),
  // Metas
  ferramenta({
    nome: "consultar_metas",
    agentes: ["metas", "analise"],
    descricao:
      "Lista as metas, na ordem de prioridade, com o valor guardado, o alvo, o prazo, quanto cada uma pede da sobra do mês e a divisão da sobra que a pessoa já escolheu (porcentagem, valor e se foi aprovada). Traz também a sobra do mês e quanto já foi separado.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou as metas",
  }),
  ferramenta({
    nome: "criar_meta",
    agentes: ["metas"],
    descricao: "Cria uma meta de economia. O prazo é opcional, mas mês e ano andam juntos.",
    esquema: z.object({
      name: z.string().trim().min(1).max(80),
      targetCents: centavosPositivos.describe("Quanto quer juntar, em centavos."),
      savedCents: z.number().int().min(0).max(2_147_483_647).optional().describe("Quanto já guardou, em centavos."),
      dueYear: anoDoSistema.nullable().optional(),
      dueMonth: mesDoSistema.nullable().optional(),
    }),
    rotulo: (args) => `Criou a meta ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "dividir_sobra_das_metas",
    agentes: ["metas"],
    descricao:
      "Propõe a divisão da sobra deste mês entre as metas, em porcentagem (a soma não passa de 100). Só propõe: nada é separado até a pessoa aprovar a parte de cada meta, na tela de Metas. Mande todas as metas que devem ficar na divisão; quem não vier sai dela, e a parte já aprovada não muda.",
    esquema: z.object({
      percents: z
        .array(z.object({ id: idDoSistema.describe("Id da meta."), percent: z.number().int().min(0).max(100) }))
        .min(1)
        .max(50),
    }),
    rotulo: () => "Propôs a divisão da sobra entre as metas",
  }),
  ferramenta({
    nome: "organizar_prioridade_das_metas",
    agentes: ["metas"],
    descricao:
      "Muda a ordem de prioridade das metas: a primeira recebe antes da sobra do mês. Mande os ids de todas as metas, na nova ordem.",
    esquema: z.object({ ids: z.array(idDoSistema).min(1).max(500) }),
    rotulo: () => "Reorganizou a prioridade das metas",
  }),
  ferramenta({
    nome: "separar_valor_da_meta",
    agentes: ["metas"],
    descricao:
      "Separa um valor para a meta agora: lança uma saída na sessão dela. Mexe com dinheiro, então a pessoa sempre confirma antes. Valor em centavos, positivo.",
    exigeConfirmacao: true,
    esquema: z.object({
      id: idDoSistema.describe("Id da meta."),
      cents: centavosPositivos,
      resumo: z.string().trim().min(3).max(160).describe("O que será feito, para a pessoa confirmar. Ex.: R$ 300,00 para a meta Viagem."),
    }),
    rotulo: (args) => `Separou ${args.resumo}`,
  }),
  ferramenta({
    nome: "excluir_meta",
    agentes: ["metas"],
    descricao: "Apaga uma meta.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  // Extratos
  ferramenta({
    nome: "consultar_extratos",
    agentes: ["extratos", "analise"],
    descricao: "Lista os extratos importados, com ids e situação.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou os extratos",
  }),
  ferramenta({
    nome: "consultar_linhas_do_extrato",
    agentes: ["extratos"],
    descricao: "Mostra as linhas de um extrato.",
    leitura: true,
    esquema: z.object({ id: idDoSistema, somenteErros: z.boolean().optional() }),
    rotulo: () => "Consultou as linhas do extrato",
  }),
  ferramenta({
    nome: "consultar_conferencia",
    agentes: ["extratos"],
    descricao: `Linhas do mês ainda sem lançamento, ${LINHAS_DA_CONFERENCIA_POR_PAGINA} por página, com a categoria e o valor de cada candidato. pagina começa em 1.`,
    leitura: true,
    esquema: z.object({
      year: anoDoSistema,
      month: mesDoSistema,
      pagina: z.number().int().min(1).max(100).optional().describe("Página, a partir de 1."),
    }),
    rotulo: (args) => `Consultou a conferência de ${args.month}/${args.year}`,
  }),
  ferramenta({
    nome: "cruzar_linha",
    agentes: ["extratos"],
    descricao:
      "Liga uma linha a um lançamento. Única: o extrato vale no mês. Fixa, parcela e empréstimo com valor diferente: mande valor extrato ou lancamento, o que a pessoa escolheu. Extra só em linha positiva.",
    esquema: z.object({
      statementId: idDoSistema,
      line: z.number().int().min(1),
      entryId: idDoSistema,
      valor: z.enum(["extrato", "lancamento"]).optional().describe("Qual valor vale no mês, quando fixa, parcela ou empréstimo divergem."),
    }),
    rotulo: (args) => `Cruzou a linha ${args.line}`,
  }),
  ferramenta({
    nome: "desfazer_cruzamento",
    agentes: ["extratos"],
    descricao: "Desfaz o cruzamento de uma linha.",
    esquema: z.object({ statementId: idDoSistema, line: z.number().int().min(1) }),
    rotulo: (args) => `Desfez o cruzamento da linha ${args.line}`,
  }),
  ferramenta({
    nome: "acumular_linha",
    agentes: ["extratos"],
    descricao: "Cria uma única com o valor do extrato numa sessão. Não use para fixa, parcela ou empréstimo que já existem: cruze.",
    esquema: z.object({ statementId: idDoSistema, line: z.number().int().min(1), sessionId: idDoSistema }),
    rotulo: (args) => `Lançou a linha ${args.line}`,
  }),
  ferramenta({
    nome: "acumular_linhas",
    agentes: ["extratos"],
    descricao: "Cria uma única por linha, com o valor do extrato, cada uma na sua sessão. Não use para fixa, parcela ou empréstimo que já existem.",
    esquema: z.object({
      items: z
        .array(z.object({ statementId: idDoSistema, line: z.number().int().min(1), sessionId: idDoSistema }))
        .min(1)
        .max(500),
    }),
    rotulo: (args) => `Lançou ${args.items.length} linhas`,
  }),
  ferramenta({
    nome: "reprocessar_extrato",
    agentes: ["extratos"],
    descricao: "Lê de novo um extrato que falhou.",
    esquema: peloId,
    rotulo: () => "Reprocessou o extrato",
  }),
  ferramenta({
    nome: "excluir_extrato",
    agentes: ["extratos"],
    descricao: "Apaga um extrato importado.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  // Análise
  ferramenta({
    nome: "consultar_painel",
    agentes: ["analise", "financas"],
    descricao: "Totais e itens do dia, do mês ou do ano, como no Dashboard.",
    leitura: true,
    esquema: z.object({
      scope: z.enum(ESCOPOS_PAINEL).describe("dia, mes ou ano."),
      year: anoDoSistema,
      month: mesDoSistema.optional(),
      day: diaDoSistema.optional(),
    }),
    rotulo: () => "Consultou o painel",
  }),
  ferramenta({
    nome: "consultar_relatorio",
    agentes: ["analise"],
    descricao: "Relatório do ano por mês e por categoria.",
    leitura: true,
    esquema: z.object({ year: anoDoSistema.optional() }),
    rotulo: (args) => (args.year ? `Consultou o relatório de ${args.year}` : "Consultou o relatório"),
  }),
  ferramenta({
    nome: "consultar_visao_do_ano",
    agentes: ["analise", "financas"],
    descricao: "Visão geral das finanças do ano.",
    leitura: true,
    esquema: z.object({ year: anoDoSistema }),
    rotulo: (args) => `Consultou a visão de ${args.year}`,
  }),
  ferramenta({
    nome: "consultar_eventos",
    agentes: ["analise"],
    descricao: "Histórico do que aconteceu no sistema.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou o histórico",
  }),
];

/** Ferramentas que o backend não executa: o orquestrador e o grafo tratam. */
export const FERRAMENTA_PERGUNTAR = "perguntar";

export const ESQUEMA_PERGUNTAR = z.object({
  pergunta: z.string().trim().min(3).max(300).describe("A pergunta, curta e direta."),
  opcoes: z
    .array(
      z.object({
        rotulo: z.string().trim().min(1).max(60).describe("Texto do botão."),
        descricao: z.string().trim().max(160).optional().describe("Explicação curta da opção."),
      }),
    )
    .min(2)
    .max(6)
    .describe("De 2 a 6 opções. A pessoa também pode escrever outra resposta."),
});

/** O plano: toda ação que muda o sistema passa por ele, e o backend só executa depois da aprovação. */
export const FERRAMENTA_PLANO = "propor_plano";

/** As ferramentas que criam algo novo: o passo dá o id, e os seguintes apontam para ele com @passo:N. */
export const FERRAMENTAS_QUE_CRIAM: ReadonlySet<string> = new Set([
  "criar_grupo",
  "criar_sessao",
  "criar_lancamento",
  "criar_compromisso",
  "criar_meta",
]);

export const ESQUEMA_PLANO = z.object({
  objetivo: z.string().trim().min(3).max(200).describe("O que a pessoa quer, em uma frase."),
  entendimento: z
    .string()
    .trim()
    .min(3)
    .max(600)
    .describe("Como você interpretou o pedido, como consultor: o que cada valor é e por que o caminho é este."),
  suposicoes: z
    .array(z.string().trim().min(3).max(200))
    .max(8)
    .default([])
    .describe("O que você supôs sem a pessoa dizer, uma por item, para ela corrigir antes de aprovar."),
  passos: z
    .array(
      z.object({
        ferramenta: z.string().trim().min(1).max(80).describe("O nome exato de uma ferramenta que muda o sistema."),
        descricao: z.string().trim().min(3).max(200).describe("O passo em uma frase, para a pessoa ler."),
        args: z
          .record(z.string(), z.unknown())
          .describe('Os argumentos exatos da ferramenta. Para o id de algo criado num passo anterior, use "@passo:N".'),
      }),
    )
    .min(1)
    .max(20),
});

export const FERRAMENTAS_POR_NOME = new Map(FERRAMENTAS_DO_ASSISTENTE.map((item) => [item.nome, item]));

// ─── Feriados, dias úteis e regra de vencimento ──────────────────────────────────────────────────
// Puro: o backend grava as datas com isto e a tela mostra a prévia com a mesma conta.

/**
 * nacional: feriado em todo o país, ninguém trabalha nem o banco abre.
 * bancario: ponto facultativo em que os bancos fecham (Carnaval, Corpus Christi).
 * facultativo: ponto facultativo com banco aberto; só aparece na agenda.
 * local: feriado da cidade ou do estado, cadastrado pela conta.
 */
export const TIPOS_DE_FERIADO = ["nacional", "bancario", "facultativo", "local"] as const;

export type TipoDeFeriado = (typeof TIPOS_DE_FERIADO)[number];

export type Feriado = { data: string; nome: string; tipo: TipoDeFeriado };

/** Feriado da cidade ou do estado: repete todo ano no mesmo dia. */
export type FeriadoLocal = { id: string; nome: string; dia: number; mes: number };

export const LIMITE_FERIADOS_LOCAIS = 40;

export const ROTULO_DO_TIPO_DE_FERIADO: Record<TipoDeFeriado, string> = {
  nacional: "Feriado nacional",
  bancario: "Ponto facultativo, bancos fechados",
  facultativo: "Ponto facultativo",
  local: "Feriado local",
};

function dataIsoUtc(instante: number) {
  return new Date(instante).toISOString().slice(0, 10);
}

/** Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher, em UTC. */
export function pascoa(ano: number) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const DIA_EM_MS = 86_400_000;

const FERIADOS_FIXOS: Array<{ mes: number; dia: number; nome: string; tipo: TipoDeFeriado; desde?: number }> = [
  { mes: 1, dia: 1, nome: "Confraternização Universal", tipo: "nacional" },
  { mes: 4, dia: 21, nome: "Tiradentes", tipo: "nacional" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho", tipo: "nacional" },
  { mes: 9, dia: 7, nome: "Independência do Brasil", tipo: "nacional" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida", tipo: "nacional" },
  { mes: 11, dia: 2, nome: "Finados", tipo: "nacional" },
  { mes: 11, dia: 15, nome: "Proclamação da República", tipo: "nacional" },
  // Feriado nacional pela Lei 14.759/2023.
  { mes: 11, dia: 20, nome: "Dia Nacional de Zumbi e da Consciência Negra", tipo: "nacional", desde: 2024 },
  { mes: 12, dia: 25, nome: "Natal", tipo: "nacional" },
];

/** Os móveis, contados a partir da Páscoa. */
const FERIADOS_MOVEIS: Array<{ distancia: number; nome: string; tipo: TipoDeFeriado }> = [
  { distancia: -48, nome: "Carnaval", tipo: "bancario" },
  { distancia: -47, nome: "Carnaval", tipo: "bancario" },
  { distancia: -46, nome: "Quarta-feira de Cinzas (até 14h)", tipo: "facultativo" },
  { distancia: -2, nome: "Sexta-feira Santa", tipo: "nacional" },
  { distancia: 60, nome: "Corpus Christi", tipo: "bancario" },
];

function diasDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function isoDoDia(ano: number, mes: number, dia: number) {
  const limitado = Math.min(Math.max(dia, 1), diasDoMes(ano, mes));
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(limitado).padStart(2, "0")}`;
}

/** Feriados e pontos facultativos do ano, nacionais e da conta, em ordem de data. */
export function feriadosDoAno(ano: number, locais: FeriadoLocal[] = []): Feriado[] {
  const lista: Feriado[] = [];
  for (const item of FERIADOS_FIXOS) {
    if (item.desde && ano < item.desde) continue;
    lista.push({ data: isoDoDia(ano, item.mes, item.dia), nome: item.nome, tipo: item.tipo });
  }
  const domingo = pascoa(ano);
  for (const item of FERIADOS_MOVEIS) {
    lista.push({ data: dataIsoUtc(domingo + item.distancia * DIA_EM_MS), nome: item.nome, tipo: item.tipo });
  }
  for (const local of locais) {
    lista.push({ data: isoDoDia(ano, local.mes, local.dia), nome: local.nome, tipo: "local" });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
}

/**
 * bancaria: segunda a sexta, sem feriado nem ponto facultativo bancário. Vale para boleto, fatura e transferência.
 * clt: o sábado conta como dia útil, como no "5º dia útil" do salário (CLT, art. 459). Domingo e feriado não contam.
 */
export const CONTAGENS_DE_DIA_UTIL = ["bancaria", "clt"] as const;

export type ContagemDeDiaUtil = (typeof CONTAGENS_DE_DIA_UTIL)[number];

export type CalendarioDeDiasUteis = {
  ehUtil(data: string, contagem: ContagemDeDiaUtil): boolean;
  feriados(ano: number): Feriado[];
  feriadoDe(data: string): Feriado[];
};

export function criarCalendario(locais: FeriadoLocal[] = []): CalendarioDeDiasUteis {
  const anos = new Map<number, { lista: Feriado[]; porData: Map<string, Feriado[]> }>();
  const doAno = (ano: number) => {
    let atual = anos.get(ano);
    if (!atual) {
      const lista = feriadosDoAno(ano, locais);
      const porData = new Map<string, Feriado[]>();
      for (const feriado of lista) porData.set(feriado.data, [...(porData.get(feriado.data) ?? []), feriado]);
      atual = { lista, porData };
      anos.set(ano, atual);
    }
    return atual;
  };
  const feriadoDe = (data: string) => doAno(Number(data.slice(0, 4))).porData.get(data) ?? [];
  return {
    feriados: (ano) => doAno(ano).lista,
    feriadoDe,
    ehUtil(data, contagem) {
      const semana = new Date(`${data}T12:00:00Z`).getUTCDay();
      if (semana === 0) return false;
      if (semana === 6 && contagem === "bancaria") return false;
      return !feriadoDe(data).some(
        (feriado) => feriado.tipo === "nacional" || feriado.tipo === "local" || (feriado.tipo === "bancario" && contagem === "bancaria"),
      );
    },
  };
}

/** Só os feriados nacionais: serve quando a conta não cadastrou nenhum local. */
export const CALENDARIO_NACIONAL = criarCalendario();

/**
 * dia: o dia escolhido do mês (dia 31 em fevereiro vira o último dia).
 * dia_util: o Nº dia útil do mês, como o 5º.
 * ultimo_dia_util: o último dia útil do mês.
 */
export const TIPOS_DE_REGRA = ["dia", "dia_util", "ultimo_dia_util"] as const;

export type TipoDeRegra = (typeof TIPOS_DE_REGRA)[number];

/**
 * O que fazer quando o dia escolhido não é útil. adiar_no_mes adia, mas se isso trocar o mês,
 * antecipa: a conta não pula para o mês seguinte (a convenção dos bancos).
 */
export const AJUSTES_DE_DIA_UTIL = ["manter", "antecipar", "adiar", "adiar_no_mes"] as const;

export type AjusteDeDiaUtil = (typeof AJUSTES_DE_DIA_UTIL)[number];

export const ROTULO_DO_AJUSTE: Record<AjusteDeDiaUtil, string> = {
  manter: "Manter a data",
  antecipar: "Antecipar para o dia útil anterior",
  adiar: "Adiar para o próximo dia útil",
  adiar_no_mes: "Adiar sem passar para o mês seguinte",
};

export type RegraDeVencimento = {
  tipo: TipoDeRegra;
  /** O N do "Nº dia útil". Só no tipo dia_util. */
  ordem: number | null;
  ajuste: AjusteDeDiaUtil;
  contagem: ContagemDeDiaUtil;
};

/** A regra de quem não escolheu nada: o dia como está, sem ajuste. Os lançamentos antigos ficam assim. */
export const REGRA_SEM_AJUSTE: RegraDeVencimento = { tipo: "dia", ordem: null, ajuste: "manter", contagem: "bancaria" };

/** Só lançamentos com série de vencimentos têm regra. Única e extra já são a data escolhida. */
export const CATEGORIAS_COM_REGRA = ["fixed", "installment", "loan"] as const;

export function aceitaRegraDeVencimento(category: CategoriaTransacao) {
  return (CATEGORIAS_COM_REGRA as readonly string[]).includes(category);
}

/** "Nº dia útil" e "último dia útil" só fazem sentido no que se repete por mês, não por semana ou dias. */
export function aceitaDiaUtilDoMes(category: CategoriaTransacao, recurrence: Recorrencia | null) {
  if (category !== "fixed") return aceitaRegraDeVencimento(category);
  return recurrence !== "weekly" && recurrence !== "customize";
}

/**
 * Deixa a regra coerente com o lançamento: categoria sem série não tem regra; fixa semanal só ajusta;
 * a ordem só existe no "Nº dia útil"; a contagem da CLT só muda o "Nº dia útil".
 */
export function normalizarRegra(
  category: CategoriaTransacao,
  recurrence: Recorrencia | null,
  regra: RegraDeVencimento,
): RegraDeVencimento {
  if (!aceitaRegraDeVencimento(category)) return REGRA_SEM_AJUSTE;
  const tipo = regra.tipo !== "dia" && !aceitaDiaUtilDoMes(category, recurrence) ? "dia" : regra.tipo;
  return {
    tipo,
    ordem: tipo === "dia_util" ? Math.min(Math.max(Math.round(regra.ordem ?? 1), 1), 23) : null,
    ajuste: tipo === "dia" ? regra.ajuste : "antecipar",
    contagem: tipo === "dia_util" ? regra.contagem : "bancaria",
  };
}

export const PADROES_DE_VENCIMENTO = ["fixa_entrada", "fixa_saida", "parcela", "emprestimo"] as const;

export type PadraoDeVencimento = (typeof PADROES_DE_VENCIMENTO)[number];

export type PadroesDeVencimento = Record<PadraoDeVencimento, AjusteDeDiaUtil>;

export const ROTULO_DO_PADRAO: Record<PadraoDeVencimento, { nome: string; exemplo: string }> = {
  fixa_entrada: { nome: "Fixa de entrada", exemplo: "Salário, aluguel recebido" },
  fixa_saida: { nome: "Fixa de saída", exemplo: "Aluguel, luz, assinaturas" },
  parcela: { nome: "Parcela", exemplo: "Compra parcelada, fatura" },
  emprestimo: { nome: "Empréstimo", exemplo: "Financiamento, consignado" },
};

/** Sugestão para conta nova: quem recebe costuma ganhar antes; quem paga, pagar no próximo dia útil sem multa. */
export const PADROES_DE_VENCIMENTO_INICIAIS: PadroesDeVencimento = {
  fixa_entrada: "antecipar",
  fixa_saida: "adiar",
  parcela: "adiar",
  emprestimo: "adiar",
};

export function padraoDa(category: CategoriaTransacao, mode: ModoTransacao): PadraoDeVencimento | null {
  if (category === "fixed") return mode === "inflows" ? "fixa_entrada" : "fixa_saida";
  if (category === "installment") return "parcela";
  if (category === "loan") return "emprestimo";
  return null;
}

/** A regra que um lançamento novo ganha pela categoria, se a pessoa não escolher outra. */
export function regraPadrao(padroes: PadroesDeVencimento, category: CategoriaTransacao, mode: ModoTransacao): RegraDeVencimento {
  const padrao = padraoDa(category, mode);
  return padrao ? { ...REGRA_SEM_AJUSTE, ajuste: padroes[padrao] } : REGRA_SEM_AJUSTE;
}

function moverDia(data: string, passos: number) {
  return dataIsoUtc(Date.parse(`${data}T00:00:00Z`) + passos * DIA_EM_MS);
}

function procurar(data: string, sentido: 1 | -1, util: (data: string) => boolean) {
  let atual = data;
  for (let tentativa = 0; tentativa < 15 && !util(atual); tentativa += 1) atual = moverDia(atual, sentido);
  return atual;
}

/**
 * Sábado e Carnaval são dias úteis na CLT, mas banco não credita neles: a data vai para um dia útil bancário,
 * na direção do ajuste (o "Nº dia útil" é prazo, então antecipa).
 */
function emDiaDeBanco(data: string, regra: RegraDeVencimento, calendario: CalendarioDeDiasUteis): string {
  if (regra.contagem !== "clt" || regra.ajuste === "manter") return data;
  return ajustarAoDiaUtil(data, { ...regra, contagem: "bancaria" }, calendario);
}

/** Ajusta uma data que caiu em dia não útil. Serve também para fixas semanais e a cada N dias. */
export function ajustarAoDiaUtil(
  data: string,
  regra: RegraDeVencimento,
  calendario: CalendarioDeDiasUteis = CALENDARIO_NACIONAL,
): string {
  if (regra.ajuste === "manter") return data;
  const util = (item: string) => calendario.ehUtil(item, regra.contagem);
  let ajustada = data;
  if (!util(data)) {
    if (regra.ajuste === "antecipar") ajustada = procurar(data, -1, util);
    else {
      ajustada = procurar(data, 1, util);
      if (regra.ajuste === "adiar_no_mes" && ajustada.slice(0, 7) !== data.slice(0, 7)) ajustada = procurar(data, -1, util);
    }
  }
  return emDiaDeBanco(ajustada, regra, calendario);
}

/** A data de um vencimento do mês pela regra. */
export function dataPelaRegra(
  ano: number,
  mes: number,
  dia: number,
  regra: RegraDeVencimento,
  calendario: CalendarioDeDiasUteis = CALENDARIO_NACIONAL,
) {
  if (regra.tipo === "dia") return ajustarAoDiaUtil(isoDoDia(ano, mes, dia), regra, calendario);
  const uteis: string[] = [];
  for (let atual = 1; atual <= diasDoMes(ano, mes); atual += 1) {
    const data = isoDoDia(ano, mes, atual);
    if (calendario.ehUtil(data, regra.contagem)) uteis.push(data);
  }
  if (uteis.length === 0) return isoDoDia(ano, mes, dia);
  const escolhida =
    regra.tipo === "ultimo_dia_util" ? uteis[uteis.length - 1] : uteis[Math.min(Math.max(regra.ordem ?? 1, 1), uteis.length) - 1];
  return emDiaDeBanco(escolhida, { ...regra, ajuste: "antecipar" }, calendario);
}

/** Texto curto da regra, para chip e lista: "5º dia útil", "Dia 30, antecipa". */
export function textoDaRegra(regra: RegraDeVencimento, dia: number) {
  // A contagem da CLT só muda o "Nº dia útil": nas outras regras a data final é sempre dia de banco.
  if (regra.tipo === "dia_util") return `${regra.ordem ?? 1}º dia útil${regra.contagem === "clt" ? " (CLT)" : ""}`;
  if (regra.tipo === "ultimo_dia_util") return "Último dia útil";
  const ajuste = { manter: "", antecipar: ", antecipa", adiar: ", adia", adiar_no_mes: ", adia no mês" }[regra.ajuste];
  return `Dia ${dia}${ajuste}`;
}

export function mesmaRegra(a: RegraDeVencimento, b: RegraDeVencimento) {
  return a.tipo === b.tipo && (a.ordem ?? null) === (b.ordem ?? null) && a.ajuste === b.ajuste && a.contagem === b.contagem;
}

/** Uma data da prévia: `base` é o dia sem regra, `feriado` é o nome do feriado que caía nele. */
export type PreviaDeVencimento = { data: string; base: string; feriado: string | null };

/**
 * As próximas datas de um lançamento pela regra, para a prévia do formulário. Segue a recorrência da fixa
 * (inclusive semanal e a cada N dias) e o número de parcelas. A fixa vale só no ano em que começa, então
 * a prévia dela para em dezembro, como a grade gravada.
 */
export function proximosVencimentos(
  entrada: {
    category: CategoriaTransacao;
    date: string;
    recurrence: Recorrencia | null;
    recurrenceInterval: number | null;
    installments: number | null;
  },
  regra: RegraDeVencimento,
  calendario: CalendarioDeDiasUteis = CALENDARIO_NACIONAL,
  quantos = 4,
): PreviaDeVencimento[] {
  const [ano, mes, dia] = entrada.date.split("-").map(Number);
  if (!ano || !mes || !dia || !aceitaRegraDeVencimento(entrada.category)) return [];
  const fixa = entrada.category === "fixed";
  const recurrence = fixa ? (entrada.recurrence ?? "monthly") : "monthly";
  const efetiva = normalizarRegra(entrada.category, recurrence, regra);
  const passo = Math.max(fixa ? (entrada.recurrenceInterval ?? 1) : 1, 1);
  const total = fixa ? quantos : Math.min(quantos, Math.max(entrada.installments ?? quantos, 1));
  const lista: Array<{ data: string; base: string }> = [];
  if (recurrence === "weekly" || recurrence === "customize") {
    const dias = recurrence === "weekly" ? 7 * passo : passo;
    for (let vez = 0; vez < total; vez += 1) {
      const base = dataIsoUtc(Date.UTC(ano, mes - 1, dia) + vez * dias * DIA_EM_MS);
      if (Number(base.slice(0, 4)) !== ano) break;
      lista.push({ base, data: ajustarAoDiaUtil(base, { ...efetiva, tipo: "dia" }, calendario) });
    }
  } else {
    const meses = MESES_DA_RECORRENCIA[recurrence] * passo;
    for (let vez = 0; vez < total; vez += 1) {
      const absoluto = mes - 1 + vez * meses;
      const alvoAno = ano + Math.floor(absoluto / 12);
      const alvoMes = (absoluto % 12) + 1;
      if (fixa && alvoAno !== ano) break;
      lista.push({ base: isoDoDia(alvoAno, alvoMes, dia), data: dataPelaRegra(alvoAno, alvoMes, dia, efetiva, calendario) });
    }
  }
  return lista.map((item) => ({ ...item, feriado: calendario.feriadoDe(item.base)[0]?.nome ?? null }));
}
