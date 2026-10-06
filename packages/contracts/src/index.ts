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
