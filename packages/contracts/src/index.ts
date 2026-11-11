import { z } from "zod";

export type TenantId = string;

export type Grupo = {
  id: string;
  name: string;
  description: string;
};

export const TIPOS_SESSAO = ["valor", "acumulo"] as const;

/** Como a pessoa vê o tipo da sessão. Fixo guarda uma transação por mês; Acúmulo junta várias no mês. */
export const ROTULO_DO_TIPO_DE_SESSAO: Record<(typeof TIPOS_SESSAO)[number], string> = {
  valor: "Fixo",
  acumulo: "Acúmulo",
};
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
  /** Fixo: os meses em que a sessão já tem a transação dela. Acúmulo: sempre vazio. */
  occupiedMonths: MesOcupado[];
  cents: number;
  additions: Acrescimo[];
  totalCents: number;
  /** Acúmulo: o teto de saídas por mês que a pessoa combinou consigo. null: sem limite. */
  limitCents: number | null;
};

/** Quanto da sessão com limite já foi usado num mês, para avisar antes de estourar. */
export type UsoDoLimite = {
  sessionId: string;
  sessionName: string;
  groupName: string;
  limitCents: number;
  /** As saídas do mês nessa sessão, em valor positivo. */
  usedCents: number;
  /** 0 a 100, podendo passar de 100. */
  percent: number;
};

/** O aviso sai ao passar deste ponto e, de novo, ao passar do limite. */
export const AVISO_DO_LIMITE_EM = 80;

/**
 * O uso de cada sessão com limite no mês: soma as saídas dos lançamentos dela (pelo que está agendado no mês).
 * Sessão sem limite não entra.
 */
export function usoDosLimites(sessions: Sessao[], entries: Lancamento[], workflow: Workflow, year: number, month: number, groupName: (groupId: string) => string): UsoDoLimite[] {
  const lista: UsoDoLimite[] = [];
  for (const session of sessions) {
    if (session.limitCents === null || session.limitCents <= 0 || session.endedAt) continue;
    let usedCents = 0;
    for (const entry of entries) {
      if (entry.sessionId !== session.id) continue;
      const valor = centavosNoMes(entry, workflow, year, month - 1);
      if (valor !== undefined && valor < 0) usedCents -= valor;
    }
    lista.push({
      sessionId: session.id,
      sessionName: session.name,
      groupName: groupName(session.groupId),
      limitCents: session.limitCents,
      usedCents,
      percent: Math.round((usedCents / session.limitCents) * 100),
    });
  }
  return lista.sort((a, b) => b.percent - a.percent || a.sessionName.localeCompare(b.sessionName, "pt-BR"));
}

/**
 * Um mês ("AAAA-MM") em que a sessão Fixo já tem a transação: o valor dela e o total com as partes. A parcela, o
 * empréstimo e a fixa ocupam cada mês em que vencem.
 */
export type MesOcupado = { month: string; cents: number; totalCents: number };

export function chaveDoMes(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** A transação que a sessão Fixo já tem nesse mês, ou null. Acúmulo nunca está ocupado. */
export function mesOcupado(sessao: Pick<Sessao, "kind" | "occupiedMonths">, year: number, month: number) {
  if (sessao.kind !== "valor") return null;
  return sessao.occupiedMonths.find((item) => item.month === chaveDoMes(year, month)) ?? null;
}

/** A sessão recebe um lançamento novo nesse mês: Acúmulo sempre; Fixo só quando o mês ainda está livre. */
export function sessaoAceitaNoMes(sessao: Pick<Sessao, "kind" | "occupiedMonths">, year: number, month: number) {
  return mesOcupado(sessao, year, month) === null;
}

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

/** Parcela é a ocorrência normal; multa é o que foi pago a mais numa parcela atrasada (multa e juros). */
export const TIPOS_DE_OCORRENCIA = ["parcela", "multa"] as const;
export type TipoDeOcorrencia = (typeof TIPOS_DE_OCORRENCIA)[number];

export type Ocorrencia = {
  number: number;
  dueDate: string;
  plannedCents: number;
  paidCents: number | null;
  paidOn: string | null;
  status: StatusTransacao;
  /** Ausente vale "parcela". */
  kind?: TipoDeOcorrencia;
  /** Na parcela e no empréstimo: qual parcela do contrato esta ocorrência é (o restante de uma parcela paga em parte repete o número). */
  parcel?: number | null;
  /** O pagamento que resolveu esta ocorrência: uma linha do extrato ou um pagamento registrado à mão. Serve para desfazer. */
  paymentId?: string | null;
};

/** Quando o pagamento passa da parcela: a sobra é multa e juros, ou parte da próxima parcela. */
export const DIFERENCAS_DO_PAGAMENTO = ["multa", "proxima"] as const;
export type DiferencaDoPagamento = (typeof DIFERENCAS_DO_PAGAMENTO)[number];

/** Um pagamento registrado numa parcela ou num empréstimo: data e valor reais, sem sinal. */
export type PedidoDePagamento = { date: string; cents: number; diferenca?: DiferencaDoPagamento };

/** Parcela e empréstimo: o pagamento não segue o mês, segue o que ainda falta. */
export function ehSerie(category: CategoriaTransacao) {
  return category === "installment" || category === "loan";
}

/** O mês em que a ocorrência conta: o do pagamento, quando paga; o do vencimento, enquanto pendente. */
export function dataContabil(item: Ocorrencia) {
  return item.status === "completed" && item.paidOn ? item.paidOn : item.dueDate;
}

export function ehMulta(item: Ocorrencia) {
  return item.kind === "multa";
}

/** O empréstimo como contrato: o total combinado, o que já foi pago e o que falta. Multa e juros não abatem. */
export function saldoDoEmprestimo(entry: Pick<Lancamento, "cents" | "installments" | "principalCents" | "occurrences" | "type" | "months">) {
  const principal = Math.abs(entry.principalCents ?? Math.abs(entry.cents) * (entry.installments ?? 1));
  const pago = ocorrenciasDoLancamento(entry as Lancamento)
    .filter((item) => item.status === "completed" && !ehMulta(item))
    .reduce((soma, item) => soma + Math.abs(item.paidCents ?? item.plannedCents), 0);
  return { principal, pago, saldo: Math.max(principal - pago, 0) };
}

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

/**
 * Reais digitados em centavos, com sinal. Vale "1.234,56", "1234.56", "-50" e "R$ 12,5": com vírgula, o ponto é de
 * milhar; sem vírgula, "12.5" e "12.50" são decimais e "1.234" é milhar. null quando não é um valor (letras, mais de
 * duas casas) ou passa do que o banco guarda. É a única leitura de reais do sistema: a web e o celular a usam.
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return null;
  const negativo = limpo.startsWith("-") || limpo.startsWith("−");
  let corpo = limpo.replace(/^[-−]/, "");
  if (corpo.includes(",")) corpo = corpo.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(corpo)) corpo = corpo.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(corpo)) return null;
  const [inteiro = "", fracao = ""] = corpo.split(".");
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos > 2_147_483_647) return null;
  return negativo && centavos ? -centavos : centavos;
}

const VALOR_COM_CENTAVOS = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Os dígitos digitados como valor em reais, com os centavos entrando pela direita: "123456" vira "1.234,56". */
export function mascaraDeValor(digitos: string): string {
  const so = digitos.replace(/\D/g, "");
  if (!so) return "";
  const limpo = so.replace(/^0+/, "");
  if (!limpo) return VALOR_COM_CENTAVOS.format(0);
  const corte = limpo.length > 10 ? limpo.slice(0, 10) : limpo;
  if (Number(corte) > 2_147_483_647) return mascaraDeValor(corte.slice(0, -1));
  return VALOR_COM_CENTAVOS.format(Number(corte) / 100);
}

/** O campo de valor depois de uma digitação: `anterior` é o que ele mostrava e `texto` o que ficou depois do toque. */
export function proximaMascara(anterior: string, texto: string): string {
  const velhos = anterior.replace(/\D/g, "");
  const novos = texto.replace(/\D/g, "");
  const significativos = velhos.replace(/^0+/, "");
  if (novos.length < velhos.length) return mascaraDeValor(significativos.slice(0, -1));
  if (novos.length > velhos.length) return mascaraDeValor(significativos + novos.slice(velhos.length));
  return mascaraDeValor(novos);
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
  /** Empréstimo: de quem é (quem emprestou ou quem recebeu). */
  counterparty?: string;
  /** Empréstimo: o total combinado. O saldo é ele menos o que já foi pago. */
  principalCents?: number | null;
  /** Preenchido: este valor já entra em outro lançamento e não soma de novo na sobra. */
  coveredById?: string | null;
  /** A conta de onde sai ou em que entra. Sem conta, o lançamento só conta na sobra. */
  accountId?: string | null;
  /** Transferência entre contas da própria pessoa: muda o saldo das contas e não entra na sobra. */
  transfer?: boolean;
  /** Os dois lados de uma transferência dividem este id. Apagar um apaga o outro. */
  pairId?: string | null;
  /** A sobra do mês AAAA-MM levada para o mês seguinte. O sistema cria e recalcula; não entra na sobra acumulada. */
  carryOf?: string | null;
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
  /** Multa e juros pagos numa parcela atrasada. */
  fee: boolean;
  remove: "entry" | "occurrence" | null;
  synced: boolean;
  /** Transferência entre contas próprias: aparece na lista, mas não soma na sobra. */
  transfer: boolean;
  /** A conta do lançamento; null sem conta. */
  accountId?: string | null;
  /** O pagamento registrado que resolveu a ocorrência: desfazer_pagamento usa este id. */
  paymentId?: string | null;
  /** Empréstimo: de quem é. */
  counterparty?: string;
  /** Este valor já entra em outro lançamento (o id dele) e não soma de novo na sobra. */
  coveredById?: string | null;
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
  /** As sessões com limite e o uso delas no mês da resposta. O serviço preenche; a vista pura não tem. */
  limits?: UsoDoLimite[];
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
  if (entry.coveredById || entry.transfer) return undefined;
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

/**
 * A sobra que passou de mês em mês desde o início do workflow até o mês pedido, inclusive: tudo o que entrou e
 * não saiu. O que foi separado para uma meta é saída na sessão dela, então já não está aqui.
 */
export function sobraAcumulada(entries: Lancamento[], workflow: Workflow, year: number, monthIndex: number) {
  // A sobra levada de um mês para o outro já é a soma dos meses anteriores: contar de novo dobraria.
  entries = entries.filter((entry) => !entry.carryOf);
  let total = 0;
  for (let ano = workflow.year; ano <= year; ano += 1) {
    const inicio = ano === workflow.year ? workflow.month - 1 : 0;
    const fim = ano === year ? monthIndex : 11;
    for (let mes = inicio; mes <= fim; mes += 1) total += totaisDoMes(entries, workflow, ano, mes).sobra;
  }
  return total;
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
      noMes(dataContabil(item), year, monthIndex) &&
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

/**
 * Até que ano a fixa sem fim gera ocorrências: o ano seguinte ao atual (ou ao de início, se for depois). A grade
 * cresce sozinha conforme o tempo passa; o que já foi gravado não muda.
 */
export function horizonteDaFixa(startYear: number, hoje = new Date()) {
  return Math.max(startYear, hoje.getFullYear()) + 1;
}

/** Junta à grade gravada as ocorrências novas que a grade de hoje alcança (a fixa que entrou em outro ano). */
export function estenderGrade(gravadas: Ocorrencia[], grade: Ocorrencia[]): Ocorrencia[] {
  const maior = gravadas.reduce((max, item) => Math.max(max, item.number), 0);
  const novas = grade.filter((item) => item.number > maior);
  return novas.length ? [...gravadas, ...novas] : gravadas;
}

export function gradeDoLancamento(
  entry: ContratoLancamento,
  calendario: CalendarioDeDiasUteis = CALENDARIO_NACIONAL,
  ateAno = horizonteDaFixa(entry.startYear),
): Ocorrencia[] {
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
    return datasFixas(entry, calendario, ateAno).map((dueDate, index) =>
      montarOcorrencia(index + 1, dueDate, entry.cents, entry, entry.status),
    );
  }
  const total = entry.installments ?? 0;
  const lista: Ocorrencia[] = [];
  for (let parcela = 0; parcela < total; parcela += 1) {
    const absoluto = indice(entry.startYear, entry.startMonth - 1) + parcela;
    const year = Math.floor(absoluto / 12);
    const month = (absoluto % 12) + 1;
    lista.push({
      ...montarOcorrencia(
        parcela + 1,
        dataPelaRegra(year, month, entry.day, entry.dueRule ?? REGRA_SEM_AJUSTE, calendario),
        entry.type === "empréstimo" ? centavosDaPrestacao(entry.cents) : entry.cents,
        entry,
        entry.status,
      ),
      kind: "parcela",
      parcel: parcela + 1,
    });
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

// A fixa não para em dezembro: as datas seguem do ano de início até `ateAno`, inclusive.
function datasFixas(entry: ContratoLancamento, calendario: CalendarioDeDiasUteis, ateAno: number) {
  const regra = entry.dueRule ?? REGRA_SEM_AJUSTE;
  const recurrence = entry.recurrence ?? "monthly";
  const passo = Math.max(entry.recurrenceInterval ?? 1, 1);
  const anos: number[] = [];
  for (let year = entry.startYear; year <= Math.max(ateAno, entry.startYear); year += 1) anos.push(year);
  if (recurrence === "weekly" || recurrence === "customize") {
    const stepDays = recurrence === "weekly" ? 7 * passo : passo;
    const datas: string[] = [];
    for (const year of anos) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        datas.push(...datasNoMes(entry.startYear, entry.startMonth, entry.day, year, monthIndex, stepDays));
      }
    }
    // Semanal e a cada N dias: "Nº dia útil" não se aplica; só o ajuste quando cai em dia não útil.
    return datas.map((data) => ajustarAoDiaUtil(data, { ...regra, tipo: "dia" }, calendario));
  }
  const datas: string[] = [];
  for (const year of anos) {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const vezes = vezesDaRecorrencia(recurrence, passo, entry.startYear, entry.startMonth, entry.day, year, monthIndex);
      if (vezes === 1) datas.push(dataPelaRegra(year, monthIndex + 1, entry.day, regra, calendario));
    }
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

/** fixed: uma vez. periodical: todo mês. time: todo mês até uma data. weekly: toda semana. yearly: todo ano. */
export const CATEGORIAS_COMPROMISSO = ["fixed", "periodical", "time", "weekly", "yearly"] as const;

export type CategoriaCompromisso = (typeof CATEGORIAS_COMPROMISSO)[number];

export const STATUS_COMPROMISSO = ["done", "undone"] as const;

export const REPETICOES_DE_TAREFA = ["daily", "weekdays", "weekly", "monthly"] as const;
export type RepeticaoDeTarefa = (typeof REPETICOES_DE_TAREFA)[number];

export const ROTULO_DA_REPETICAO: Record<RepeticaoDeTarefa, string> = {
  daily: "Todo dia",
  weekdays: "Dias úteis",
  weekly: "Toda semana",
  monthly: "Todo mês",
};

/** Uma tarefa escrita pela pessoa na aba Hoje. A que não foi feita segue para os dias seguintes. */
export type Tarefa = {
  id: string;
  title: string;
  /** O dia para o qual ela foi escrita. */
  date: string;
  /** O dia em que foi feita; null enquanto aberta. */
  doneOn: string | null;
  position: number;
  /** A atividade de que esta é subatividade; null nas atividades da raiz. A árvore tem a profundidade que a pessoa quiser. */
  parentId: string | null;
  /** Só na raiz: ao ser feita, a tarefa nasce de novo no próximo dia da regra, com as subatividades abertas. */
  repeat: RepeticaoDeTarefa | null;
  /**
   * Item do checklist de um compromisso, no dia `date` da ocorrência. Não fica para o dia seguinte nem repete:
   * o compromisso que repete tem um checklist por dia. null nas tarefas soltas.
   */
  appointmentId: string | null;
};

/** `appointmentId` só na raiz: a subatividade herda o compromisso da atividade. */
export type PedidoDeTarefa = { title: string; date: string; parentId?: string | null; repeat?: RepeticaoDeTarefa | null; appointmentId?: string | null };

/**
 * Mover uma tarefa: para dentro de outra (`parentId`) ou para a raiz (null), antes de `beforeId` ou no fim das irmãs.
 * Na raiz, `appointmentId` leva a tarefa (com a árvore dela) para o checklist do compromisso no dia `date`; null a
 * devolve para as tarefas soltas, no dia `date`. Ausente: fica na lista em que está.
 */
export type PedidoDeMovimento = { parentId: string | null; beforeId?: string | null; appointmentId?: string | null; date?: string };

export type CompromissoDoDia = {
  id: string;
  title: string;
  time: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  calendar: NomeAgenda;
  status: StatusCompromisso;
  /** O compromisso repete (toda semana, todo mês, todo ano): o checklist de outro dia pode ser trazido para este. */
  repeats: boolean;
};

/** Traz para o dia o checklist da última ocorrência do compromisso que tinha um, com tudo aberto. */
export type PedidoDeCopiaDoChecklist = { date: string };

/** Um vencimento que conta no dia: pendente no vencimento, ou pago nesse dia. */
export type VencimentoDoDia = {
  entryId: string;
  number: number;
  description: string;
  groupName: string;
  sessionName: string;
  category: CategoriaTransacao;
  cents: number;
  situation: SituacaoOcorrencia;
  dueDate: string;
  /** Parcela ou empréstimo: marcar registra um pagamento na data; desmarcar desfaz esse pagamento. */
  series: boolean;
  paymentId: string | null;
  counterparty: string;
};

export type PendenciaDoDia = {
  id: string;
  kind: "conferencia" | "sobra" | "limite";
  title: string;
  detail: string;
  href: string;
};

/** O dia inteiro numa lista: tarefas, compromissos, vencimentos e, quando é hoje, as pendências do sistema. */
/** Um compromisso que terminou sem gasto registrado: a Hoje e a notificação perguntam "teve gasto?". */
export type PerguntaDeGasto = {
  appointmentId: string;
  /** O dia da ocorrência ("AAAA-MM-DD"); o compromisso que repete tem uma pergunta por dia. */
  date: string;
  title: string;
  location: string;
  time: string | null;
  endTime: string | null;
  allDay: boolean;
  /** O instante em que a pergunta passou a valer: o fim do compromisso, ou as 20h do dia inteiro. */
  endedAt: string;
  /** "HH:MM" desse instante, no fuso do compromisso. */
  endedAtLocal: string;
  /** A sessão de gastos do compromisso, quando há; sem ela, a pessoa escolhe na hora de lançar. */
  sessionId: string | null;
  sessionLabel: string | null;
};

/** Responder com gasto: vira um lançamento único, de saída, já pago no dia do compromisso. */
export type PedidoDeGasto = { id: string; date: string; cents: number; sessionId: string; name?: string };

/** O que a pessoa tem livre até o fim do mês, para orientar o gasto do dia. */
export type SobraLivre = {
  /** A sobra deste mês mais o que veio dos anteriores, menos o que as metas já separaram. */
  cents: number;
  /** Só a sobra deste mês, com os vencimentos que ainda vão cair. */
  monthCents: number;
  /** O que veio dos meses anteriores. */
  carriedCents: number;
  /** O que as metas já separaram neste mês. */
  separatedCents: number;
  /** Dias até o fim do mês, contando hoje. */
  daysLeft: number;
  /** O livre dividido pelos dias que faltam. */
  perDayCents: number;
};

export type HojeResposta = {
  date: string;
  today: string;
  tarefas: Tarefa[];
  compromissos: CompromissoDoDia[];
  vencimentos: VencimentoDoDia[];
  pendencias: PendenciaDoDia[];
  /** Só em hoje; null quando o mês não tem base. */
  livre: SobraLivre | null;
  /** As sessões com limite e o uso delas no mês de hoje, da mais cheia para a mais folgada. */
  limites: UsoDoLimite[];
  /** Só em hoje: os compromissos de ontem e de hoje que terminaram sem gasto e sem resposta. */
  gastos: PerguntaDeGasto[];
  /** As sessões que acumulam, para lançar o gasto de um compromisso que não tem sessão. Vazio sem perguntas. */
  sessoesParaGasto: SessaoDaAgenda[];
};

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
  /** Depois do fim, o sistema pergunta se teve gasto. O dia inteiro só pergunta quando tem sessão de gastos. */
  askSpending: boolean;
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

export const TIPOS_DE_CONTA = ["conta", "cartao"] as const;
export type TipoDeConta = (typeof TIPOS_DE_CONTA)[number];
export const ROTULO_DO_TIPO_DE_CONTA: Record<TipoDeConta, string> = { conta: "Conta", cartao: "Cartão de crédito" };

export type Conta = {
  id: string;
  name: string;
  kind: TipoDeConta;
  /** O saldo no dia em que a pessoa começou a controlar a conta aqui. */
  openingCents: number;
  /** Esse dia (AAAA-MM-DD). Só o que acontece a partir dele conta no saldo. null: tudo conta (conta antiga). */
  openingOn: string | null;
  /** Cartão: o dia do mês em que a fatura fecha (1 a 28). */
  closingDay: number | null;
  /** Cartão: o dia do mês em que a fatura vence (1 a 28). */
  dueDay: number | null;
  /** Cartão: o limite. null: sem limite cadastrado. */
  limitCents: number | null;
};

/** `openingOn` ausente: na criação, hoje; na edição, a data que está. null: sem data, tudo conta. Os campos do cartão ausentes mantêm o que está. */
export type PedidoDeConta = {
  name: string;
  kind: TipoDeConta;
  openingCents: number;
  openingOn?: string | null;
  closingDay?: number | null;
  dueDay?: number | null;
  limitCents?: number | null;
};

/** O grupo e a sessão que recebem os dois lados de uma transferência entre contas (inclusive o pagamento da fatura). */
export const GRUPO_DAS_TRANSFERENCIAS = "Transferências";
export const SESSAO_DAS_TRANSFERENCIAS = "Entre contas";

export const STATUS_DA_FATURA = ["aberta", "fechada", "vencida", "paga"] as const;
export type StatusDaFatura = (typeof STATUS_DA_FATURA)[number];
export const ROTULO_DO_STATUS_DA_FATURA: Record<StatusDaFatura, string> = { aberta: "Aberta", fechada: "Fechada", vencida: "Vencida", paga: "Paga" };

/** Uma fatura do cartão: o ciclo que fecha em `closingDate` e vence em `dueDate`. */
export type Fatura = {
  /** AAAA-MM do fechamento: identifica a fatura. */
  month: string;
  closingDate: string;
  dueDate: string;
  /** As compras do ciclo, em valor positivo. Estorno abate. */
  totalCents: number;
  /** O que já foi pago desta fatura: as transferências para o cartão depois do fechamento. */
  paidCents: number;
  status: StatusDaFatura;
  itens: number;
};

export type LimiteDoCartao = {
  /** O que o cartão deve hoje: compras lançadas menos pagamentos, em valor positivo. */
  usadoCents: number;
  /** null sem limite cadastrado. */
  disponivelCents: number | null;
  percent: number | null;
};

export type FaturasResposta = { faturas: Fatura[]; limite: LimiteDoCartao };

export type PedidoDePagamentoDaFatura = { fromAccountId: string; cents: number; date: string; month: string };
/** Os dois lados de uma transferência: a saída na conta de origem e a entrada na de destino, com o mesmo `pairId`. */
export type ParDeTransferencia = { pairId: string; saida: Lancamento; entrada: Lancamento };
export type PagamentoDaFatura = ParDeTransferencia;

/** Transferir entre duas contas da própria pessoa. `note` é o texto livre que vira a descrição. */
export type PedidoDeTransferencia = { fromAccountId: string; toAccountId: string; cents: number; date: string; note?: string };

/** A linha do extrato é uma transferência com a conta `accountId`: saída da conta do extrato para ela, ou entrada vinda dela. */
export type PedidoDeTransferenciaDaLinha = { statementId: string; line: number; accountId: string };
export type TransferenciaDaLinha = {
  pairId: string;
  /** A linha do outro extrato que é o espelho desta, cruzada junto. null quando não há. */
  espelho: { statementId: string; line: number } | null;
};

function diaDoMes(year: number, monthIndex: number, day: number) {
  const ultimo = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, ultimo))).toISOString().slice(0, 10);
}

/** O fechamento do ciclo em que o dia cai: o dia de fechamento deste mês, ou do mês seguinte se o dia já passou dele. */
export function fechamentoDoCiclo(conta: Pick<Conta, "closingDay">, dia: string) {
  if (!conta.closingDay) return null;
  const [year, month, day] = dia.split("-").map(Number) as [number, number, number];
  return day <= conta.closingDay ? diaDoMes(year, month - 1, conta.closingDay) : diaDoMes(year, month, conta.closingDay);
}

/** O vencimento da fatura que fecha em `closingDate`: o dia de vencimento do mesmo mês, ou do seguinte se vem antes do fechamento. */
export function vencimentoDaFatura(conta: Pick<Conta, "closingDay" | "dueDay">, closingDate: string) {
  const [year, month] = closingDate.split("-").map(Number) as [number, number];
  const dueDay = conta.dueDay ?? conta.closingDay ?? 1;
  return dueDay > (conta.closingDay ?? 0) ? diaDoMes(year, month - 1, dueDay) : diaDoMes(year, month, dueDay);
}

/**
 * As últimas faturas do cartão, da mais antiga à atual (a que ainda está aberta). A compra entra na fatura do ciclo
 * da data dela; o pagamento (transferência para o cartão) entra na última fatura fechada antes da data dele.
 */
export function faturasDoCartao(conta: Conta, entries: Lancamento[], hoje: string, quantas = 6): Fatura[] {
  if (conta.kind !== "cartao" || !conta.closingDay || !conta.dueDay) return [];
  const [ano, mes] = (fechamentoDoCiclo(conta, hoje) as string).split("-").map(Number) as [number, number];
  const fechamentos: string[] = [];
  for (let atras = quantas - 1; atras >= 0; atras -= 1) fechamentos.push(diaDoMes(ano, mes - 1 - atras, conta.closingDay));
  const somas = new Map(fechamentos.map((data) => [data, { total: 0, pago: 0, itens: 0 }]));
  for (const entry of entries) {
    if (entry.accountId !== conta.id) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if ((item.status !== "pending" && item.status !== "completed") || !contaNoSaldo(item, conta.openingOn)) continue;
      const data = dataContabil(item);
      const valor = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
      if (entry.transfer) {
        const fechada = [...fechamentos].reverse().find((fechamento) => fechamento < data);
        const soma = fechada ? somas.get(fechada) : undefined;
        if (soma && valor > 0) soma.pago += valor;
        continue;
      }
      const soma = somas.get(fechamentoDoCiclo(conta, data) as string);
      if (!soma) continue;
      soma.total -= valor;
      soma.itens += 1;
    }
  }
  return fechamentos.map((closingDate) => {
    const soma = somas.get(closingDate) as { total: number; pago: number; itens: number };
    const dueDate = vencimentoDaFatura(conta, closingDate);
    const status: StatusDaFatura =
      hoje <= closingDate ? "aberta" : soma.total <= 0 || soma.pago >= soma.total ? "paga" : hoje > dueDate ? "vencida" : "fechada";
    return { month: closingDate.slice(0, 7), closingDate, dueDate, totalCents: soma.total, paidCents: soma.pago, status, itens: soma.itens };
  });
}

/** O que o cartão deve hoje e quanto sobra do limite. */
export function limiteDoCartao(conta: Conta, entries: Lancamento[], hoje: string): LimiteDoCartao {
  const usadoCents = Math.max(-resumoDaConta(conta, entries, hoje).saldoCents, 0);
  if (!conta.limitCents) return { usadoCents, disponivelCents: null, percent: null };
  return { usadoCents, disponivelCents: conta.limitCents - usadoCents, percent: Math.round((usadoCents / conta.limitCents) * 100) };
}

/** O grupo que recebe a sessão dos ajustes de saldo. */
export const GRUPO_DOS_AJUSTES = "Ajustes";
export const SESSAO_DOS_AJUSTES = "Ajustes de saldo";

/** "O banco mostra R$ X no dia D": o sistema lança a diferença. `foraDaSobra` faz o ajuste não contar na sobra. */
export type PedidoDeAjusteDeSaldo = { saldoCents: number; date: string; foraDaSobra: boolean };
export type AjusteDeSaldo = { diferencaCents: number; entry: Lancamento | null };

/** Uma ocorrência conta no saldo a partir do dia do saldo inicial. Sem data, tudo conta. */
export function contaNoSaldo(item: Ocorrencia, openingOn: string | null) {
  return openingOn === null || dataContabil(item) >= openingOn;
}

export type MovimentoDaConta = {
  chave: string;
  date: string;
  descricao: string;
  detalhe: string;
  cents: number;
  pendente: boolean;
  /** Antes do dia do saldo inicial: aparece na lista, mas não entra no saldo. */
  foraDoSaldo: boolean;
  /** O saldo da conta depois deste movimento. O pendente é previsão. */
  saldo: number;
};

/**
 * Os movimentos de uma conta num mês, pela data em que contam, com o saldo correndo a partir do início do mês. O que
 * é anterior ao dia do saldo inicial aparece marcado e não muda o saldo.
 */
export function movimentosDoMes(
  conta: Conta,
  entries: Array<Lancamento & { groupName: string; sessionName: string }>,
  year: number,
  month: number,
) {
  const inicio = `${year}-${String(month).padStart(2, "0")}-01`;
  const chave = inicio.slice(0, 7);
  let saldoInicial = conta.openingCents;
  const doMes: Omit<MovimentoDaConta, "saldo">[] = [];
  for (const entry of entries) {
    if (entry.accountId !== conta.id) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (item.status !== "pending" && item.status !== "completed") continue;
      const data = dataContabil(item);
      const cents = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
      const noSaldo = contaNoSaldo(item, conta.openingOn);
      if (data < inicio) {
        if (item.status === "completed" && noSaldo) saldoInicial += cents;
        continue;
      }
      if (!data.startsWith(chave)) continue;
      doMes.push({
        chave: `${entry.id}:${item.number}`,
        date: data,
        descricao: entry.name || entry.description,
        detalhe: [item.kind === "multa" ? "Multa e juros" : "", `${entry.groupName} › ${entry.sessionName}`].filter(Boolean).join(" · "),
        cents,
        pendente: item.status === "pending",
        foraDoSaldo: !noSaldo,
      });
    }
  }
  doMes.sort((a, b) => a.date.localeCompare(b.date) || a.descricao.localeCompare(b.descricao, "pt-BR"));
  let saldo = saldoInicial;
  const movimentos: MovimentoDaConta[] = doMes.map((item) => {
    if (!item.foraDoSaldo) saldo += item.cents;
    return { ...item, saldo };
  });
  return { saldoInicial, movimentos, saldoFinal: saldo };
}

export type Patrimonio = {
  /** O saldo de hoje das contas (banco, carteira). */
  contasCents: number;
  caixinhasCents: number;
  /** O que está lançado na fatura dos cartões, em valor positivo. */
  cartoesCents: number;
  /** Contas e caixinhas, menos os cartões. */
  totalCents: number;
};

/** O que a pessoa tem num dia: contas e caixinhas, menos o que deve nos cartões. */
export function patrimonio(contas: Conta[], caixinhas: Caixinha[], entries: Lancamento[], dia: string): Patrimonio {
  let contasCents = 0;
  let cartoesCents = 0;
  for (const conta of contas) {
    const saldo = resumoDaConta(conta, entries, dia).saldoCents;
    if (conta.kind === "cartao") cartoesCents -= saldo;
    else contasCents += saldo;
  }
  const caixinhasCents = caixinhas.reduce((soma, caixinha) => soma + resumoDaCaixinha(caixinha, entries, dia).saldoCents, 0);
  return { contasCents, caixinhasCents, cartoesCents, totalCents: contasCents + caixinhasCents - cartoesCents };
}

/** O que a tela de Contas mostra, de uma vez: o patrimônio, o saldo de hoje de cada conta e de cada caixinha. */
export type SaldosResposta = {
  hoje: string;
  patrimonio: Patrimonio;
  contas: Array<{ id: string; name: string; kind: TipoDeConta; saldoCents: number; previstoCents: number; openingOn: string | null }>;
  caixinhas: Array<{ id: string; name: string; accountId: string; goalId: string | null; saldoCents: number; rendimentoDoMesCents: number }>;
  evolucao: Array<{ month: string; totalCents: number }>;
};

/** O patrimônio no fim de cada um dos últimos meses (o mês de hoje vale até hoje), do mais antigo ao atual. */
export function evolucaoDoPatrimonio(contas: Conta[], caixinhas: Caixinha[], entries: Lancamento[], hoje: string, meses = 6) {
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const lista: Array<{ month: string; totalCents: number }> = [];
  for (let atras = meses - 1; atras >= 0; atras -= 1) {
    const data = new Date(Date.UTC(ano, mes - 1 - atras, 1));
    const month = data.toISOString().slice(0, 7);
    const dia = atras === 0 ? hoje : `${month}-31`;
    lista.push({ month, totalCents: patrimonio(contas, caixinhas, entries, dia).totalCents });
  }
  return lista;
}

export type ContasResposta = { accounts: Conta[]; boxes: Caixinha[] };

/** O grupo que guarda a sessão das sobras de cada mês e uma sessão por caixinha. */
export const GRUPO_DA_CONTA = "Conta";
/** O grupo que recebe uma sessão por caixinha: o mesmo da conta. */
export const GRUPO_DAS_CAIXINHAS = GRUPO_DA_CONTA;
/** A sessão que recebe, no começo de cada mês, a sobra (ou a falta) do mês anterior. */
export const SESSAO_DAS_SOBRAS = "Sobras";

/** O que cada mês recebe do anterior: a sobra acumulada até o mês anterior, sem contar as próprias sobras levadas. */
export function sobrasALevar(entries: Lancamento[], workflow: Workflow, hoje: string) {
  const [anoDeHoje, mesDeHoje] = hoje.split("-").map(Number) as [number, number];
  const lista: Array<{ de: string; para: string; cents: number }> = [];
  let ano = workflow.year;
  let mes = workflow.month;
  let acumulado = 0;
  const limpos = entries.filter((entry) => !entry.carryOf);
  while (ano * 12 + mes < anoDeHoje * 12 + mesDeHoje) {
    acumulado += totaisDoMes(limpos, workflow, ano, mes - 1).sobra;
    const proximo = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
    lista.push({ de: `${ano}-${String(mes).padStart(2, "0")}`, para: `${proximo.ano}-${String(proximo.mes).padStart(2, "0")}`, cents: acumulado });
    ano = proximo.ano;
    mes = proximo.mes;
  }
  return lista;
}

/**
 * Caixinha (depósito) dentro de uma conta. A sessão dela, no grupo "Conta", guarda o rendimento de cada mês, as
 * aplicações (saem da conta e entram na caixinha) e os resgates (o contrário). Ligada a uma meta, o saldo dela conta
 * no guardado da meta, e o que a meta separa vira aplicação nela.
 */
export type Caixinha = {
  id: string;
  accountId: string;
  name: string;
  /** O que já estava na caixinha quando a pessoa começou a controlar aqui. */
  openingCents: number;
  /** Esse dia (AAAA-MM-DD). Só o que acontece a partir dele conta no saldo. null: tudo conta. */
  openingOn: string | null;
  sessionId: string;
  goalId: string | null;
};

export type PedidoDeCaixinha = { name: string; openingCents: number; openingOn?: string | null; goalId: string | null };

/** "A caixinha mostra R$ X no dia D": a diferença vira rendimento ou perda. */
export type PedidoDeSaldoDaCaixinha = { saldoCents: number; date: string };

export const MOVIMENTOS_DA_CAIXINHA = ["rendimento", "aplicacao", "resgate"] as const;
export type MovimentoDaCaixinha = (typeof MOVIMENTOS_DA_CAIXINHA)[number];
export const ROTULO_DO_MOVIMENTO_DA_CAIXINHA: Record<MovimentoDaCaixinha, string> = {
  rendimento: "Rendimento",
  aplicacao: "Aplicação",
  resgate: "Resgate",
};

/** Rendimento: valor com sinal (negativo é perda no mês). Aplicação e resgate: valor positivo. */
export type PedidoDeMovimentoNaCaixinha = { tipo: MovimentoDaCaixinha; cents: number; date: string };

/**
 * Quanto um lançamento da sessão da caixinha muda o saldo dela. Com conta, é aplicação ou resgate: o que sai da conta
 * entra na caixinha, e o que entra na conta sai dela. Sem conta, é rendimento.
 */
export function efeitoNaCaixinha(entry: Pick<Lancamento, "accountId">, valor: number) {
  return entry.accountId ? -valor : valor;
}

export type ResumoDaCaixinha = {
  /** O saldo inicial mais o que já foi aplicado e rendeu, menos o resgatado, até hoje. */
  saldoCents: number;
  /** O rendimento lançado no mês pedido. */
  rendimentoDoMesCents: number;
  /** Todo o rendimento lançado até hoje. */
  rendimentoTotalCents: number;
};

/** O resumo da caixinha pelos lançamentos já feitos na sessão dela. `mes` é "AAAA-MM"; sem ele, o mês de hoje. */
export function resumoDaCaixinha(caixinha: Caixinha, entries: Lancamento[], hoje: string, mes = hoje.slice(0, 7)): ResumoDaCaixinha {
  let saldo = caixinha.openingCents;
  let doMes = 0;
  let total = 0;
  for (const entry of entries) {
    if (entry.sessionId !== caixinha.sessionId) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (item.status !== "completed" || !contaNoSaldo(item, caixinha.openingOn)) continue;
      const data = dataContabil(item);
      const valor = item.paidCents ?? item.plannedCents;
      if (!entry.accountId && data.startsWith(mes)) doMes += valor;
      if (data > hoje) continue;
      saldo += efeitoNaCaixinha(entry, valor);
      if (!entry.accountId) total += valor;
    }
  }
  return { saldoCents: saldo, rendimentoDoMesCents: doMes, rendimentoTotalCents: total };
}

/** O que uma conta tem hoje e o que fica no fim do mês, pelos lançamentos ligados a ela. */
export type ResumoDaConta = {
  /** Saldo inicial mais o que já foi pago ou recebido até hoje. No cartão, o que já foi lançado na fatura. */
  saldoCents: number;
  /** O saldo depois do que ainda vence neste mês. No cartão, a fatura prevista. */
  previstoCents: number;
};

export function resumoDaConta(conta: Conta, entries: Lancamento[], hoje: string): ResumoDaConta {
  const fimDoMes = `${hoje.slice(0, 7)}-31`;
  let saldo = conta.openingCents;
  let pendente = 0;
  for (const entry of entries) {
    if (entry.accountId !== conta.id) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (!contaNoSaldo(item, conta.openingOn)) continue;
      if (item.status === "completed" && (item.paidOn ?? item.dueDate) <= hoje) saldo += item.paidCents ?? item.plannedCents;
      if (item.status === "pending" && item.dueDate <= fimDoMes) pendente += item.plannedCents;
    }
  }
  return { saldoCents: saldo, previstoCents: saldo + pendente };
}

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
  /** O que a pessoa escreveu sobre o extrato: a conta, o que cada nome é, o que ignorar. */
  observacao?: string;
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
  /** O que a pessoa escreveu junto com o extrato. Vazio quando não escreveu nada. */
  note: string;
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
  /** A pessoa marcou a linha como sem importância: não conta como pendente e não é lançada. */
  ignored: boolean;
  link: VinculoCruzado | null;
  /** A linha dividida: um vínculo por parte, com o valor da parte. Vazio quando a linha não foi dividida. */
  parts: VinculoCruzado[];
  /** Os nomes que a pessoa já deu a linhas com esta descrição, do mais recente ao mais antigo. */
  names: string[];
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

/**
 * O tipo do lançamento que nasce de uma linha da Conferência (ou de uma parte dela). Sem ele, a linha vira uma
 * única paga. Parcela e empréstimo pedem as parcelas, o empréstimo pede os juros e a recorrente diz como se repete.
 * O lançamento segue as mesmas regras do que é criado nas Finanças: a recorrente aparece nos meses seguintes, a
 * parcela vira compromisso, o extra é sempre entrada.
 */
export type TipoDaLinha = {
  category: CategoriaTransacao;
  installments?: number | null;
  installmentNumber?: number | null;
  /** Empréstimo: de quem é e o total combinado. A linha é o primeiro pagamento. */
  counterparty?: string | null;
  principalCents?: number | null;
  recurrence?: Recorrencia | null;
  recurrenceInterval?: number | null;
};

export const TIPO_UNICO_DA_LINHA: TipoDaLinha = { category: "unique" };

export const PARCELAS_MAXIMAS = 360;

/** O que impede a linha de virar esse tipo, ou null. `cents` é o valor da linha (ou da parte), com sinal. */
export function erroDoTipoDaLinha(tipo: TipoDaLinha, cents: number): string | null {
  if (tipo.category === "additional" && cents < 0) return "Extra é sempre entrada, e esta linha é uma saída.";
  if (tipo.category === "installment" && cents > 0) return "Parcela é sempre saída, e esta linha é uma entrada.";
  if (tipo.category === "installment") {
    const total = tipo.installments ?? null;
    const atual = tipo.installmentNumber ?? 1;
    if (total === null || !Number.isInteger(total) || total < 1 || total > PARCELAS_MAXIMAS) {
      return `Informe as parcelas, de 1 a ${PARCELAS_MAXIMAS}.`;
    }
    if (!Number.isInteger(atual) || atual < 1 || atual > total) return "Informe a parcela atual, até o total de parcelas.";
  }
  if (tipo.category === "loan") {
    if (!tipo.counterparty?.trim()) return "Informe de quem é o empréstimo.";
    const total = tipo.principalCents ?? null;
    if (total === null || !Number.isInteger(total) || total <= 0) return "Informe o total combinado do empréstimo.";
    if (total < Math.abs(cents)) return "O total do empréstimo é menor que esta linha.";
    const parcelas = tipo.installments ?? 1;
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > PARCELAS_MAXIMAS) return `Informe as parcelas, de 1 a ${PARCELAS_MAXIMAS}.`;
  }
  if (tipo.category === "fixed") {
    if (!tipo.recurrence) return "Informe como a recorrente se repete.";
    const intervalo = tipo.recurrenceInterval ?? 1;
    if (!Number.isInteger(intervalo) || intervalo < 1) return "Informe o intervalo da recorrência.";
  }
  return null;
}

/** O `TipoDaLinha` como o backend e o assistente recebem. */
export const ESQUEMA_DO_TIPO_DA_LINHA = z
  .object({
    category: z.enum(CATEGORIAS_TRANSACAO),
    installments: z.number().int().min(1).max(PARCELAS_MAXIMAS).optional(),
    installmentNumber: z.number().int().min(1).max(PARCELAS_MAXIMAS).optional(),
    counterparty: z.string().trim().min(1).max(80).optional(),
    principalCents: z.number().int().min(1).optional(),
    recurrence: z.enum(RECORRENCIAS).optional(),
    recurrenceInterval: z.number().int().min(1).optional(),
  })
  .describe(
    "O tipo do lançamento que nasce da linha. Sem ele, única. additional (extra) só em entrada; installment (parcela) só em saída e pede installments; loan (empréstimo) pede counterparty (a pessoa), principalCents (o total combinado) e installments (quantas parcelas combinadas); fixed (recorrente) pede recurrence (mensal se a pessoa não disser) e aparece nos meses seguintes.",
  );

/** Linhas sem lançamento que a conferência entrega por página ao consultor. A tela pede o mês inteiro. */
export const LINHAS_DA_CONFERENCIA_POR_PAGINA = 10;

/** Com `pagina` 0, a conferência devolve as linhas sem lançamento de uma vez, até este tanto. */
export const LINHAS_DA_CONFERENCIA_DE_UMA_VEZ = 200;

export type ConferenciaResposta = {
  year: number;
  month: number;
  pending: number;
  // O mês só está conferido quando há linhas e todas têm lançamento ou sessão.
  checked: boolean;
  lines: LinhaConferencia[];
  page?: { number: number; size: number; total: number };
};

/** O que "desfazer toda a conferência" fez: as linhas voltam a sem lançamento, como no dia da importação. */
export type ConferenciaDesfeita = {
  /** Linhas cruzadas ou divididas que voltaram a pendentes. */
  lines: number;
  /** Linhas ignoradas que voltaram à conferência. */
  reactivated: number;
  /** Nomes lembrados e associações de descrição que foram esquecidos. */
  names: number;
  /** Lançamentos do extrato que já estavam sem linha nenhuma e foram apagados. */
  orphans: number;
};

/** Uma linha de extrato ainda sem lançamento, de qualquer mês importado. */
export type LinhaDaSerie = { statementId: string; line: number; date: string; cents: number; description: string };

/**
 * Um mês em que a mesma compra aparece no extrato. `numero` é a parcela daquele mês. Na série que já existe,
 * `dueDate` e `plannedCents` são a ocorrência pendente daquele mês.
 */
export type MesDaSerieNoExtrato = {
  month: string;
  numero: number | null;
  dueDate: string | null;
  plannedCents: number | null;
  /** Antes da primeira ocorrência da série que já existe. Na recorrente, a linha desse mês entra como única. */
  antes: boolean;
  lines: LinhaDaSerie[];
};

/** "serie": a linha paga a ocorrência do mês. "parte": soma no mês, como única na mesma sessão. */
export const PAPEIS_DA_LINHA_NA_SERIE = ["serie", "parte"] as const;
export type PapelDaLinhaNaSerie = (typeof PAPEIS_DA_LINHA_NA_SERIE)[number];

export type EscolhaDaLinhaNaSerie = { statementId: string; line: number; papel: PapelDaLinhaNaSerie };

/** As linhas de outros meses que são a mesma compra da linha que vai virar parcela, empréstimo ou recorrente. */
export type PreviaDaSerie = { meses: MesDaSerieNoExtrato[] };

/** Uma parcela, empréstimo ou recorrente que já existe e tem linhas livres em outros meses importados. */
export type SerieComLinhas = {
  entryId: string;
  name: string;
  category: CategoriaTransacao;
  sessionId: string;
  sessionName: string;
  groupName: string;
  meses: MesDaSerieNoExtrato[];
};

export type SeriesComLinhasResposta = { series: SerieComLinhas[] };

/** O que lançar a série com as linhas fez: o lançamento, quantas entraram e as que falharam, com o motivo. */
export type SerieLancada = {
  entryId: string | null;
  launched: number;
  failed: FalhaDeAcumulo[];
};

/** "Desfazer toda a conferência" entrou na fila: roda em segundo plano e a central avisa quando termina. */
export type ConferenciaDesfazendo = { queued: true };

/** O aviso da central quando o desfazer da fila termina, ou falha. */
export type ConferenciaDesfeitaAviso = ConferenciaDesfeita & { concluido: true; userId: string | null; falhou?: string };

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
  /** A caixinha em que a meta guarda o dinheiro: o saldo dela soma no guardado, e o que a meta separa vai para ela. */
  box?: CaixinhaDaMeta | null;
};

export type CaixinhaDaMeta = { id: string; name: string; accountId: string; accountName: string; saldoCents: number };

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
  /** O que as metas disputam: a sobra deste mês mais o que sobrou dos meses anteriores e não foi separado. */
  surplusCents: number;
  /** Só a sobra deste mês, antes das metas. */
  monthSurplusCents: number;
  /** O que veio dos meses anteriores: a sobra acumulada até o mês passado, já sem o que foi separado neles. */
  carriedCents: number;
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
  /** A sobra que se acumulou desde o início do workflow até o fim do período: o que a pessoa tem livre de fato. */
  sobraAcumulada: number;
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

export const ANTECEDENCIA_MS: Record<Lembrete, number> = {
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
          title: entry.description || entry.name || entry.sessionName,
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
          // O assistente guarda o título em `name` e deixa `description` vazia; sem este fallback a linha ficava em branco.
          title: entry.description || entry.name,
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
    sobraAcumulada: sobraAcumulada(entries, workflow, year, scope === "ano" ? 11 : (month ?? 1) - 1),
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
    description: "Acesso, senha, perfil, usuários e notificações",
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

/** As operações depois das quais a sobra levada de um mês para o outro pode ter mudado. */
export function operacoesQueMudamASobra() {
  const extras = ["definir-workflow", "encerrar-sessao", "remover-sessao", "remover-grupo", "permanecer-ano", "importar-dados", "zerar-dados"];
  return [...[...INFO_DA_OPERACAO.entries()].filter(([, info]) => info.aggregate === "Lançamento").map(([operacao]) => operacao), ...extras];
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
    "seguir-valor-da-serie",
    "definir-conta",
    "atualizar-ocorrencia",
    "excluir-ocorrencia",
    "redatar-vencimentos",
  ]),
  ...grupo("financeiro", "Grupo", ["criar-grupo", "atualizar-grupo", "remover-grupo", "permanecer-ano", "reordenar-grupos"]),
  ...grupo("financeiro", "Sessão", ["criar-sessao", "atualizar-sessao", "encerrar-sessao", "remover-sessao", "reordenar-sessoes"]),
  ...grupo("financeiro", "Meta", ["criar-meta", "excluir-meta", "reordenar-metas", "dividir-sobra-das-metas", "aprovar-sobra-da-meta", "reabrir-sobra-da-meta"]),
  ...grupo("financeiro", "Feriado", ["criar-feriado-local", "remover-feriado-local"]),
  ...grupo("agenda", "Compromisso", [
    "criar-compromisso",
    "atualizar-compromisso",
    "excluir-compromisso",
    "atualizar-status-compromisso",
    "responder-gasto-compromisso",
  ]),
  ...grupo("agenda", "Calendário", ["sincronizar-google-agenda", "atualizar-fuso-calendario"]),
  ...grupo("agenda", "Tarefa do dia", ["criar-tarefa", "atualizar-tarefa", "concluir-tarefa", "mover-tarefa", "excluir-tarefa", "copiar-checklist"]),
  ...grupo("agenda", "Configurações", ["atualizar-fuso"]),
  ...grupo("financeiro", "Conta", ["criar-conta", "atualizar-conta", "remover-conta"]),
  ...grupo("financeiro", "Caixinha", ["criar-caixinha", "atualizar-caixinha", "excluir-caixinha", "ligar-meta-a-caixinha"]),
  ...grupo("extratos", "Extrato", ["importar-extrato", "reprocessar-extrato", "excluir-extrato", "associar-nome-extrato", "lembrar-nome-extrato", "esquecer-nome-extrato", "desfazer-conferencia"]),
  ...grupo("extratos", "Linha de extrato", ["cruzar-linha", "desfazer-cruzamento", "ignorar-linhas", "reativar-linhas", "dividir-linha", "desfazer-divisao"]),
  ...grupo("extratos", "Lançamento", ["pagar-pelo-extrato"]),
  ...grupo("agente", "Conversa", [
    "criar-conversa",
    "renomear-conversa",
    "fixar-conversa",
    "definir-pendencia-da-conversa",
    "remover-conversa",
    "remover-conversas",
    "expirar-conversas",
  ]),
  ...grupo("agente", "Mensagem", ["registrar-mensagem-do-assistente", "anexar-arquivo-ao-chat"]),
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
  ...grupo("conta", "Notificação", [
    "criar-notificacao",
    "ler-notificacao",
    "ler-todas-as-notificacoes",
    "salvar-preferencias-de-notificacao",
  ]),
  ...grupo("conta", "Aparelho", ["registrar-dispositivo", "remover-dispositivo", "esquecer-dispositivo"]),
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

export type ForcaDaSenha = { nivel: 0 | 1 | 2 | 3 | 4; rotulo: string };

/** Estimativa simples para orientar quem cria a senha, no web e no app. Quem decide se a senha vale é o backend. */
export function forcaDaSenha(senha: string): ForcaDaSenha {
  if (!senha) return { nivel: 0, rotulo: "" };
  if (senha.length < SENHA_MINIMA) return { nivel: 1, rotulo: "Curta" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((regra) => regra.test(senha)).length;
  const variedade = new Set(senha).size;
  let pontos = 2;
  if (senha.length >= 14) pontos += 1;
  if (classes >= 3 && variedade >= 6) pontos += 1;
  if (variedade < 5) pontos = 2;
  if (pontos >= 4) return { nivel: 4, rotulo: "Forte" };
  if (pontos === 3) return { nivel: 3, rotulo: "Boa" };
  return { nivel: 2, rotulo: "Razoável" };
}

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

/** Anexos de uma mensagem do chat: quantos, o tamanho de cada um e o total, em bytes. */
export const LIMITE_ANEXOS_DO_CHAT = 5;
export const LIMITE_ANEXO_DO_CHAT_BYTES = LIMITE_EXTRATO_BYTES;
export const LIMITE_ANEXOS_DO_CHAT_TOTAL_BYTES = 6 * 1024 * 1024;
/** O que a pessoa escreve junto com o extrato (a conta, o que é cada transferência, o que ignorar). */
export const LIMITE_OBSERVACAO_DO_EXTRATO = 1000;
/** Do arquivo de texto, o que o modelo lê na própria mensagem. O resto o modelo lê pela ferramenta. */
export const LIMITE_TEXTO_DO_ANEXO = 12_000;

/** O que a mensagem diz quando a pessoa só anexa arquivo e não escreve nada. */
export const TEXTO_SO_COM_ANEXO = "Anexei o arquivo.";

/** Extensões que o chat aceita como anexo: texto, que o modelo lê, e imagem ou PDF, que só viram extrato. */
export const EXTENSOES_DE_ANEXO_DO_CHAT = ["csv", "ofx", "txt", "tsv", "json", "md", "pdf", "png", "jpg", "jpeg", "webp"] as const;
const EXTENSOES_DE_ANEXO_EM_TEXTO: ReadonlySet<string> = new Set(["csv", "ofx", "txt", "tsv", "json", "md"]);

function extensaoDoArquivo(nome: string) {
  const ponto = nome.lastIndexOf(".");
  return ponto < 0 ? "" : nome.slice(ponto + 1).toLowerCase();
}

export function anexoAceito(nome: string) {
  return (EXTENSOES_DE_ANEXO_DO_CHAT as readonly string[]).includes(extensaoDoArquivo(nome));
}

/** Arquivo de texto: vai (até o limite) na mensagem que o modelo lê. Imagem e PDF não. */
export function anexoEmTexto(nome: string) {
  return EXTENSOES_DE_ANEXO_EM_TEXTO.has(extensaoDoArquivo(nome));
}

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
  | { tipo: "agente"; agente: AgenteIa }
  | { tipo: "anexo"; anexo: AnexoDaMensagem };

/** O anexo como a tela o vê, na mensagem. O conteúdo fica no servidor; o `id` é o que as ferramentas usam. */
export type AnexoDaMensagem = { id: string; name: string; mediaType: string; size: number };

/** O anexo como a tela o envia: o conteúdo em base64. */
export type AnexoDoPedido = { name: string; mediaType: string; content: string };

export type MensagemDoChat = {
  id: string;
  role: "user" | "assistant";
  partes: ParteDaMensagem[];
  agente: AgenteIa | null;
  createdAt: string;
};

/** `emAndamento`: o servidor está respondendo nesta conversa agora, mesmo que a pessoa tenha saído da tela. */
export type ConversaResumo = { id: string; title: string; updatedAt: string; pendente: boolean; pinned: boolean; emAndamento?: boolean };

/** O que a pessoa muda numa conversa pela lista: o título e se ela fica fixada no alto. */
export type AtualizacaoDaConversa = { title?: string; pinned?: boolean };

/** `emAndamento`: o servidor ainda está respondendo, mesmo que a tela tenha perdido a conexão. */
export type ConversaCompleta = ConversaResumo & { emAndamento: boolean; mensagens: MensagemDoChat[] };

export type PedidoDeMensagem = {
  conversationId: string | null;
  texto?: string;
  resposta?: { perguntaId: string; escolha: string };
  /** Arquivos que vão com a mensagem. Só valem junto com `texto`. */
  anexos?: AnexoDoPedido[];
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
  accountId: idDoSistema
    .nullable()
    .optional()
    .describe("A conta de onde o dinheiro sai ou em que entra (consultar_contas lista as contas). Sem conta, o lançamento só conta na sobra."),
  transfer: z
    .boolean()
    .optional()
    .describe(
      "Marca um lado de transferência entre contas da própria pessoa (fora da sobra). Para mover dinheiro entre contas, use transferir_entre_contas, que cria os dois lados; não crie transferência por aqui.",
    ),
  coveredById: idDoSistema
    .nullable()
    .optional()
    .describe(
      "\"Já entra em\": o id de outro lançamento da mesma conta que já conta este valor (por exemplo, a compra que já está dentro de outro lançamento). Assim ele não soma de novo na sobra. null tira.",
    ),
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
      "unique = única (avulsa); additional = extra (sempre entrada); installment = parcela (sempre saída, exige installments e installmentNumber); loan = empréstimo, um contrato com saldo (exige counterparty, a pessoa; principalCents, o total combinado; installments, as parcelas combinadas; cents é a parcela combinada; mode diz se a pessoa deve ou se devem a ela); fixed = fixa (recorrente, exige recurrence, recurrenceInterval e nextDueDate). Sessão do tipo 'valor' (Fixo) aceita unique, installment, loan e fixed, uma transação por mês: a única ocupa o mês dela, e parcela, empréstimo e fixa ocupam cada mês em que vencem. Mês já ocupado recusa outra; additional só entra em sessão de acúmulo.",
    ),
  cents: centavosPositivos,
  status: z
    .enum(STATUS_TRANSACAO)
    .optional()
    .describe("pending = pendente (padrão); completed = paga; cancelled = cancelada; refunded = estornada."),
  priority: z.enum(PRIORIDADES_TRANSACAO).optional().describe("low, normal, high ou nopriority. Padrão: nopriority."),
  installments: z.number().int().min(1).max(360).optional().describe("Total de parcelas."),
  installmentNumber: z.number().int().min(1).max(360).optional().describe("Parcela atual."),
  dueDate: dataDoSistema.optional().describe("Vencimento, se a pessoa disser."),
  interestRate: z.number().min(0).max(1000).optional().describe("Taxa de juros, em % ao mês, só como anotação."),
  counterparty: z.string().trim().min(1).max(80).optional().describe("Empréstimo: de quem é (quem emprestou ou quem recebeu)."),
  principalCents: z.number().int().min(1).optional().describe("Empréstimo: o total combinado, em centavos. O saldo é ele menos o que já foi pago."),
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
    .describe("fixed = acontece uma vez, só nesse dia; periodical = repete nesse dia todo mês, sem fim; time = repete nesse dia todo mês até a data de fim (endYear, endMonth, endDay); weekly = repete toda semana, no mesmo dia da semana; yearly = repete todo ano na mesma data."),
  endYear: anoDoSistema.nullable().optional().describe("Fim da repetição (só time)."),
  endMonth: mesDoSistema.nullable().optional(),
  endDay: diaDoSistema.nullable().optional(),
  entryId: idDoSistema.nullable().optional().describe("Lançamento ligado a este compromisso, se houver."),
  sessionId: idDoSistema
    .nullable()
    .optional()
    .describe(
      "Sessão de acúmulo que soma os gastos pagos no dia do compromisso, se houver. Não é o valor do compromisso: valor é lançamento, de finanças.",
    ),
  askSpending: z
    .boolean()
    .optional()
    .describe("Depois do fim, perguntar se teve gasto. Padrão true; false para compromisso que nunca envolve dinheiro, como uma reunião."),
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
// O esquema das preferências mora mais abaixo, depois da lista; este é o mesmo canal, para a ferramenta.
const canaisDaFerramenta = z.object({ central: z.boolean(), celular: z.boolean(), navegador: z.boolean() });

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
    descricao:
      "Edita um lançamento. Mande o id e só os campos que mudam: o que não vier fica como está (conta, transferência, regra de vencimento, empréstimo). Movimento (mode) e categoria não mudam depois de criado.",
    esquema: camposDoLancamento.partial().extend({ id: idDoSistema }),
    rotulo: (args) => (args.name ? `Editou o lançamento ${entreAspas(args.name)}` : "Editou o lançamento"),
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
    descricao: "Muda uma ocorrência (parcela ou mês) de um lançamento: situação, vencimento ou valor previsto. Ao marcar como paga (completed), paidOn diz o dia em que foi paga.",
    esquema: z.object({
      id: idDoSistema,
      number: z.number().int().min(1).describe("Número da ocorrência."),
      status: z.enum(STATUS_TRANSACAO).optional(),
      dueDate: dataDoSistema.optional(),
      plannedCents: z.number().int().optional().describe("Valor previsto em centavos."),
      paidOn: dataDoSistema.optional().describe("Com status completed: o dia em que foi paga. Sem ele, vale o dia do vencimento."),
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
    nome: "desfazer_pagamento",
    agentes: ["financas"],
    descricao:
      "Desfaz um pagamento registrado numa parcela ou num empréstimo: a ocorrência volta a pendente. O paymentId vem das ocorrências em consultar_lancamentos (campo paymentId). Pagamento vindo do extrato se desfaz por desfazer_cruzamento.",
    destrutiva: true,
    esquema: z.object({ id: idDoSistema, paymentId: idDoSistema, resumo: resumoDoQueApaga }),
    rotulo: (args) => `Desfez ${args.resumo}`,
  }),
  ferramenta({
    nome: "adiantar_parcelas",
    agentes: ["financas"],
    descricao:
      "Marca como paga a próxima parcela pendente do parcelamento, no valor previsto e sem pedir data nem valor: adianta uma parcela por chamada. Para pagar com a data e o valor reais, ou várias de uma vez, use registrar_pagamento.",
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
    descricao:
      "Marca como paga a próxima parcela pendente do empréstimo, no valor previsto e sem pedir data nem valor: adianta uma parcela por chamada. Para pagar com a data e o valor reais, ou o saldo todo, use registrar_pagamento.",
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
    nome: "registrar_pagamento",
    agentes: ["financas"],
    descricao:
      "Registra um pagamento numa parcela ou num empréstimo, com a data e o valor reais, sem sinal. Na parcela, o valor vai para a primeira pendente, em qualquer mês; o que passar paga as seguintes, e a sobra menor que uma parcela pede diferenca: 'multa' (multa e juros da parcela) ou 'proxima' (parte da próxima). Menos que a parcela paga parte dela. No empréstimo, abate o saldo e o que falta é previsto de novo. Mexe com dinheiro: a pessoa confirma.",
    esquema: z.object({
      id: idDoSistema,
      date: dataDoSistema,
      cents: centavosPositivos,
      diferenca: z.enum(DIFERENCAS_DO_PAGAMENTO).optional(),
    }),
    rotulo: (args) => `Registrou o pagamento de ${args.cents} centavos`,
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
      limitCents: z.number().int().min(0).nullable().optional().describe("Acúmulo: o teto de saídas por mês, em centavos. null ou ausente: sem limite."),
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
      limitCents: z.number().int().min(0).nullable().optional().describe("Acúmulo: o teto de saídas por mês, em centavos. null tira o limite; ausente mantém o que está."),
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
    nome: "organizar_grupos",
    agentes: ["organizacao"],
    descricao: "Muda a ordem dos grupos, como arrastar na tela de Grupos e sessões. Mande os ids de todos os grupos, na nova ordem.",
    esquema: z.object({ ids: z.array(idDoSistema).min(1).max(500) }),
    rotulo: () => "Reorganizou os grupos",
  }),
  ferramenta({
    nome: "organizar_sessoes_do_grupo",
    agentes: ["organizacao"],
    descricao: "Muda a ordem das sessões de um grupo. Mande o id do grupo e os ids de todas as sessões dele (ativas e encerradas), na nova ordem. Para mudar uma sessão de grupo, use editar_sessao.",
    esquema: z.object({ groupId: idDoSistema, ids: z.array(idDoSistema).min(1).max(500) }),
    rotulo: () => "Reorganizou as sessões do grupo",
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
    nome: "registrar_gasto_do_compromisso",
    agentes: ["agenda", "financas"],
    descricao:
      "Responde a pergunta \"teve gasto?\" de um compromisso que terminou: vira um lançamento único de saída, pago no dia do compromisso. O id e o date vêm de consultar_hoje (gastos). Sem sessionId, usa a sessão de gastos do compromisso.",
    esquema: z.object({
      id: idDoSistema.describe("O compromisso."),
      date: dataDoSistema.describe("O dia da ocorrência do compromisso."),
      cents: z.number().int().min(1).describe("Quanto foi gasto, em centavos, positivo."),
      sessionId: idDoSistema.optional().describe("A sessão que acumula o gasto; obrigatória se o compromisso não tiver sessão."),
      name: z.string().trim().min(1).max(80).optional().describe("O nome do lançamento, se a pessoa disser. Sem ele, vale o título do compromisso."),
    }),
    rotulo: () => "Lançou o gasto do compromisso",
  }),
  ferramenta({
    nome: "sem_gasto_no_compromisso",
    agentes: ["agenda"],
    descricao: "Responde que o compromisso que terminou não teve gasto: a pergunta some da Hoje e não volta a ser feita.",
    esquema: z.object({ id: idDoSistema.describe("O compromisso."), date: dataDoSistema.describe("O dia da ocorrência.") }),
    rotulo: () => "Marcou o compromisso sem gasto",
  }),
  ferramenta({
    nome: "consultar_hoje",
    agentes: ["agenda", "analise"],
    descricao:
      "O dia da pessoa numa lista: as tarefas dela (abertas e as de dias anteriores que ficaram), os compromissos, os vencimentos do dia e, se for hoje, as pendências do sistema. Sem date, é hoje.",
    leitura: true,
    esquema: z.object({ date: dataDoSistema.optional() }),
    rotulo: (args) => (args.date ? `Consultou o dia ${args.date}` : "Consultou o dia de hoje"),
  }),
  ferramenta({
    nome: "criar_tarefa",
    agentes: ["agenda"],
    descricao:
      "Escreve uma tarefa na aba Hoje da pessoa. Sem date, é para hoje. Com parentId, vira subatividade de uma tarefa que já existe (o id vem de consultar_hoje; subatividades podem ter subatividades). Com appointmentId, vira item do checklist daquele compromisso, no dia date da ocorrência (o compromisso precisa acontecer nesse dia; não repete e não passa para o dia seguinte). Tarefa não guarda valor: dinheiro é lançamento.",
    esquema: z.object({
      title: z.string().trim().min(1).max(160).describe("A tarefa, curta, como a pessoa falaria."),
      date: dataDoSistema.optional(),
      parentId: idDoSistema.optional().describe("A atividade de que esta é subatividade."),
      appointmentId: idDoSistema.optional().describe("O compromisso cujo checklist recebe o item (id de consultar_hoje ou consultar_agenda). Só sem parentId."),
      repeat: z.enum(REPETICOES_DE_TAREFA).optional().describe("Só sem parentId: daily (todo dia), weekdays (dias úteis), weekly (toda semana) ou monthly (todo mês). Ao ser feita, a tarefa nasce de novo no próximo dia da regra."),
    }),
    rotulo: (args) => `Anotou a tarefa ${entreAspas(args.title)}`,
  }),
  ferramenta({
    nome: "associar_tarefa_ao_compromisso",
    agentes: ["agenda"],
    descricao:
      "Leva uma tarefa da aba Hoje, com as subatividades, para o checklist de um compromisso no dia date da ocorrência. appointmentId null devolve a tarefa para as tarefas soltas, no dia date. Os ids vêm de consultar_hoje.",
    esquema: z.object({
      id: idDoSistema.describe("A tarefa."),
      appointmentId: idDoSistema.nullable(),
      date: dataDoSistema,
    }),
    rotulo: (args) => (args.appointmentId ? "Levou a tarefa para o checklist do compromisso" : "Tirou a tarefa do checklist do compromisso"),
  }),
  ferramenta({
    nome: "copiar_checklist_do_compromisso",
    agentes: ["agenda"],
    descricao:
      "Para um compromisso que repete: traz para o dia date o checklist da última vez que ele teve um, com todos os itens abertos. Só quando o dia ainda não tem checklist.",
    esquema: z.object({ id: idDoSistema.describe("O compromisso."), date: dataDoSistema }),
    rotulo: () => "Trouxe o checklist da última vez",
  }),
  ferramenta({
    nome: "editar_tarefa",
    agentes: ["agenda"],
    descricao:
      "Muda o texto, o dia ou a repetição de uma tarefa da aba Hoje. Mande o texto e o dia, com os valores atuais se não mudam (eles vêm de consultar_hoje). repeat ausente mantém a repetição; null tira.",
    esquema: z.object({
      id: idDoSistema,
      title: z.string().trim().min(1).max(160),
      date: dataDoSistema,
      parentId: idDoSistema.nullable().optional(),
      repeat: z.enum(REPETICOES_DE_TAREFA).nullable().optional(),
    }),
    rotulo: (args) => `Editou a tarefa ${entreAspas(args.title)}`,
  }),
  ferramenta({
    nome: "concluir_tarefa",
    agentes: ["agenda"],
    descricao: "Marca uma tarefa da aba Hoje como feita (done true) ou reabre (done false). O id vem de consultar_hoje. Marcar a atividade marca as subatividades; a última subatividade fecha a atividade.",
    esquema: z.object({ id: idDoSistema, done: z.boolean() }),
    rotulo: (args) => (args.done ? "Marcou a tarefa como feita" : "Reabriu a tarefa"),
  }),
  ferramenta({
    nome: "mover_tarefa",
    agentes: ["agenda"],
    descricao:
      "Muda uma tarefa de lugar na aba Hoje: para dentro de outra (parentId) ou para a raiz (parentId null), e antes de uma irmã (beforeId) ou no fim. Serve para organizar e para tornar uma subatividade uma atividade.",
    esquema: z.object({
      id: idDoSistema,
      parentId: idDoSistema.nullable().describe("A atividade que vai receber esta; null para a raiz."),
      beforeId: idDoSistema.nullable().optional().describe("A irmã na frente da qual ela entra; sem isso, fica no fim."),
    }),
    rotulo: () => "Moveu a tarefa",
  }),
  ferramenta({
    nome: "excluir_tarefa",
    agentes: ["agenda"],
    descricao: "Apaga uma tarefa da aba Hoje.",
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
    nome: "aprovar_parte_da_meta",
    agentes: ["metas"],
    descricao:
      "Aprova a parte da sobra deste mês que a divisão reservou para a meta: o valor é separado agora, numa saída na sessão dela. Antes, a divisão precisa existir (dividir_sobra_das_metas) e consultar_metas mostra o valor pendente. Mexe com dinheiro: entra no plano para a pessoa aprovar.",
    exigeConfirmacao: true,
    esquema: peloId,
    rotulo: () => "Aprovou a parte da meta",
  }),
  ferramenta({
    nome: "separar_valor_da_meta",
    agentes: ["metas"],
    descricao:
      "Separa um valor para a meta agora: lança uma saída na sessão dela (com caixinha ligada, uma aplicação na caixinha). Mexe com dinheiro, então a pessoa sempre confirma antes. Valor em centavos, positivo.",
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
    descricao: "Apaga uma meta. A sessão dela no grupo Metas é encerrada e o valor separado volta para a sobra; a caixinha ligada continua na conta.",
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
    descricao: `Linhas do mês ainda sem lançamento, com a categoria e o valor de cada candidato. Com todas true, vêm todas as linhas sem lançamento de uma vez (até ${LINHAS_DA_CONFERENCIA_DE_UMA_VEZ}): use isso quando o pedido é sobre o mês inteiro. Sem todas, vêm ${LINHAS_DA_CONFERENCIA_POR_PAGINA} por página, pagina a partir de 1. page.total é quantas linhas existem (ou quantas casam com a busca) e pending é o total sem lançamento do mês. Com busca, traz só as linhas desses nomes.`,
    leitura: true,
    esquema: z.object({
      year: anoDoSistema,
      month: mesDoSistema,
      todas: z.boolean().optional().describe("true: todas as linhas sem lançamento do mês numa chamada só, sem paginar."),
      pagina: z.number().int().min(1).max(100).optional().describe("Página, a partir de 1. Ignorada com todas true."),
      busca: z
        .string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .describe('Nomes a procurar na descrição da linha, separados por "|". Ex.: "uber|99". Sem acento e sem diferenciar maiúsculas.'),
    }),
    rotulo: (args) => `Consultou a conferência de ${args.month}/${args.year}`,
  }),
  ferramenta({
    nome: "previa_da_serie_no_extrato",
    agentes: ["extratos"],
    descricao:
      "Antes de lançar uma linha como parcela, empréstimo ou recorrente: as linhas de outros meses importados que são a mesma compra, por mês (com a parcela de cada mês). Use para propor lancar_serie_do_extrato com todas juntas.",
    leitura: true,
    esquema: z.object({ statementId: idDoSistema, line: z.number().int().min(1), tipo: ESQUEMA_DO_TIPO_DA_LINHA }),
    rotulo: (args) => `Procurou a linha ${args.line} em outros meses`,
  }),
  ferramenta({
    nome: "lancar_serie_do_extrato",
    agentes: ["extratos"],
    descricao:
      "Cria a parcela, o empréstimo ou a recorrente com as linhas de vários meses de uma vez (as de previa_da_serie_no_extrato). A série nasce no mês mais antigo escolhido; em cada mês, uma linha tem papel 'serie' e paga a ocorrência do mês, no valor do extrato. Outras linhas do mesmo mês, se a pessoa quiser somar, vão com papel 'parte' e viram únicas na mesma sessão.",
    esquema: z.object({
      statementId: idDoSistema.describe("A linha de origem, a mesma da prévia."),
      line: z.number().int().min(1),
      sessionId: idDoSistema,
      tipo: ESQUEMA_DO_TIPO_DA_LINHA,
      nome: z.string().trim().min(1).max(160).optional(),
      linhas: z
        .array(z.object({ statementId: idDoSistema, line: z.number().int().min(1), papel: z.enum(PAPEIS_DA_LINHA_NA_SERIE) }))
        .min(1)
        .max(400),
    }),
    rotulo: (args) => `Lançou a série com ${args.linhas.length} linhas`,
  }),
  ferramenta({
    nome: "consultar_series_no_extrato",
    agentes: ["extratos", "financas"],
    descricao:
      "As parcelas, empréstimos e recorrentes que já existem e têm linhas livres em outros meses importados, por mês, com a ocorrência prevista. 'antes' é o mês anterior ao início da série: na recorrente, a linha dele entra como única.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou as séries com linhas em outros meses",
  }),
  ferramenta({
    nome: "juntar_linhas_a_serie",
    agentes: ["extratos"],
    descricao:
      "Junta a uma parcela, empréstimo ou recorrente que já existe as linhas escolhidas de outros meses (as de consultar_series_no_extrato): uma por mês com papel 'serie', e as outras do mesmo mês com papel 'parte', se a pessoa quiser somar.",
    esquema: z.object({
      id: idDoSistema.describe("O lançamento da série."),
      linhas: z
        .array(z.object({ statementId: idDoSistema, line: z.number().int().min(1), papel: z.enum(PAPEIS_DA_LINHA_NA_SERIE) }))
        .min(1)
        .max(400),
    }),
    rotulo: (args) => `Juntou ${args.linhas.length} linhas à série`,
  }),
  ferramenta({
    nome: "ignorar_linhas",
    agentes: ["extratos"],
    descricao:
      "Marca linhas do extrato como sem importância (ignored true): saem da conferência e não viram lançamento. Com ignored false, voltam. Serve para linha repetida, estorno já tratado ou movimento que a pessoa não quer controlar.",
    esquema: z.object({
      items: z.array(z.object({ statementId: idDoSistema, line: z.number().int().min(1) })).min(1).max(500),
      ignored: z.boolean(),
    }),
    rotulo: (args) => (args.ignored ? `Ignorou ${args.items.length} linha(s) do extrato` : `Reativou ${args.items.length} linha(s) do extrato`),
  }),
  ferramenta({
    nome: "dividir_linha",
    agentes: ["extratos"],
    descricao:
      "Divide uma linha do extrato em partes, cada uma lançada na própria sessão, no valor da parte. As partes somam o valor da linha, em centavos com sinal (saída negativa). Sem tipo, a parte vira única; com tipo, segue o tipo.",
    esquema: z.object({
      statementId: idDoSistema,
      line: z.number().int().min(1),
      parts: z
        .array(
          z.object({
            cents: z.number().int().describe("Centavos com sinal: negativo para saída, positivo para entrada."),
            sessionId: idDoSistema,
            nome: z.string().trim().min(1).max(160).optional().describe("O nome do lançamento desta parte."),
            tipo: ESQUEMA_DO_TIPO_DA_LINHA.optional(),
          }),
        )
        .min(2)
        .max(12),
    }),
    rotulo: (args) => `Dividiu a linha ${args.line} em ${args.parts.length} partes`,
  }),
  ferramenta({
    nome: "desfazer_conferencia",
    agentes: ["extratos"],
    descricao:
      "Desfaz toda a conferência da conta: as linhas cruzadas e divididas voltam a sem lançamento, as ignoradas voltam, os nomes lembrados são esquecidos e os lançamentos que nasceram do extrato são apagados. Roda em segundo plano: a resposta diz que começou, e a pessoa recebe uma notificação quando termina. Só quando a pessoa pedir para recomeçar a conferência do zero.",
    destrutiva: true,
    exigeConfirmacao: true,
    esquema: z.object({ resumo: resumoDoQueApaga }),
    rotulo: () => "Desfez toda a conferência",
  }),
  ferramenta({
    nome: "cruzar_linha",
    agentes: ["extratos"],
    descricao:
      "Liga uma linha a um lançamento. Única: o extrato vale no mês. Fixa com valor diferente: mande valor extrato ou lancamento, o que a pessoa escolheu. Parcela e empréstimo: a linha paga o que falta, em qualquer mês; se o valor passar da parcela e sobrar menos que outra, mande diferenca 'multa' ou 'proxima', o que a pessoa escolheu. Extra só em linha positiva.",
    esquema: z.object({
      statementId: idDoSistema,
      line: z.number().int().min(1),
      entryId: idDoSistema,
      valor: z.enum(["extrato", "lancamento"]).optional().describe("Qual valor vale no mês, quando a fixa diverge."),
      diferenca: z.enum(DIFERENCAS_DO_PAGAMENTO).optional().describe("Parcela: a sobra é multa e juros ('multa') ou parte da próxima ('proxima')."),
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
    descricao:
      "Lança a linha numa sessão, com o valor do extrato e já paga. Sem tipo, vira uma única. Com tipo, vira parcela, empréstimo, recorrente ou extra, como nas Finanças. Não use para fixa, parcela ou empréstimo que já existem: cruze.",
    esquema: z.object({
      statementId: idDoSistema,
      line: z.number().int().min(1),
      sessionId: idDoSistema,
      tipo: ESQUEMA_DO_TIPO_DA_LINHA.optional(),
    }),
    rotulo: (args) => `Lançou a linha ${args.line}`,
  }),
  ferramenta({
    nome: "acumular_linhas",
    agentes: ["extratos"],
    descricao:
      'Lança várias linhas, cada uma na sua sessão, com o valor do extrato e já pagas. Sem tipo, cada uma vira uma única; com tipo, segue o tipo. Não use para fixa, parcela ou empréstimo que já existem. Formato: { "items": [{ "statementId": "...", "line": 12, "sessionId": "..." }, ...] }. O resultado diz quantas foram lançadas (launched), quais falharam e por quê (failed) e quantas linhas ainda ficaram sem lançamento no mês (remaining).',
    esquema: z.object({
      items: z
        .array(
          z.object({
            statementId: idDoSistema,
            line: z.number().int().min(1),
            sessionId: idDoSistema,
            tipo: ESQUEMA_DO_TIPO_DA_LINHA.optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
    rotulo: (args) => `Lançou ${args.items.length} linhas`,
  }),
  ferramenta({
    nome: "importar_extrato",
    agentes: ["extratos"],
    descricao:
      "Importa um extrato que a pessoa anexou na conversa (CSV, OFX, imagem ou PDF). O `anexoId` está na mensagem, na linha 'Anexo'. Em CSV, `colunas` diz qual coluna (começa em 0) é a data, a descrição e o valor; sem elas o sistema tenta achar. Passe em `observacao` o que a pessoa disse sobre o extrato (a conta, o que ignorar, quem é cada nome): fica guardado com o extrato e ajuda a ler imagem ou PDF. A importação de imagem ou PDF termina em segundos: confira com consultar_extratos.",
    esquema: z.object({
      anexoId: idDoSistema.describe("O id do anexo, da linha 'Anexo' da mensagem."),
      accountName: z.string().trim().min(1).max(80).describe("O nome da conta do extrato, como a pessoa a chama."),
      observacao: z.string().trim().max(LIMITE_OBSERVACAO_DO_EXTRATO).optional(),
      colunas: z
        .object({
          date: z.number().int().min(0).max(40),
          description: z.number().int().min(0).max(40),
          amount: z.number().int().min(0).max(40),
        })
        .optional(),
    }),
    rotulo: (args) => `Importou o extrato para a conta ${entreAspas(args.accountName)}`,
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
  // Contas e cartões
  ferramenta({
    nome: "consultar_contas",
    agentes: todosLeem,
    descricao:
      "Lista as contas (banco, carteira) e os cartões de crédito da pessoa, com ids, tipo, saldo inicial e o dia dele; no cartão, o dia de fechamento, o de vencimento e o limite. Traz também as caixinhas (depósitos) de cada conta, com id, saldo inicial, a sessão do rendimento e a meta ligada. O saldo de hoje vem de consultar_saldos.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou as contas",
  }),
  ferramenta({
    nome: "criar_conta",
    agentes: ["financas", "extratos"],
    descricao:
      "Cria uma conta (conta) ou um cartão de crédito (cartao). openingCents é o saldo no dia openingOn (padrão hoje), em centavos com sinal; só o que acontece a partir desse dia conta no saldo. No cartão, costuma ser 0.",
    esquema: z.object({
      name: z.string().trim().min(1).max(80),
      kind: z.enum(TIPOS_DE_CONTA).describe("conta (banco, carteira) ou cartao (cartão de crédito)."),
      openingCents: z.number().int().optional().describe("Saldo inicial em centavos, com sinal. Padrão 0."),
      openingOn: dataDoSistema.optional().describe("O dia desse saldo. Padrão hoje."),
      closingDay: z.number().int().min(1).max(28).optional().describe("Cartão: dia em que a fatura fecha."),
      dueDay: z.number().int().min(1).max(28).optional().describe("Cartão: dia em que a fatura vence."),
      limitCents: z.number().int().min(0).optional().describe("Cartão: o limite, em centavos."),
    }),
    rotulo: (args) => `Criou a conta ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "editar_conta",
    agentes: ["financas"],
    descricao:
      "Renomeia uma conta ou cartão, muda o tipo, o saldo inicial e o dia dele, e no cartão o fechamento, o vencimento e o limite. Mande nome, tipo e saldo inicial com os valores atuais se não mudam; openingOn, closingDay, dueDay e limitCents ausentes ficam como estão.",
    esquema: z.object({
      id: idDoSistema,
      name: z.string().trim().min(1).max(80),
      kind: z.enum(TIPOS_DE_CONTA),
      openingCents: z.number().int(),
      openingOn: dataDoSistema.nullable().optional().describe("O dia do saldo inicial. Ausente mantém; null tira a data (tudo conta no saldo)."),
      closingDay: z.number().int().min(1).max(28).nullable().optional().describe("Cartão: dia do fechamento. Ausente mantém."),
      dueDay: z.number().int().min(1).max(28).nullable().optional().describe("Cartão: dia do vencimento. Ausente mantém."),
      limitCents: z.number().int().min(0).nullable().optional().describe("Cartão: o limite em centavos. Ausente mantém; null tira."),
    }),
    rotulo: (args) => `Editou a conta ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "transferir_entre_contas",
    agentes: ["financas"],
    descricao:
      "Move dinheiro entre duas contas da própria pessoa (banco, carteira, cartão): cria o par de lançamentos de transferência (sai de uma, entra na outra), fora da sobra. Para a fatura do cartão, prefira pagar_fatura. Mexe com dinheiro: a pessoa confirma antes.",
    exigeConfirmacao: true,
    esquema: z.object({
      fromAccountId: idDoSistema,
      toAccountId: idDoSistema,
      cents: centavosPositivos,
      date: dataDoSistema.optional().describe("O dia. Padrão hoje."),
      note: z.string().trim().max(160).optional().describe("Um texto curto, se a pessoa disser o motivo."),
      resumo: z.string().trim().min(3).max(160).describe("O que será feito, para a pessoa confirmar. Ex.: R$ 500,00 do Itaú para a Carteira."),
    }),
    rotulo: (args) => `Transferiu ${args.resumo}`,
  }),
  ferramenta({
    nome: "transferir_linha_do_extrato",
    agentes: ["extratos"],
    descricao:
      "A linha do extrato é uma transferência entre contas da pessoa (TED/Pix para a própria conta, pagamento de fatura, aplicação): cria o par de lançamentos fora da sobra, cruza a linha e, se o extrato da outra conta tem a linha espelho (mesmo valor, até três dias de diferença), cruza também. accountId é a outra conta.",
    esquema: z.object({ statementId: idDoSistema, line: z.number().int().min(1), accountId: idDoSistema.describe("A outra conta da transferência (consultar_contas).") }),
    rotulo: (args) => `Marcou a linha ${args.line} como transferência`,
  }),
  ferramenta({
    nome: "consultar_faturas",
    agentes: todosLeem,
    descricao:
      "As últimas faturas de um cartão (fechamento, vencimento, total, pago, status aberta/fechada/vencida/paga) e o limite usado e disponível. Precisa do cartão com dia de fechamento e de vencimento.",
    leitura: true,
    esquema: z.object({ id: idDoSistema.describe("Id do cartão (consultar_contas).") }),
    rotulo: () => "Consultou as faturas do cartão",
  }),
  ferramenta({
    nome: "pagar_fatura",
    agentes: ["financas"],
    descricao:
      "Paga a fatura do cartão a partir de uma conta: cria o par de transferências (sai da conta, entra no cartão), fora da sobra. month é o AAAA-MM da fatura (consultar_faturas). Mexe com dinheiro: a pessoa confirma antes.",
    exigeConfirmacao: true,
    esquema: z.object({
      id: idDoSistema.describe("Id do cartão."),
      fromAccountId: idDoSistema.describe("A conta de onde o dinheiro sai."),
      cents: centavosPositivos,
      month: z.string().regex(/^\d{4}-\d{2}$/).describe("AAAA-MM da fatura."),
      date: dataDoSistema.optional().describe("O dia do pagamento. Padrão hoje."),
      resumo: z.string().trim().min(3).max(160).describe("O que será feito, para a pessoa confirmar. Ex.: R$ 1.200,00 da fatura de novembro do Nubank, saindo do Itaú."),
    }),
    rotulo: (args) => `Pagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "excluir_conta",
    agentes: ["financas"],
    descricao: "Apaga uma conta ou cartão. Os lançamentos ligados a ela ficam sem conta; os extratos dela precisam ser apagados antes.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "criar_caixinha",
    agentes: ["financas", "metas"],
    descricao:
      "Cria uma caixinha (depósito) dentro de uma conta do banco (cartão não tem). Ela nasce com uma sessão no grupo Conta, onde entram o rendimento de cada mês, as aplicações e os resgates. openingCents é o que já está nela hoje. goalId liga a caixinha a uma meta: o saldo dela soma no guardado da meta.",
    esquema: z.object({
      accountId: idDoSistema.describe("A conta da caixinha (consultar_contas)."),
      name: z.string().trim().min(1).max(60),
      openingCents: z.number().int().min(0).optional().describe("O que já está na caixinha, em centavos. Padrão 0."),
      openingOn: dataDoSistema.optional().describe("O dia desse saldo. Padrão hoje."),
      goalId: idDoSistema.nullable().optional().describe("A meta que guarda nesta caixinha (consultar_metas)."),
    }),
    rotulo: (args) => `Criou a caixinha ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "editar_caixinha",
    agentes: ["financas", "metas"],
    descricao: "Renomeia a caixinha, muda o saldo inicial ou a meta ligada (null tira a meta). Mande todos os campos, com os valores atuais nos que não mudam.",
    esquema: z.object({
      id: idDoSistema,
      name: z.string().trim().min(1).max(60),
      openingCents: z.number().int().min(0),
      openingOn: dataDoSistema.nullable().optional().describe("O dia do saldo inicial. Ausente mantém."),
      goalId: idDoSistema.nullable(),
    }),
    rotulo: (args) => `Editou a caixinha ${entreAspas(args.name)}`,
  }),
  ferramenta({
    nome: "excluir_caixinha",
    agentes: ["financas"],
    descricao: "Apaga uma caixinha. Os lançamentos da sessão dela ficam no grupo Conta como histórico; sem lançamentos, a sessão sai junto.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Apagou ${args.resumo}`,
  }),
  ferramenta({
    nome: "movimentar_caixinha",
    agentes: ["financas", "metas"],
    descricao:
      "Lança um movimento na sessão da caixinha. rendimento: o quanto rendeu no mês (entrada, soma na sobra; negativo é perda). aplicacao: dinheiro que sai da conta e entra na caixinha. resgate: o contrário. Na caixinha comum, aplicação e resgate são transferência e não mexem na sobra; na caixinha de uma meta, a aplicação é o valor separado para a meta e sai da sobra.",
    esquema: z.object({
      id: idDoSistema.describe("Id da caixinha."),
      tipo: z.enum(MOVIMENTOS_DA_CAIXINHA),
      cents: z
        .number()
        .int()
        .refine((valor) => valor !== 0, "Informe o valor.")
        .describe("Centavos, nunca zero. Aplicação e resgate positivos; rendimento com sinal."),
      date: dataDoSistema,
    }),
    rotulo: (args) => `${ROTULO_DO_MOVIMENTO_DA_CAIXINHA[args.tipo]} de ${(args.cents / 100).toFixed(2).replace(".", ",")} reais na caixinha`,
  }),
  ferramenta({
    nome: "consultar_saldos",
    agentes: todosLeem,
    descricao:
      "O saldo de hoje de cada conta (e o previsto para o fim do mês), a fatura lançada de cada cartão, o saldo e o rendimento do mês de cada caixinha, o patrimônio (contas mais caixinhas menos cartões) e a evolução dele nos últimos seis meses. Use quando a pessoa perguntar quanto tem, quanto está guardado ou como o dinheiro dela evoluiu.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou os saldos e o patrimônio",
  }),
  ferramenta({
    nome: "ajustar_saldo_da_conta",
    agentes: ["financas"],
    descricao:
      "A pessoa diz quanto o banco mostra na conta (ou quanto está na fatura do cartão, em negativo) num dia: a diferença para o saldo calculado vira um lançamento de ajuste ligado à conta, na sessão Ajustes de saldo. Por padrão o ajuste conta na sobra; foraDaSobra true o trata como transferência. Mexe com dinheiro: a pessoa confirma antes.",
    exigeConfirmacao: true,
    esquema: z.object({
      id: idDoSistema.describe("Id da conta."),
      saldoCents: z.number().int().describe("O saldo que o banco mostra, em centavos com sinal."),
      date: dataDoSistema.optional().describe("O dia desse saldo. Padrão hoje."),
      foraDaSobra: z.boolean().optional(),
      resumo: z.string().trim().min(3).max(160).describe("O que será feito, para a pessoa confirmar. Ex.: acertar o Nubank para R$ 1.250,00."),
    }),
    rotulo: (args) => `Ajustou ${args.resumo}`,
  }),
  ferramenta({
    nome: "informar_saldo_da_caixinha",
    agentes: ["financas", "metas"],
    descricao:
      "A pessoa diz quanto a caixinha mostra hoje (cripto, fundo, poupança): a diferença para o saldo calculado vira rendimento, ou perda, nesse dia. Use em vez de movimentar_caixinha quando ela sabe o saldo e não o rendimento.",
    esquema: z.object({
      id: idDoSistema.describe("Id da caixinha."),
      saldoCents: z.number().int().min(0).describe("O saldo que a caixinha mostra, em centavos."),
      date: dataDoSistema.optional().describe("O dia desse saldo. Padrão hoje."),
    }),
    rotulo: (args) => `Informou o saldo de ${(args.saldoCents / 100).toFixed(2).replace(".", ",")} reais na caixinha`,
  }),
  ferramenta({
    nome: "guardar_meta_na_caixinha",
    agentes: ["metas"],
    descricao:
      "Liga a meta a uma caixinha: o saldo da caixinha passa a somar no guardado da meta, e o que a meta separa (aprovar_parte_da_meta, separar_valor_da_meta) vira aplicação nela. boxId null desfaz a ligação.",
    esquema: z.object({ id: idDoSistema.describe("Id da meta."), boxId: idDoSistema.nullable() }),
    rotulo: (args) => (args.boxId ? "Ligou a meta a uma caixinha" : "Tirou a meta da caixinha"),
  }),
  // Feriados e vencimentos
  ferramenta({
    nome: "consultar_feriados",
    agentes: ["financas", "agenda", "analise"],
    descricao: "Os feriados do ano (nacionais, bancários, facultativos e os locais da conta) e a lista dos feriados locais cadastrados, com ids.",
    leitura: true,
    esquema: z.object({ year: anoDoSistema.optional().describe("Sem ano, é o ano de hoje.") }),
    rotulo: (args) => (args.year ? `Consultou os feriados de ${args.year}` : "Consultou os feriados"),
  }),
  ferramenta({
    nome: "criar_feriado_local",
    agentes: ["financas", "agenda"],
    descricao: "Cadastra um feriado da cidade ou do estado, que repete todo ano no mesmo dia. Ele passa a contar como dia não útil: os vencimentos pendentes com regra são recalculados.",
    esquema: z.object({
      nome: z.string().trim().min(1).max(60),
      dia: diaDoSistema,
      mes: mesDoSistema,
    }),
    rotulo: (args) => `Cadastrou o feriado ${entreAspas(args.nome)}`,
  }),
  ferramenta({
    nome: "excluir_feriado_local",
    agentes: ["financas", "agenda"],
    descricao: "Tira um feriado local da conta. Os vencimentos pendentes com regra são recalculados.",
    destrutiva: true,
    esquema: peloIdApagando,
    rotulo: (args) => `Tirou ${args.resumo}`,
  }),
  ferramenta({
    nome: "consultar_padroes_de_vencimento",
    agentes: ["financas"],
    descricao: "O ajuste padrão da conta quando um vencimento cai em fim de semana ou feriado, por categoria: fixa de entrada, fixa de saída, parcela e empréstimo. Vale para o lançamento criado sem dueRule.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou os padrões de vencimento",
  }),
  ferramenta({
    nome: "atualizar_padroes_de_vencimento",
    agentes: ["financas"],
    descricao:
      "Muda o ajuste padrão por categoria: manter (a data como está), antecipar (dia útil anterior), adiar (dia útil seguinte) ou adiar_no_mes (dia útil seguinte, sem sair do mês). Mande as quatro categorias, com o valor atual nas que não mudam.",
    esquema: z.object({
      // Os mesmos valores de AJUSTES_DE_DIA_UTIL, que é definido depois deste catálogo.
      fixa_entrada: z.enum(["manter", "antecipar", "adiar", "adiar_no_mes"]),
      fixa_saida: z.enum(["manter", "antecipar", "adiar", "adiar_no_mes"]),
      parcela: z.enum(["manter", "antecipar", "adiar", "adiar_no_mes"]),
      emprestimo: z.enum(["manter", "antecipar", "adiar", "adiar_no_mes"]),
    }),
    rotulo: () => "Atualizou os padrões de vencimento",
  }),
  // Notificações
  ferramenta({
    nome: "consultar_notificacoes",
    agentes: ["analise", "financas", "agenda"],
    descricao: "A central de notificações da pessoa: os avisos recentes (vencimentos, atrasos, gastos, tarefas, metas, limites), com id, texto, tela de destino e se já foram lidos.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou as notificações",
  }),
  ferramenta({
    nome: "marcar_notificacao_lida",
    agentes: ["analise", "financas", "agenda"],
    descricao: "Marca uma notificação como lida.",
    esquema: peloId,
    rotulo: () => "Marcou a notificação como lida",
  }),
  ferramenta({
    nome: "marcar_notificacoes_lidas",
    agentes: ["analise", "financas", "agenda"],
    descricao: "Marca todas as notificações como lidas.",
    esquema: vazio,
    rotulo: () => "Marcou todas as notificações como lidas",
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
    descricao:
      "Os eventos do sistema (o que cada mudança disparou), como na tela de Eventos, do mais novo para o mais antigo, em páginas. Filtra por categoria, situação, texto e dia.",
    leitura: true,
    esquema: z.object({
      pagina: z.number().int().min(1).optional(),
      categoria: z.enum(CODIGOS_CATEGORIA_EVENTO).optional(),
      status: z.enum(STATUS_EVENTO).optional().describe("pendente, processando, concluído ou com falha."),
      q: z.string().max(160).optional().describe("Texto para procurar."),
      dia: dataDoSistema.optional(),
    }),
    rotulo: () => "Consultou os eventos",
  }),
  ferramenta({
    nome: "consultar_historico_de_eventos",
    agentes: ["analise"],
    descricao: "O histórico da tela de Eventos: o que foi feito e se deu certo, falhou ou só começou, em páginas.",
    leitura: true,
    esquema: z.object({
      pagina: z.number().int().min(1).optional(),
      resultado: z.enum(RESULTADOS_HISTORICO).optional().describe("sucesso, falha ou iniciado."),
      q: z.string().max(160).optional().describe("Texto para procurar."),
    }),
    rotulo: () => "Consultou o histórico",
  }),
  ferramenta({
    nome: "consultar_evento",
    agentes: ["analise"],
    descricao: "O detalhe de um evento (o id vem de consultar_eventos): o que ele levou e o que aconteceu depois.",
    leitura: true,
    esquema: peloId,
    rotulo: () => "Consultou o detalhe do evento",
  }),
  ferramenta({
    nome: "consultar_preferencias_de_notificacao",
    agentes: ["analise", "financas", "agenda"],
    descricao:
      "Como a pessoa recebe cada tipo de aviso (vencimentos, lembretes, gastos, tarefas, extratos, metas, limites, assistente) em cada canal (central, celular, navegador), e o horário de silêncio.",
    leitura: true,
    esquema: vazio,
    rotulo: () => "Consultou as preferências de notificação",
  }),
  ferramenta({
    nome: "salvar_preferencias_de_notificacao",
    agentes: ["analise", "financas", "agenda"],
    descricao:
      "Grava as preferências de notificação. Mande o objeto inteiro: leia antes com consultar_preferencias_de_notificacao e mude só o que a pessoa pediu. Horas em HH:MM, no fuso da conta; o silêncio pode atravessar a meia-noite.",
    esquema: z.object({
      canais: z.object({
        vencimentos: canaisDaFerramenta,
        lembretes: canaisDaFerramenta,
        gastos: canaisDaFerramenta,
        tarefas: canaisDaFerramenta,
        extratos: canaisDaFerramenta,
        metas: canaisDaFerramenta,
        limites: canaisDaFerramenta,
        assistente: canaisDaFerramenta,
      }),
      silencio: z.object({
        ativo: z.boolean(),
        inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    }),
    rotulo: () => "Mudou as preferências de notificação",
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

/** O plano aceita até este número de passos. Várias linhas de extrato únicas vão num passo só, acumular_linhas. */
export const PASSOS_MAXIMOS_DO_PLANO = 20;

/**
 * Linhas de extrato num plano, somando os passos acumular_linhas. Acima disso a resposta do modelo cresce até
 * ser cortada (a Anthropic para em 16 mil tokens) e a execução passa de minutos. O resto vai no plano seguinte.
 */
export const LINHAS_MAXIMAS_DO_PLANO = 100;

/** O fim do resultado que o backend devolve ao plano recusado. O agents o reconhece para exigir um plano novo. */
export const RECUSA_DE_PLANO = "Nada foi mostrado à pessoa. Corrija e proponha de novo.";

/** O começo do resultado que o backend devolve à escrita fora do plano. O agents o reconhece para exigir o plano. */
export const RECUSA_DE_ESCRITA_FORA_DO_PLANO = "Nada foi feito: esta ferramenta muda o sistema e só roda dentro de um plano aprovado.";

/** As ferramentas que criam algo novo: o passo dá o id, e os seguintes apontam para ele com @passo:N. */
export const FERRAMENTAS_QUE_CRIAM: ReadonlySet<string> = new Set([
  "criar_grupo",
  "criar_sessao",
  "criar_lancamento",
  "criar_compromisso",
  "criar_meta",
  "importar_extrato",
  "criar_conta",
  "criar_feriado_local",
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
    .max(PASSOS_MAXIMOS_DO_PLANO),
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

/* ---------------------------------------------------------------------------------------------- */
/* Notificações                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

/** O que gera aviso. A pessoa liga ou desliga cada tipo em cada canal. */
export const TIPOS_DE_NOTIFICACAO = ["vencimentos", "lembretes", "gastos", "tarefas", "extratos", "metas", "limites", "assistente"] as const;
export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number];

/** Central: a lista dentro do sistema. Celular e navegador: o push, que chega com o app ou a aba fechados. */
export const CANAIS_DE_NOTIFICACAO = ["central", "celular", "navegador"] as const;
export type CanalDeNotificacao = (typeof CANAIS_DE_NOTIFICACAO)[number];

export const ROTULO_DO_TIPO_DE_NOTIFICACAO: Record<TipoDeNotificacao, { titulo: string; dica: string }> = {
  vencimentos: { titulo: "Vencimentos", dica: "O que vence amanhã e hoje, e o que ficou atrasado ou a entrada que não foi marcada." },
  lembretes: { titulo: "Lembretes", dica: "Compromisso da agenda, na antecedência escolhida." },
  gastos: { titulo: "Gastos dos compromissos", dica: "Depois que um compromisso termina, pergunta se teve gasto." },
  tarefas: { titulo: "Tarefas", dica: "No fim do dia, as tarefas que ficaram abertas." },
  extratos: { titulo: "Extratos", dica: "Leitura de imagem ou PDF que terminou e linhas esperando conferência." },
  metas: { titulo: "Metas", dica: "Meta alcançada, parte do mês sem separar e prazo chegando." },
  limites: { titulo: "Limites", dica: "Sessão que passou de 80% do limite do mês e sessão que estourou." },
  assistente: { titulo: "Assistente", dica: "Plano do consultor parado esperando a sua aprovação." },
};

export const ROTULO_DO_CANAL_DE_NOTIFICACAO: Record<CanalDeNotificacao, string> = {
  central: "No sistema",
  celular: "No celular",
  navegador: "No navegador",
};

/**
 * Para onde a notificação leva. Cada cliente traduz para a própria rota: o web e o app não têm as mesmas URLs.
 * `id` é a conversa do assistente; nas outras telas fica null.
 */
export const TELAS_DE_DESTINO = ["hoje", "financas", "agenda", "extratos", "conferencia", "metas", "assistente", "contas"] as const;
export type TelaDeDestino = (typeof TELAS_DE_DESTINO)[number];
export type DestinoDaNotificacao = { tela: TelaDeDestino; id: string | null };

export type Notificacao = {
  id: string;
  tipo: TipoDeNotificacao;
  titulo: string;
  texto: string;
  destino: DestinoDaNotificacao;
  criadaEm: string;
  lidaEm: string | null;
};

export type NotificacoesResposta = {
  itens: Notificacao[];
  naoLidas: number;
  /** Cursor da página seguinte (o `criadaEm` da última), ou null quando acabou. */
  proxima: string | null;
};

export type HorarioDeSilencio = {
  ativo: boolean;
  /** "HH:MM", no fuso da conta. Pode atravessar a meia-noite (22:00 a 07:00). */
  inicio: string;
  fim: string;
};

export type PreferenciasDeNotificacao = {
  canais: Record<TipoDeNotificacao, Record<CanalDeNotificacao, boolean>>;
  silencio: HorarioDeSilencio;
};

export const PREFERENCIAS_DE_NOTIFICACAO_PADRAO: PreferenciasDeNotificacao = {
  canais: {
    vencimentos: { central: true, celular: true, navegador: true },
    lembretes: { central: true, celular: true, navegador: true },
    gastos: { central: true, celular: true, navegador: true },
    tarefas: { central: true, celular: true, navegador: false },
    extratos: { central: true, celular: true, navegador: false },
    metas: { central: true, celular: true, navegador: false },
    limites: { central: true, celular: true, navegador: true },
    assistente: { central: true, celular: true, navegador: true },
  },
  silencio: { ativo: false, inicio: "22:00", fim: "07:00" },
};

const horaDoDia = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.");
const canaisDoTipo = z.object({ central: z.boolean(), celular: z.boolean(), navegador: z.boolean() });

export const ESQUEMA_PREFERENCIAS_DE_NOTIFICACAO = z.object({
  canais: z.object({
    vencimentos: canaisDoTipo,
    lembretes: canaisDoTipo,
    gastos: canaisDoTipo,
    tarefas: canaisDoTipo,
    extratos: canaisDoTipo,
    metas: canaisDoTipo,
    limites: canaisDoTipo,
    assistente: canaisDoTipo,
  }),
  silencio: z.object({ ativo: z.boolean(), inicio: horaDoDia, fim: horaDoDia }),
});

/**
 * Completa o que veio gravado com o padrão: um tipo novo nasce ligado como o padrão diz, sem migração.
 * O que não passa no esquema volta ao padrão.
 */
export function preferenciasDeNotificacaoDe(gravado: unknown): PreferenciasDeNotificacao {
  const base = PREFERENCIAS_DE_NOTIFICACAO_PADRAO;
  const bruto = (typeof gravado === "object" && gravado !== null ? gravado : {}) as Partial<PreferenciasDeNotificacao>;
  const canais = { ...base.canais };
  for (const tipo of TIPOS_DE_NOTIFICACAO) {
    const lido = canaisDoTipo.safeParse(bruto.canais?.[tipo]);
    if (lido.success) canais[tipo] = lido.data;
  }
  const silencio = ESQUEMA_PREFERENCIAS_DE_NOTIFICACAO.shape.silencio.safeParse(bruto.silencio);
  return { canais, silencio: silencio.success ? silencio.data : base.silencio };
}

/** Se a hora local ("HH:MM") cai no silêncio. O fim não entra: 22:00 a 07:00 volta a avisar às 07:00. */
export function emSilencio(silencio: HorarioDeSilencio, hora: string) {
  if (!silencio.ativo || silencio.inicio === silencio.fim) return false;
  if (silencio.inicio < silencio.fim) return hora >= silencio.inicio && hora < silencio.fim;
  return hora >= silencio.inicio || hora < silencio.fim;
}

/** O que o cliente precisa para oferecer o push: a chave pública do navegador e se o celular tem envio. */
export type CanaisDisponiveis = { navegador: string | null; celular: boolean };

export const ESQUEMA_DISPOSITIVO_DE_NOTIFICACAO = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("navegador"),
    endpoint: z.url().max(2048),
    chaves: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
  }),
  z.object({
    tipo: z.literal("celular"),
    token: z.string().min(1).max(4096),
    plataforma: z.enum(["android", "ios"]),
  }),
]);
export type DispositivoDeNotificacao = z.infer<typeof ESQUEMA_DISPOSITIVO_DE_NOTIFICACAO>;

/** O que vai no push. O navegador abre `url`; o app monta a própria rota pela `tela` e pelo `alvo`. */
export type CargaDoPush = {
  id: string;
  titulo: string;
  texto: string;
  tipo: TipoDeNotificacao;
  tela: TelaDeDestino;
  alvo: string | null;
  url: string;
};

/** A rota do web para um destino. */
export function rotaWebDoDestino(destino: DestinoDaNotificacao) {
  switch (destino.tela) {
    case "conferencia":
      return "/extratos/conferencia";
    case "assistente":
      return destino.id ? `/assistente?c=${encodeURIComponent(destino.id)}` : "/assistente";
    default:
      return `/${destino.tela}`;
  }
}
