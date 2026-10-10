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
  justification: string;
  startedAt: string | null;
  endedAt: string | null;
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

export const MODOS_TRANSACAO = ["inflows", "outflows"] as const;
export type ModoTransacao = (typeof MODOS_TRANSACAO)[number];

export const STATUS_TRANSACAO = ["pending", "completed", "cancelled", "refunded"] as const;
export type StatusTransacao = (typeof STATUS_TRANSACAO)[number];

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
  if (entry.status === "cancelled" || entry.status === "refunded") return undefined;
  const efeito = entry.adjustments.find(
    (ajuste) => ajuste.year === year && ajuste.month === monthIndex + 1,
  )?.effect;
  if (efeito === "cancelled" || efeito === "suspended") return undefined;
  return valorDoCalendario(entry, year, monthIndex);
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
  const inicio = instante(startYear, startMonth, day);
  const inicioMes = Date.UTC(year, monthIndex, 1);
  const fimMes = Date.UTC(year, monthIndex + 1, 0);
  if (fimMes < inicio) return 0;
  const passo = stepDays * 86_400_000;
  const aPartir = Math.max(inicio, inicioMes);
  const saltos = Math.ceil((aPartir - inicio) / passo);
  let total = 0;
  for (let quando = inicio + saltos * passo; quando <= fimMes; quando += passo) {
    total += 1;
    if (total > 31) break;
  }
  return total;
}

function instante(year: number, month: number, day: number) {
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Date.UTC(year, month - 1, Math.min(Math.max(day, 1), ultimo));
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

export type Meta = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  dueYear: number | null;
  dueMonth: number | null;
};

export type MetasResposta = {
  goals: Meta[];
  surplusCents: number;
  year: number;
  month: number;
};

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
};

export function montarPainel(
  scope: EscopoPainel,
  year: number,
  month: number | null,
  day: number | null,
  workflow: Workflow,
  entries: Lancamento[],
  appointments: Compromisso[],
): PainelResposta {
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
  };
}

export const CATEGORIAS_EVENTO = [
  {
    code: "financeiro",
    name: "Financeiro",
    description: "Lançamentos, sessões, grupos e metas",
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
    description: "Importação e leitura de extratos",
    active: true,
  },
  {
    code: "agente",
    name: "Agente",
    description: "Ações propostas e confirmadas pela IA",
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

export type EventosResposta = {
  categories: Array<(typeof CATEGORIAS_EVENTO)[number]>;
  events: Evento[];
  history: HistoricoEvento[];
};

export type LinhaOutbox = {
  id: string;
  operation: string;
  idempotencyKey: string;
  payload: string;
  occurredAt: string;
  publishedAt: string | null;
};

export type LinhaConsumo = {
  idempotencyKey: string;
  consumedAt: string;
};

const FINANCEIRO = new Set([
  "definir-workflow",
  "criar-lancamento",
  "atualizar-lancamento",
  "atualizar-status-lancamento",
  "associar-compromisso",
  "adiantar-parcelas",
  "cancelar-parcelas",
  "adiantar-emprestimo",
  "cancelar-emprestimo",
  "cancelar-fixo",
  "suspender-fixo",
  "atualizar-valor-fixo",
  "criar-grupo",
  "atualizar-grupo",
  "remover-grupo",
  "criar-sessao",
  "atualizar-sessao",
  "encerrar-sessao",
  "remover-sessao",
  "criar-meta",
  "excluir-meta",
]);

const EXTRATOS = new Set([
  "importar-extrato",
  "reprocessar-extrato",
  "cruzar-linha",
  "excluir-extrato",
]);

const NOME_AGREGADO: Record<string, string> = {
  "definir-workflow": "Fluxo",
  "criar-lancamento": "Lançamento",
  "atualizar-lancamento": "Lançamento",
  "atualizar-status-lancamento": "Lançamento",
  "associar-compromisso": "Lançamento",
  "adiantar-parcelas": "Lançamento",
  "cancelar-parcelas": "Lançamento",
  "adiantar-emprestimo": "Lançamento",
  "cancelar-emprestimo": "Lançamento",
  "cancelar-fixo": "Lançamento",
  "suspender-fixo": "Lançamento",
  "atualizar-valor-fixo": "Lançamento",
  "criar-grupo": "Grupo",
  "atualizar-grupo": "Grupo",
  "remover-grupo": "Grupo",
  "criar-sessao": "Sessão",
  "atualizar-sessao": "Sessão",
  "encerrar-sessao": "Sessão",
  "remover-sessao": "Sessão",
  "criar-meta": "Meta",
  "excluir-meta": "Meta",
  "criar-compromisso": "Compromisso",
  "importar-extrato": "Extrato",
  "reprocessar-extrato": "Extrato",
  "cruzar-linha": "Linha de extrato",
  "excluir-extrato": "Extrato",
};

export function montarEventos(linhas: LinhaOutbox[], consumos: LinhaConsumo[]): EventosResposta {
  const consumido = new Map(consumos.map((linha) => [linha.idempotencyKey, linha]));
  const events = linhas.map((linha) => eventoDe(linha, consumido.has(linha.idempotencyKey)));
  const porChave = new Map(linhas.map((linha, indice) => [linha.idempotencyKey, events[indice]]));
  const history = consumos.flatMap((consumo) => {
    const montado = porChave.get(consumo.idempotencyKey);
    if (!montado) return [];
    return [
      {
        eventId: montado.id,
        eventType: montado.type,
        consumer: "Publicar outbox",
        result: "sucesso" as const,
        attempt: 1,
        durationMs: null,
        occurredAt: consumo.consumedAt,
        error: "",
      },
    ];
  });
  events.sort((a, b) => compararRecente(a.occurredAt, b.occurredAt));
  history.sort((a, b) => compararRecente(a.occurredAt, b.occurredAt));
  return { categories: [...CATEGORIAS_EVENTO], events, history };
}

function eventoDe(linha: LinhaOutbox, publicadoEConsumido: boolean): Evento {
  const bruto = lerJson(linha.payload);
  return {
    id: linha.id,
    type: linha.operation,
    category: categoriaDe(linha.operation),
    origin:
      linha.operation === "importar-extrato" || linha.operation === "reprocessar-extrato"
        ? "importação"
        : "sistema",
    aggregate: agregadoDe(linha.operation, bruto),
    status: !linha.publishedAt ? "pendente" : publicadoEConsumido ? "concluído" : "processando",
    occurredAt: linha.occurredAt,
    correlationId: null,
    causationId: null,
    idempotencyKey: linha.idempotencyKey,
    schemaVersion: 1,
    payload: mascararValor(bruto),
  };
}

function compararRecente(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

function categoriaDe(operation: string): CodigoCategoriaEvento {
  if (FINANCEIRO.has(operation)) return "financeiro";
  if (operation === "criar-compromisso") return "agenda";
  if (EXTRATOS.has(operation)) return "extratos";
  return "sistema";
}

function agregadoDe(operation: string, payload: unknown) {
  const nome = NOME_AGREGADO[operation] ?? "Registro";
  if (!payload || typeof payload !== "object") return nome;
  const registro = payload as { id?: unknown; statementId?: unknown };
  const id = typeof registro.id === "string" ? registro.id : typeof registro.statementId === "string" ? registro.statementId : "";
  return id ? `${nome} · ${id}` : nome;
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
    /(token|senha|password|secret|authorization|cpf)/i.test(chave) ||
    /^(conta|account|cartao|cartão)$/i.test(chave)
  );
}
