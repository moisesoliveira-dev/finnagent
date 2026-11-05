import { type CategoriaTransacao, type MesOcupado, type TipoSessao } from "@finnagent/contracts";

const fuso = "America/Sao_Paulo";

export type LancamentoDaSessao = {
  id: string;
  position: number;
  status: string;
  cents: number;
  months: number[];
  /** O mês da transação ("AAAA-MM"). No Fixo, só existe uma por mês. */
  month: string;
};

const ACUMULO: CategoriaTransacao[] = ["unique", "additional", "installment", "loan", "fixed"];

export function pedidoDaSessao(kind: TipoSessao) {
  return { kind, cents: 0 };
}

export function categoriasDaSessao(kind: TipoSessao): CategoriaTransacao[] {
  if (kind === "valor") return ["unique"];
  return ACUMULO;
}

export function categoriaPermitida(kind: TipoSessao, category: CategoriaTransacao) {
  return categoriasDaSessao(kind).includes(category);
}

/** O Fixo guarda uma transação por mês: aceita um lançamento no mês em que ainda não tem a dela. */
export function aceitaLancamento(kind: TipoSessao, lancamentos: { status: string; month: string }[], month: string) {
  if (kind !== "valor") return true;
  return lancamentos.every((item) => item.status === "cancelled" || item.month !== month);
}

/** Os meses em que a sessão Fixo já tem a transação, com o valor dela (a primeira do mês) e o total com as partes. */
export function mesesOcupados(kind: TipoSessao, lancamentos: LancamentoDaSessao[]): MesOcupado[] {
  if (kind !== "valor") return [];
  const porMes = new Map<string, LancamentoDaSessao[]>();
  for (const item of lancamentos) {
    if (item.status === "cancelled") continue;
    porMes.set(item.month, [...(porMes.get(item.month) ?? []), item]);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, doMes]) => {
      const ativos = [...doMes].sort((a, b) => a.position - b.position);
      const valores = ativos.map((item) => centavosDoLancamento(item));
      return { month, cents: valores[0] ?? 0, totalCents: valores.reduce((soma, valor) => soma + valor, 0) };
    });
}

export function mensagemDaCategoria(kind: TipoSessao) {
  if (kind === "valor") return "Esta sessão só aceita a transação única, uma por mês.";
  return "Esta sessão acumula única, extra, parcela, empréstimo e fixa.";
}

export const MENSAGEM_DA_TROCA_DE_TIPO =
  "Um Fixo guarda uma transação única por mês. Cancele ou mova o que passa disso em cada mês antes de trocar.";

/**
 * Trocar o tipo da sessão que já tem lançamentos. Acúmulo aceita tudo que o Fixo aceita, então virar Acúmulo é
 * sempre seguro. Virar Fixo só cabe quando todas as ativas são únicas e nenhum mês tem mais de uma; a cancelada
 * não conta.
 */
export function podeTrocarDeTipo(
  atual: TipoSessao,
  para: TipoSessao,
  lancamentos: { status: string; category: string; month: string }[],
) {
  if (para === atual || para !== "valor") return true;
  const ativos = lancamentos.filter((item) => item.status !== "cancelled");
  const meses = new Set(ativos.map((item) => item.month));
  return meses.size === ativos.length && ativos.every((item) => item.category === "unique");
}

/** No Fixo, a primeira transação do mês é a base daquele mês: com partes atrás dela, o valor não muda. */
export function protegeValorBase(
  kind: TipoSessao,
  lancamentoId: string,
  lancamentos: { id: string; position: number; status: string; month: string }[],
  mudouValor: boolean,
) {
  if (kind !== "valor" || !mudouValor) return false;
  const mes = lancamentos.find((item) => item.id === lancamentoId)?.month;
  const ativos = lancamentos
    .filter((item) => item.status !== "cancelled" && item.month === mes)
    .sort((a, b) => a.position - b.position);
  return ativos.length > 1 && ativos[0]?.id === lancamentoId;
}

export function centavosDoLancamento(item: LancamentoDaSessao) {
  if (item.status === "cancelled") return 0;
  if (item.cents === 0 && item.months.length > 0) {
    return item.months.reduce((soma, valor) => soma + valor, 0);
  }
  return item.cents;
}

export function resumoDaSessao(kind: TipoSessao, lancamentos: LancamentoDaSessao[]) {
  const ativos = lancamentos
    .filter((item) => item.status !== "cancelled")
    .sort((a, b) => a.position - b.position);
  const valores = ativos.map((item) => centavosDoLancamento(item));
  const totalCents = valores.reduce((soma, valor) => soma + valor, 0);
  if (kind !== "valor") return { cents: 0, additions: [], totalCents };
  const [base, ...resto] = ativos;
  return {
    cents: base ? centavosDoLancamento(base) : 0,
    additions: resto.map((item) => ({
      id: item.id,
      cents: centavosDoLancamento(item),
      note: "",
    })),
    totalCents,
  };
}

export function inicioDaSessao(agora = new Date()) {
  const { ano, mes } = calendario(agora);
  return data(ano, mes, 1);
}

export function fimDaSessao(agora = new Date()) {
  const { ano, mes, dia } = calendario(agora);
  return data(ano, mes, dia);
}

export function hojeNoFuso(agora = new Date()) {
  const { ano, mes, dia } = calendario(agora);
  return { year: ano, month: mes, day: dia };
}

function calendario(agora: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const numero = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  return { ano: numero("year"), mes: numero("month"), dia: numero("day") };
}

function data(ano: number, mes: number, dia: number) {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
