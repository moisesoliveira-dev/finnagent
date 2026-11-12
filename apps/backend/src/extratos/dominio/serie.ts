import { ehMulta, type CategoriaTransacao, type Lancamento, type TipoDaLinha } from "@finnagent/contracts";
import { chaveDoNome, descricoesParecidas } from "./nome-extrato.js";

/** Uma linha de extrato ainda sem lançamento, em qualquer mês importado. */
export type LinhaLivre = { statementId: string; line: number; date: string; cents: number; description: string };

/** As linhas de um mês que são a mesma compra. `numero` é a parcela daquele mês (só parcela e empréstimo). */
export type MesDaSerie = {
  month: string;
  numero: number | null;
  /** A ocorrência da série que já existe naquele mês: o vencimento e o valor planejado. Só na série que já existe. */
  dueDate: string | null;
  plannedCents: number | null;
  /** Antes da primeira ocorrência da série que já existe. Na recorrente, a linha desse mês entra como única. */
  antes: boolean;
  lines: LinhaLivre[];
};

/** Num mês, no máximo este tanto de linhas da mesma compra: as de valor mais perto. Uma loja comum não inunda a lista. */
export const LINHAS_POR_MES_DA_SERIE = 3;

/** Como a linha entra: paga a ocorrência do mês da série, ou soma no mês como parte, numa única da mesma sessão. */
export type PapelDaLinha = "serie" | "parte";

const SERIES: ReadonlySet<CategoriaTransacao> = new Set(["installment", "loan", "fixed"]);

export function ehCategoriaDeSerie(category: CategoriaTransacao) {
  return SERIES.has(category);
}

function mesDe(date: string) {
  return date.slice(0, 7);
}

/** Meses entre duas chaves "AAAA-MM": positivo quando `ate` vem depois de `de`. */
export function mesesEntre(de: string, ate: string) {
  const [anoDe, mesDe_] = de.split("-").map(Number) as [number, number];
  const [anoAte, mesAte] = ate.split("-").map(Number) as [number, number];
  return (anoAte - anoDe) * 12 + (mesAte - mesDe_);
}

/** A mesma compra: o mesmo destino na descrição (mesmo escrito de outro jeito) e o mesmo sentido (saída com saída). */
function mesmaCompra(descricao: string, sinal: number, linha: LinhaLivre) {
  return Boolean(linha.date) && Math.sign(linha.cents) === sinal && descricoesParecidas(descricao, linha.description);
}

/** As linhas por mês, em ordem de data. Com `referencia`, cada mês fica com as de valor mais perto dela. */
function agruparPorMes(linhas: LinhaLivre[], referencia: number | null = null, manter: LinhaLivre | null = null) {
  const porMes = new Map<string, LinhaLivre[]>();
  for (const linha of linhas) porMes.set(mesDe(linha.date), [...(porMes.get(mesDe(linha.date)) ?? []), linha]);
  for (const [mes, lista] of porMes) {
    let escolhidas = lista;
    if (referencia !== null && lista.length > LINHAS_POR_MES_DA_SERIE) {
      const perto = [...lista].sort((a, b) => Math.abs(a.cents - referencia) - Math.abs(b.cents - referencia));
      escolhidas = perto.slice(0, LINHAS_POR_MES_DA_SERIE);
      if (manter && mesDe(manter.date) === mes && !escolhidas.includes(manter)) escolhidas = [manter, ...escolhidas.slice(0, -1)];
    }
    porMes.set(mes, [...escolhidas].sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line));
  }
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Antes de criar a série a partir de uma linha: as linhas de outros meses importados que são a mesma compra.
 * Parcela e empréstimo só valem nos meses em que a parcela cai de 1 até o total (a parcela da linha de origem é a
 * informada); antes da primeira ou depois da última é outra compra. Recorrente mensal vale em qualquer mês; outra
 * recorrência não procura. A linha de origem vem sempre, no mês dela.
 */
export function linhasDaNovaSerie(origem: LinhaLivre, tipo: TipoDaLinha, livres: LinhaLivre[]): MesDaSerie[] {
  const sozinha: MesDaSerie[] = [{ month: mesDe(origem.date), numero: numeroDaOrigem(tipo), dueDate: null, plannedCents: null, antes: false, lines: [origem] }];
  if (!ehCategoriaDeSerie(tipo.category)) return sozinha;
  if (!chaveDoNome(origem.description)) return sozinha;
  if (tipo.category === "fixed" && ((tipo.recurrence ?? "monthly") !== "monthly" || (tipo.recurrenceInterval ?? 1) !== 1)) return sozinha;
  const sinal = Math.sign(origem.cents);
  const outras = livres.filter(
    (linha) => !(linha.statementId === origem.statementId && linha.line === origem.line) && mesmaCompra(origem.description, sinal, linha),
  );
  const mesOrigem = mesDe(origem.date);
  const atual = numeroDaOrigem(tipo);
  const total = tipo.category === "fixed" ? null : (tipo.installments ?? null);
  return agruparPorMes([origem, ...outras], origem.cents, origem).flatMap(([month, lines]) => {
    const numero = atual === null ? null : atual + mesesEntre(mesOrigem, month);
    if (numero !== null && (numero < 1 || (total !== null && numero > total))) return [];
    return [{ month, numero, dueDate: null, plannedCents: null, antes: false, lines }];
  });
}

function numeroDaOrigem(tipo: TipoDaLinha) {
  if (tipo.category !== "installment" && tipo.category !== "loan") return null;
  return tipo.installmentNumber ?? 1;
}

/**
 * Para uma série que já existe: as linhas livres que são a mesma compra (pelas descrições que ela já conhece: os
 * nomes lembrados e as descrições das linhas que já pagaram a série, comparadas pelo destino). Entram os meses em que ela ainda tem ocorrência
 * pendente e os meses antes da primeira ocorrência (o mês anterior importado depois): na parcela e no empréstimo, a
 * linha paga o que ainda falta, como em qualquer mês; na recorrente, entra como única na mesma sessão.
 */
export function linhasDaSerieExistente(entry: Lancamento, chaves: ReadonlySet<string>, livres: LinhaLivre[]): MesDaSerie[] {
  if (!ehCategoriaDeSerie(entry.category) || chaves.size === 0) return [];
  const sinal = Math.sign(entry.cents) || -1;
  const ocorrencias = (entry.occurrences ?? []).filter((item) => !ehMulta(item) && item.status !== "cancelled");
  const primeiro = ocorrencias.map((item) => mesDe(item.dueDate)).sort()[0] ?? null;
  const pendentes = new Map<string, { dueDate: string; plannedCents: number; numero: number | null }>();
  for (const item of ocorrencias) {
    if (item.status !== "pending") continue;
    const mes = mesDe(item.dueDate);
    if (!pendentes.has(mes)) pendentes.set(mes, { dueDate: item.dueDate, plannedCents: item.plannedCents, numero: item.parcel ?? null });
  }
  const antesDoInicio = (mes: string) => primeiro !== null && mes < primeiro;
  const linhas = livres.filter((linha) => {
    if (!linha.date || Math.sign(linha.cents) !== sinal) return false;
    if (!chaves.has(chaveDoNome(linha.description)) && ![...chaves].some((chave) => descricoesParecidas(chave, linha.description))) return false;
    const mes = mesDe(linha.date);
    return pendentes.has(mes) || antesDoInicio(mes);
  });
  return agruparPorMes(linhas, entry.cents).map(([month, lines]) => {
    const ocorrencia = pendentes.get(month);
    return {
      month,
      numero: ocorrencia?.numero ?? null,
      dueDate: ocorrencia?.dueDate ?? null,
      plannedCents: ocorrencia?.plannedCents ?? null,
      antes: !ocorrencia && antesDoInicio(month),
      lines,
    };
  });
}

/**
 * Parcela e empréstimo pagam o que falta, uma parcela por linha: duas linhas do mesmo mês podem pagar duas parcelas.
 * A recorrente tem uma ocorrência por mês, então só uma linha paga e as outras somam.
 */
export function variasPagamNoMes(category: CategoriaTransacao) {
  return category === "installment" || category === "loan";
}

/**
 * Confere a escolha da pessoa: cada linha escolhida está entre as encontradas, cada mês tem no máximo uma linha que
 * paga a série (na parcela e no empréstimo, `variasPorMes` deixa mais de uma), e a parte só entra num mês que tem a
 * linha da série. Devolve o motivo, se recusar.
 */
export function erroDaEscolha(meses: MesDaSerie[], escolha: { statementId: string; line: number; papel: PapelDaLinha }[], variasPorMes = false) {
  if (escolha.length === 0) return "Escolha ao menos uma linha.";
  const mesDaLinha = new Map<string, string>(meses.flatMap((mes) => mes.lines.map((linha) => [`${linha.statementId}:${linha.line}`, mes.month] as [string, string])));
  const vistas = new Set<string>();
  const daSerie = new Map<string, number>();
  const comParte = new Set<string>();
  for (const item of escolha) {
    const chave = `${item.statementId}:${item.line}`;
    const mes = mesDaLinha.get(chave);
    if (!mes) return "Uma das linhas escolhidas não é desta série, ou já foi lançada.";
    if (vistas.has(chave)) return "A mesma linha veio duas vezes.";
    vistas.add(chave);
    if (item.papel === "serie") daSerie.set(mes, (daSerie.get(mes) ?? 0) + 1);
    else comParte.add(mes);
  }
  if (!variasPorMes) {
    for (const [mes, quantas] of daSerie) if (quantas > 1) return `Em ${mes}, só uma linha paga a série. As outras somam como parte ou ficam de fora.`;
  }
  for (const mes of comParte) if (!daSerie.has(mes)) return `Em ${mes}, a parte precisa de uma linha que pague a série.`;
  if (daSerie.size === 0) return "Escolha ao menos uma linha que pague a série.";
  return null;
}

/** O tipo da série nascendo no mês mais antigo escolhido: a parcela daquele mês, se for parcela ou empréstimo. */
export function tipoNoInicio(tipo: TipoDaLinha, meses: MesDaSerie[], mesInicial: string): TipoDaLinha {
  const numero = meses.find((mes) => mes.month === mesInicial)?.numero ?? null;
  if (numero === null) return tipo;
  return { ...tipo, installmentNumber: numero };
}
