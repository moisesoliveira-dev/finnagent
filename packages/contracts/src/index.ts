export type TenantId = string;

export type Grupo = {
  id: string;
  name: string;
  description: string;
};

export type Sessao = {
  id: string;
  groupId: string;
  name: string;
  description: string;
  cents: number;
};

export type GruposResposta = {
  groups: Grupo[];
  sessions: Sessao[];
};

export const TIPOS_LANCAMENTO = [
  "adicional",
  "parcela",
  "empréstimo",
  "fixo",
  "variável",
] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

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
};

export type FinancasResposta = {
  workflow: Workflow;
  entries: Lancamento[];
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
  if (entry.type === "fixo") return "Sem fim definido";
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

function centavosAgendados(entry: Lancamento, year: number, monthIndex: number) {
  if (entry.type === "adicional" || entry.type === "variável") {
    return entry.months.find((mes) => mes.year === year && mes.month === monthIndex + 1)?.cents;
  }
  const distancia = indice(year, monthIndex) - indice(entry.startYear, entry.startMonth - 1);
  if (distancia < 0) return undefined;
  if (entry.type === "fixo") return entry.cents;
  const parcelas = entry.installments ?? 0;
  if (distancia < parcelas) return entry.cents;
  return undefined;
}

function indice(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

export const AGENDAS = ["Pessoal", "Trabalho"] as const;

export type NomeAgenda = (typeof AGENDAS)[number];

export const CATEGORIAS_COMPROMISSO = ["unico", "recorrente", "validade"] as const;

export type CategoriaCompromisso = (typeof CATEGORIAS_COMPROMISSO)[number];

export type EstadoGoogle = "desconectado" | "sincronizando" | "sincronizado" | "erro";

export type LancamentoDoMes = {
  id: string;
  description: string;
  day: number;
  groupName: string;
  sessionName: string;
  cents: number;
};

export type Vinculo = {
  entryId: string;
  groupName: string;
  sessionName: string;
  cents: number;
};

export type Compromisso = {
  id: string;
  title: string;
  year: number;
  month: number;
  day: number;
  time: string | null;
  calendar: NomeAgenda;
  category: CategoriaCompromisso;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  entryId: string | null;
  link: Vinculo | null;
};

export type AgendaResposta = {
  google: EstadoGoogle;
  appointments: Compromisso[];
  entries: LancamentoDoMes[];
};

export const LIMITE_EXTRATO_BYTES = 5 * 1024 * 1024;

export const FORMATOS_EXTRATO = ["ofx", "csv"] as const;

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

export type VinculoCruzado = {
  entryId: string;
  description: string;
  groupName: string;
  sessionName: string;
  day: number;
  cents: number;
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
};

export type ConferenciaResposta = {
  year: number;
  month: number;
  lines: LinhaConferencia[];
};
