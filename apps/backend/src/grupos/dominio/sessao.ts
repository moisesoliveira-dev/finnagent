import { chaveDoMes, type CategoriaTransacao, type MesOcupado, type TipoSessao } from "@finnagent/contracts";

const fuso = "America/Sao_Paulo";

export type LancamentoDaSessao = {
  id: string;
  position: number;
  status: string;
  cents: number;
  months: number[];
  /** Os meses ("AAAA-MM") que a transação ocupa, com o valor dela em cada um. No Fixo, cada mês tem uma só. */
  meses: MesDoLancamento[];
};

export type MesDoLancamento = { month: string; cents: number };

/** Um vencimento gravado da transação: a data, a situação, se é parcela ou multa e o valor (com sinal). */
export type VencimentoDaSessao = { dueDate: string; status: string; kind: string | null; cents: number };

const ACUMULO: CategoriaTransacao[] = ["unique", "additional", "installment", "loan", "fixed"];
/** O Fixo aceita a única e as séries de valor certo. A extra é avulsa e fica só no Acúmulo. */
const FIXO: CategoriaTransacao[] = ["unique", "installment", "loan", "fixed"];

export function pedidoDaSessao(kind: TipoSessao) {
  return { kind, cents: 0 };
}

export function categoriasDaSessao(kind: TipoSessao): CategoriaTransacao[] {
  if (kind === "valor") return FIXO;
  return ACUMULO;
}

export function categoriaPermitida(kind: TipoSessao, category: CategoriaTransacao) {
  return categoriasDaSessao(kind).includes(category);
}

/**
 * Os meses que a transação ocupa no Fixo. A única ocupa o mês dela. Parcela, empréstimo e fixa ocupam cada mês em
 * que vencem; o vencimento cancelado e a multa não ocupam. Sem vencimento gravado, a conta sai do início e das
 * parcelas.
 */
export function mesesDoLancamento(item: {
  category: string;
  startYear: number;
  startMonth: number;
  installments: number | null;
  status: string;
  cents: number;
  months: number[];
  vencimentos: VencimentoDaSessao[];
}): MesDoLancamento[] {
  const inicio = chaveDoMes(item.startYear, item.startMonth);
  if (item.category !== "installment" && item.category !== "loan" && item.category !== "fixed") {
    return [{ month: inicio, cents: centavosDoLancamento(item) }];
  }
  const validos = item.vencimentos.filter((venc) => venc.status !== "cancelled" && venc.kind !== "multa");
  if (validos.length === 0) {
    const vezes = item.category === "fixed" ? 1 : Math.max(item.installments ?? 1, 1);
    return Array.from({ length: vezes }, (_, salto) => {
      const absoluto = item.startYear * 12 + item.startMonth - 1 + salto;
      return { month: chaveDoMes(Math.floor(absoluto / 12), (absoluto % 12) + 1), cents: item.cents };
    });
  }
  const porMes = new Map<string, number>();
  for (const venc of validos) {
    const month = venc.dueDate.slice(0, 7);
    porMes.set(month, (porMes.get(month) ?? 0) + venc.cents);
  }
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, cents }));
}

/**
 * O primeiro mês em que a transação nova (ou a editada) encontra outra transação do Fixo, ou null. Na edição, o
 * mês que ela já ocupava não conta: as partes que estão ali foram aprovadas antes.
 */
export function mesEmConflito(
  kind: TipoSessao,
  outras: { status: string; meses: string[] }[],
  meses: string[],
  jaOcupava: string[] = [],
) {
  if (kind !== "valor") return null;
  const ocupados = new Set(outras.filter((item) => item.status !== "cancelled").flatMap((item) => item.meses));
  return [...meses].sort().find((mes) => ocupados.has(mes) && !jaOcupava.includes(mes)) ?? null;
}

/** Os meses em que a sessão Fixo já tem a transação, com o valor dela (a primeira do mês) e o total com as partes. */
export function mesesOcupados(kind: TipoSessao, lancamentos: LancamentoDaSessao[]): MesOcupado[] {
  if (kind !== "valor") return [];
  const porMes = new Map<string, { position: number; cents: number }[]>();
  for (const item of lancamentos) {
    if (item.status === "cancelled") continue;
    for (const mes of item.meses) {
      porMes.set(mes.month, [...(porMes.get(mes.month) ?? []), { position: item.position, cents: mes.cents }]);
    }
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, doMes]) => {
      const valores = [...doMes].sort((a, b) => a.position - b.position).map((item) => item.cents);
      return { month, cents: valores[0] ?? 0, totalCents: valores.reduce((soma, valor) => soma + valor, 0) };
    });
}

export function mensagemDaCategoria(kind: TipoSessao) {
  if (kind === "valor") {
    return "Esta sessão Fixo aceita única, parcela, empréstimo e fixa, uma transação por mês. A extra fica no Acúmulo.";
  }
  return "Esta sessão acumula única, extra, parcela, empréstimo e fixa.";
}

/** "2027-03" vira "março de 2027". */
export function nomeDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(ano ?? 0, (mes ?? 1) - 1, 1)),
  );
  return `${nome} de ${ano}`;
}

export function mensagemDoMesOcupado(chave: string) {
  return `Esta sessão Fixo já tem transação em ${nomeDoMes(chave)}. Cada mês guarda uma só: escolha outro início, menos parcelas ou outra sessão.`;
}

export const MENSAGEM_DA_TROCA_DE_TIPO =
  "Um Fixo guarda uma transação por mês e não aceita extra. Cancele ou mova o que passa disso antes de trocar.";

/**
 * Trocar o tipo da sessão que já tem lançamentos. Acúmulo aceita tudo que o Fixo aceita, então virar Acúmulo é
 * sempre seguro. Virar Fixo só cabe quando nenhuma ativa é extra e nenhum mês fica com duas; a cancelada não conta.
 */
export function podeTrocarDeTipo(
  atual: TipoSessao,
  para: TipoSessao,
  lancamentos: { status: string; category: string; meses: string[] }[],
) {
  if (para === atual || para !== "valor") return true;
  const ativos = lancamentos.filter((item) => item.status !== "cancelled");
  if (!ativos.every((item) => FIXO.includes(item.category as CategoriaTransacao))) return false;
  const vistos = new Set<string>();
  for (const item of ativos) {
    for (const mes of new Set(item.meses)) {
      if (vistos.has(mes)) return false;
      vistos.add(mes);
    }
  }
  return true;
}

/**
 * No Fixo, a primeira transação do mês é a base daquele mês: com partes atrás dela em algum dos meses que ocupa,
 * o valor não muda.
 */
export function protegeValorBase(
  kind: TipoSessao,
  lancamentoId: string,
  lancamentos: { id: string; position: number; status: string; meses: string[] }[],
  mudouValor: boolean,
) {
  if (kind !== "valor" || !mudouValor) return false;
  const alvo = lancamentos.find((item) => item.id === lancamentoId);
  if (!alvo) return false;
  return alvo.meses.some((mes) => {
    const ativos = lancamentos
      .filter((item) => item.status !== "cancelled" && item.meses.includes(mes))
      .sort((a, b) => a.position - b.position);
    return ativos.length > 1 && ativos[0]?.id === lancamentoId;
  });
}

export function centavosDoLancamento(item: { status: string; cents: number; months: number[] }) {
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
