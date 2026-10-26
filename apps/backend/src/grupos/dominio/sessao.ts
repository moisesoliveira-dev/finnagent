import { type CategoriaTransacao, type TipoSessao } from "@finnagent/contracts";

const fuso = "America/Sao_Paulo";

export type LancamentoDaSessao = {
  id: string;
  position: number;
  status: string;
  cents: number;
  months: number[];
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

export function aceitaLancamento(kind: TipoSessao, lancamentos: { status: string }[]) {
  if (kind !== "valor") return true;
  return lancamentos.every((item) => item.status === "cancelled");
}

export function mensagemDaCategoria(kind: TipoSessao) {
  if (kind === "valor") return "Esta sessão só aceita a transação única.";
  return "Esta sessão acumula única, extra, parcela, empréstimo e fixa.";
}

export function protegeValorBase(
  kind: TipoSessao,
  lancamentoId: string,
  lancamentos: { id: string; position: number; status: string }[],
  mudouValor: boolean,
) {
  if (kind !== "valor" || !mudouValor) return false;
  const ativos = lancamentos
    .filter((item) => item.status !== "cancelled")
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
