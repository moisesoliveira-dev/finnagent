import {
  ehMulta,
  ehSerie,
  type CategoriaTransacao,
  type DiferencaDoPagamento,
  type ModoTransacao,
  type Ocorrencia,
} from "@finnagent/contracts";

const DIA = 24 * 60 * 60 * 1000;

/** O que o motor precisa saber do lançamento para aplicar um pagamento. */
export type ContratoDoPagamento = {
  category: CategoriaTransacao;
  mode: ModoTransacao;
  /** A parcela combinada (com sinal), usada para prever o que falta no empréstimo. */
  cents: number;
  installments: number | null;
  principalCents: number | null;
};

export type Pagamento = {
  date: string;
  /** O valor pago, sem sinal. */
  cents: number;
  paymentId: string;
  diferenca?: DiferencaDoPagamento;
};

/** Dá a data de vencimento de um mês, já pela regra de dia útil do lançamento. */
export type DatarMes = (year: number, month: number) => string;

export type ResultadoDoPagamento = { lista: Ocorrencia[] } | "escolha-diferenca" | "bloqueada";

const semDatas: DatarMes = () => {
  throw new Error("O empréstimo precisa de como datar a previsão.");
};

/** A ocorrência do mês da data: a pendente, ou a já paga se não houver pendente. Única, extra e recorrente. */
export function ocorrenciaDoPagamento(lista: Ocorrencia[], date: string) {
  const mes = date.slice(0, 7);
  const doMes = lista.filter(
    (item) => item.dueDate.slice(0, 7) === mes && (item.status === "pending" || item.status === "completed"),
  );
  const pendentes = doMes.filter((item) => item.status === "pending");
  const alvo = (pendentes.length > 0 ? pendentes : doMes)
    .map((item) => ({ item, distancia: Math.abs(Date.parse(item.dueDate) - Date.parse(date)) / DIA }))
    .sort((a, b) => a.distancia - b.distancia || a.item.number - b.item.number)[0];
  return alvo?.item.number ?? null;
}

export function pagarOcorrencia(item: Ocorrencia, cents: number, date: string, paymentId?: string): Ocorrencia {
  return { ...item, status: "completed", paidCents: cents, paidOn: date, ...(paymentId ? { paymentId } : {}) };
}

function comSinal(valor: number, mode: ModoTransacao) {
  return mode === "outflows" ? -Math.abs(valor) : Math.abs(valor);
}

function pendentesEmOrdem(lista: Ocorrencia[]) {
  return lista
    .filter((item) => item.status === "pending" && !ehMulta(item))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number);
}

/** Renumera na ordem em que as ocorrências estão na lista. */
function renumerar(lista: Ocorrencia[]): Ocorrencia[] {
  return lista.map((item, indice) => ({ ...item, number: indice + 1 }));
}

function inserirDepois(lista: Ocorrencia[], referencia: Ocorrencia, nova: Ocorrencia) {
  const indice = lista.findIndex((item) => item.number === referencia.number);
  const copia = [...lista];
  copia.splice(indice + 1, 0, nova);
  return copia;
}

/**
 * Aplica um pagamento ao lançamento.
 *
 * - Única, extra e recorrente: paga a ocorrência do mês da data, como sempre.
 * - Parcela: o valor vai para a primeira parcela pendente, em qualquer mês. O que passar dela paga as seguintes.
 *   Se sobrar menos que uma parcela, a sobra é multa e juros ou parte da próxima, conforme \`diferenca\`; sem a
 *   escolha, o motor pede ("escolha-diferenca"). Valor menor que a parcela paga parte dela: a parcela fica
 *   paga nesse valor e o restante continua pendente, com o mesmo vencimento e o mesmo número de parcela.
 * - Empréstimo: cada pagamento vira uma ocorrência paga na data, e o que ainda falta é previsto de novo a
 *   partir do saldo (ver \`replanejarEmprestimo\`). O que passar do saldo é multa e juros.
 */
export function aplicarPagamento(
  contrato: ContratoDoPagamento,
  lista: Ocorrencia[],
  pagamento: Pagamento,
  // Só o empréstimo precisa datar a previsão nova.
  datar: DatarMes = semDatas,
): ResultadoDoPagamento {
  const valor = Math.abs(pagamento.cents);
  if (valor === 0) return "bloqueada";
  if (!ehSerie(contrato.category)) {
    const number = ocorrenciaDoPagamento(lista, pagamento.date);
    if (number == null) return "bloqueada";
    return {
      lista: lista.map((item) =>
        item.number === number ? pagarOcorrencia(item, comSinal(valor, contrato.mode), pagamento.date, pagamento.paymentId) : item,
      ),
    };
  }
  if (contrato.category === "loan") return { lista: pagarEmprestimo(contrato, lista, pagamento, valor, datar) };
  return pagarParcelas(contrato, lista, pagamento, valor);
}

function pagarParcelas(contrato: ContratoDoPagamento, lista: Ocorrencia[], pagamento: Pagamento, valor: number): ResultadoDoPagamento {
  const pendentes = pendentesEmOrdem(lista);
  if (pendentes.length === 0) return "bloqueada";
  let restante = valor;
  let proxima = [...lista];
  let inteiras = 0;
  for (const parcela of pendentes) {
    const planejado = Math.abs(parcela.plannedCents);
    if (restante < planejado) break;
    proxima = proxima.map((item) =>
      item.number === parcela.number ? pagarOcorrencia(item, comSinal(planejado, contrato.mode), pagamento.date, pagamento.paymentId) : item,
    );
    restante -= planejado;
    inteiras += 1;
  }
  if (restante === 0) return { lista: renumerar(proxima) };
  const seguinte = pendentes[inteiras];
  if (!seguinte) {
    // Pagou tudo e ainda sobrou: só pode ser multa e juros da última parcela.
    const ultima = pendentes[pendentes.length - 1]!;
    return { lista: renumerar(inserirDepois(proxima, ultima, multa(ultima, restante, contrato.mode, pagamento))) };
  }
  if (inteiras === 0) {
    // Menos que a parcela: paga parte dela e deixa o restante pendente.
    return { lista: renumerar(pagarEmParte(proxima, seguinte, restante, contrato.mode, pagamento)) };
  }
  if (pagamento.diferenca === "proxima") {
    return { lista: renumerar(pagarEmParte(proxima, seguinte, restante, contrato.mode, pagamento)) };
  }
  if (pagamento.diferenca === "multa") {
    const ultimaPaga = pendentes[inteiras - 1]!;
    return { lista: renumerar(inserirDepois(proxima, ultimaPaga, multa(ultimaPaga, restante, contrato.mode, pagamento))) };
  }
  return "escolha-diferenca";
}

function pagarEmParte(lista: Ocorrencia[], parcela: Ocorrencia, valor: number, mode: ModoTransacao, pagamento: Pagamento) {
  const planejado = Math.abs(parcela.plannedCents);
  const paga: Ocorrencia = {
    ...parcela,
    plannedCents: comSinal(valor, mode),
    status: "completed",
    paidCents: comSinal(valor, mode),
    paidOn: pagamento.date,
    paymentId: pagamento.paymentId,
  };
  const restante: Ocorrencia = {
    number: parcela.number,
    dueDate: parcela.dueDate,
    plannedCents: comSinal(planejado - valor, mode),
    paidCents: null,
    paidOn: null,
    status: "pending",
    kind: "parcela",
    parcel: parcela.parcel ?? parcela.number,
    paymentId: null,
  };
  const trocada = lista.map((item) => (item.number === parcela.number ? paga : item));
  return inserirDepois(trocada, paga, restante);
}

function multa(parcela: Ocorrencia, valor: number, mode: ModoTransacao, pagamento: Pagamento): Ocorrencia {
  return {
    number: parcela.number,
    dueDate: pagamento.date,
    plannedCents: comSinal(valor, mode),
    paidCents: comSinal(valor, mode),
    paidOn: pagamento.date,
    status: "completed",
    kind: "multa",
    parcel: parcela.parcel ?? parcela.number,
    paymentId: pagamento.paymentId,
  };
}

function pagarEmprestimo(contrato: ContratoDoPagamento, lista: Ocorrencia[], pagamento: Pagamento, valor: number, datar: DatarMes) {
  const { saldo } = saldoDaLista(contrato, lista);
  const abate = Math.min(valor, saldo);
  const pagas = lista.filter((item) => item.status !== "pending");
  const numeroDaParcela = pagas.filter((item) => item.status === "completed" && !ehMulta(item)).length + 1;
  const nova: Ocorrencia[] = [];
  if (abate > 0) {
    nova.push({
      number: 0,
      dueDate: pagamento.date,
      plannedCents: comSinal(abate, contrato.mode),
      paidCents: comSinal(abate, contrato.mode),
      paidOn: pagamento.date,
      status: "completed",
      kind: "parcela",
      parcel: numeroDaParcela,
      paymentId: pagamento.paymentId,
    });
  }
  if (valor > abate) {
    nova.push({
      number: 0,
      dueDate: pagamento.date,
      plannedCents: comSinal(valor - abate, contrato.mode),
      paidCents: comSinal(valor - abate, contrato.mode),
      paidOn: pagamento.date,
      status: "completed",
      kind: "multa",
      parcel: numeroDaParcela,
      paymentId: pagamento.paymentId,
    });
  }
  return replanejarEmprestimo(contrato, [...pagas, ...nova], datar);
}

/** O total combinado, o que já foi pago (sem multa) e o saldo, a partir das ocorrências. */
export function saldoDaLista(contrato: ContratoDoPagamento, lista: Ocorrencia[]) {
  const principal = Math.abs(contrato.principalCents ?? Math.abs(contrato.cents) * (contrato.installments ?? 1));
  const pago = lista
    .filter((item) => item.status === "completed" && !ehMulta(item))
    .reduce((soma, item) => soma + Math.abs(item.paidCents ?? item.plannedCents), 0);
  return { principal, pago, saldo: Math.max(principal - pago, 0) };
}

/**
 * O que ainda falta no empréstimo, previsto de novo: a parcela combinada por mês a partir do mês seguinte ao
 * último pagamento (ou do primeiro vencimento, se nada foi pago), até o saldo acabar. As ocorrências resolvidas
 * ficam; as pendentes são refeitas.
 */
export function replanejarEmprestimo(contrato: ContratoDoPagamento, lista: Ocorrencia[], datar: DatarMes): Ocorrencia[] {
  const resolvidas = lista
    .filter((item) => item.status !== "pending")
    .sort((a, b) => (a.paidOn ?? a.dueDate).localeCompare(b.paidOn ?? b.dueDate) || a.number - b.number);
  const { saldo } = saldoDaLista(contrato, resolvidas);
  const parcela = Math.abs(contrato.cents) > 0 ? Math.abs(contrato.cents) : saldo;
  const primeiraPendente = pendentesEmOrdem(lista)[0];
  const ultimoPagamento = resolvidas.filter((item) => item.status === "completed").map((item) => item.paidOn ?? item.dueDate).sort().at(-1);
  // O mês de partida: depois do último pagamento; sem pagamento, o primeiro vencimento previsto.
  let [ano, mes] = (ultimoPagamento ? proximoMes(ultimoPagamento) : (primeiraPendente?.dueDate ?? proximoMes(diaDeHoje())))
    .split("-")
    .map(Number) as [number, number];
  const previstas: Ocorrencia[] = [];
  let falta = saldo;
  let numeroDaParcela = resolvidas.filter((item) => item.status === "completed" && !ehMulta(item)).length;
  while (falta > 0 && parcela > 0 && previstas.length < 600) {
    const valor = Math.min(parcela, falta);
    numeroDaParcela += 1;
    previstas.push({
      number: 0,
      dueDate: datar(ano, mes),
      plannedCents: comSinal(valor, contrato.mode),
      paidCents: null,
      paidOn: null,
      status: "pending",
      kind: "parcela",
      parcel: numeroDaParcela,
      paymentId: null,
    });
    falta -= valor;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return renumerar([...resolvidas, ...previstas]);
}

function proximoMes(iso: string) {
  const [ano, mes] = iso.split("-").map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

function diaDeHoje() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/**
 * Desfaz um pagamento pelo id: a multa some, a parcela paga volta a pendente e a parcela paga em parte volta a
 * ser inteira (junta com o restante que ficou pendente). No empréstimo, o que falta é previsto de novo.
 * "bloqueada" quando o restante de uma parcela paga em parte já foi pago por outro pagamento.
 */
export function desfazerPagamento(
  contrato: ContratoDoPagamento,
  lista: Ocorrencia[],
  paymentId: string,
  datar: DatarMes,
): { lista: Ocorrencia[] } | "ausente" | "bloqueada" {
  const alvo = lista.filter((item) => item.paymentId === paymentId);
  if (alvo.length === 0) return "ausente";
  if (contrato.category === "loan") {
    const semEle = lista.filter((item) => item.paymentId !== paymentId);
    return { lista: replanejarEmprestimo(contrato, semEle, datar) };
  }
  let proxima = lista.filter((item) => !(item.paymentId === paymentId && ehMulta(item)));
  for (const paga of alvo.filter((item) => !ehMulta(item))) {
    const indice = proxima.findIndex((item) => item.number === paga.number);
    if (indice < 0) continue;
    const seguinte = proxima[indice + 1];
    const restante =
      seguinte && seguinte.status === "pending" && (seguinte.parcel ?? seguinte.number) === (paga.parcel ?? paga.number) && seguinte.dueDate === paga.dueDate
        ? seguinte
        : null;
    // A parte paga antes só volta a ser inteira se o restante dela ainda está pendente. Se o restante já foi pago
    // por outro pagamento (vem depois dela, com o mesmo número de parcela), desfaz-se aquele primeiro.
    const restanteFoiPago =
      !restante &&
      proxima.some(
        (item) =>
          item.number > paga.number &&
          (item.parcel ?? item.number) === (paga.parcel ?? paga.number) &&
          item.dueDate === paga.dueDate &&
          item.status !== "pending" &&
          !ehMulta(item) &&
          item.paymentId !== paymentId,
      );
    if (restanteFoiPago) return "bloqueada";
    const inteira: Ocorrencia = {
      ...paga,
      plannedCents: paga.plannedCents + (restante?.plannedCents ?? 0),
      paidCents: null,
      paidOn: null,
      status: "pending",
      paymentId: null,
    };
    proxima = proxima.filter((item) => item !== restante).map((item) => (item.number === paga.number ? inteira : item));
  }
  return { lista: renumerar(proxima) };
}

/** O último pagamento registrado no lançamento, pela data, para o botão de desfazer. */
export function ultimoPagamento(lista: Ocorrencia[]) {
  const pagas = lista.filter((item) => item.status === "completed" && item.paymentId);
  pagas.sort((a, b) => (b.paidOn ?? b.dueDate).localeCompare(a.paidOn ?? a.dueDate) || b.number - a.number);
  return pagas[0]?.paymentId ?? null;
}
