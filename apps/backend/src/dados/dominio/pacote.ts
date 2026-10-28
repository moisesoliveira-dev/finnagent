import { randomUUID } from "node:crypto";
import { AJUSTES_DE_DIA_UTIL, CONTAGENS_DE_DIA_UTIL, TIPOS_DE_REGRA } from "@finnagent/contracts";
import { z } from "zod";

export const APLICATIVO = "finnagent";
export const VERSAO_DO_PACOTE = 1;

const texto = z.string().max(100_000);
const inteiro = z.number().int();
const data = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)))
  .transform((valor) => new Date(valor));
const dataOuNulo = data.nullable();
const id = z.string().min(1).max(80);
const idOuNulo = id.nullable();
const lista = <T extends z.ZodType>(item: T) => z.array(item).max(500_000).default([]);

const grupo = z.object({ id, name: texto, description: texto });
const sessao = z.object({
  id,
  groupId: id,
  name: texto,
  description: texto,
  justification: texto,
  startedAt: dataOuNulo,
  endedAt: dataOuNulo,
  cents: inteiro,
  kind: texto,
});
const acrescimo = z.object({ id, sessionId: id, cents: inteiro, note: texto, createdAt: data });
const permanencia = z.object({ year: inteiro, decidedAt: data });
const lancamento = z.object({
  id,
  sessionId: id,
  type: texto,
  description: texto,
  justification: texto,
  day: inteiro,
  cents: inteiro,
  startYear: inteiro,
  startMonth: inteiro,
  installments: inteiro.nullable(),
  position: inteiro,
  name: texto,
  occurredOn: data,
  mode: texto,
  status: texto,
  transactionType: texto,
  category: texto,
  priority: texto,
  installmentNumber: inteiro.nullable(),
  dueOn: dataOuNulo,
  interestBps: inteiro.nullable(),
  nextDueOn: dataOuNulo,
  suspendedCents: inteiro,
  commitmentId: idOuNulo,
  recurrence: texto.nullable(),
  recurrenceInterval: inteiro.nullable(),
  dueRule: z.enum(TIPOS_DE_REGRA).default("dia"),
  dueOrder: inteiro.min(1).max(23).nullable().default(null),
  dueShift: z.enum(AJUSTES_DE_DIA_UTIL).default("manter"),
  dueCount: z.enum(CONTAGENS_DE_DIA_UTIL).default("bancaria"),
});
const ocorrencia = z.object({
  entryId: id,
  number: inteiro,
  dueOn: data,
  plannedCents: inteiro,
  paidCents: inteiro.nullable(),
  paidOn: dataOuNulo,
  status: texto,
});
const ajuste = z.object({ entryId: id, year: inteiro, month: inteiro, effect: texto });
const valor = z.object({ entryId: id, year: inteiro, month: inteiro, cents: inteiro });
const compromisso = z.object({
  id,
  title: texto,
  description: texto,
  location: texto,
  startAt: data,
  endAt: data,
  allDay: z.boolean(),
  status: texto,
  year: inteiro,
  month: inteiro,
  day: inteiro,
  hour: inteiro.nullable(),
  minute: inteiro.nullable(),
  calendar: texto,
  category: texto,
  endYear: inteiro.nullable(),
  endMonth: inteiro.nullable(),
  endDay: inteiro.nullable(),
  entryId: idOuNulo,
  // Pacotes exportados antes da sessão do compromisso não trazem o campo.
  sessionId: idOuNulo.default(null),
});
const agenda =z.object({ id, name: texto, timezone: texto });
const conta = z.object({ id, name: texto });
const extrato = z.object({
  id,
  accountId: id,
  filename: texto,
  format: texto,
  status: texto,
  message: texto,
  startDate: dataOuNulo,
  endDate: dataOuNulo,
  lineCount: inteiro,
  errorCount: inteiro,
  importedAt: data,
  content: z.string(),
  contentHash: texto,
  dateColumn: inteiro.nullable(),
  descriptionColumn: inteiro.nullable(),
  amountColumn: inteiro.nullable(),
});
const linhaDeExtrato = z.object({
  statementId: id,
  line: inteiro,
  postedOn: dataOuNulo,
  description: texto,
  cents: inteiro.nullable(),
  error: texto,
  entryId: idOuNulo,
});
const apelido = z.object({ name: texto, sessionId: id, entryId: idOuNulo });
const meta = z.object({
  id,
  name: texto,
  targetCents: inteiro,
  savedCents: inteiro,
  dueYear: inteiro.nullable(),
  dueMonth: inteiro.nullable(),
});
const preferencias = z.object({
  name: texto,
  timezone: texto,
  theme: texto,
  personalCalendar: z.boolean(),
  workCalendar: z.boolean(),
  showEntries: z.boolean(),
  categorize: texto,
  pendingHours: inteiro,
  reminder: texto,
  reminders: z.boolean(),
  dueAlerts: z.boolean(),
  emailAlerts: z.boolean(),
  appAlerts: z.boolean(),
  history: texto,
  aiModels: z.array(texto).max(100),
  aiModel: texto,
  dueDefaults: z.record(z.string(), z.enum(AJUSTES_DE_DIA_UTIL)).default({}),
  showHolidays: z.boolean().default(true),
  showOptionalHolidays: z.boolean().default(true),
});
const feriadoLocal = z.object({ id, name: texto, day: inteiro.min(1).max(31), month: inteiro.min(1).max(12) });
const fluxo = z.object({ year: inteiro, month: inteiro, day: inteiro });

const dados = z.object({
  groups: lista(grupo),
  sessions: lista(sessao),
  sessionAdditions: lista(acrescimo),
  yearStays: lista(permanencia),
  entries: lista(lancamento),
  entryOccurrences: lista(ocorrencia),
  entryAdjustments: lista(ajuste),
  entryAmounts: lista(valor),
  appointments: lista(compromisso),
  calendars: lista(agenda),
  accounts: lista(conta),
  statements: lista(extrato),
  statementLines: lista(linhaDeExtrato),
  statementAliases: lista(apelido),
  goals: lista(meta),
  holidays: lista(feriadoLocal),
  preferences: preferencias.nullable().default(null),
  workflow: fluxo.nullable().default(null),
});

const pacote = z.object({
  app: z.literal(APLICATIVO),
  version: z.number().int(),
  exportedAt: z.string(),
  data: dados,
});

export type DadosDoPacote = z.infer<typeof dados>;
export type PacoteDeDados = z.infer<typeof pacote>;

export function interpretarPacote(corpo: unknown): PacoteDeDados | string {
  const cabecalho = pacote.pick({ app: true, version: true }).safeParse(corpo);
  if (!cabecalho.success) return "Este arquivo não é uma exportação do Prumo.";
  if (cabecalho.data.version > VERSAO_DO_PACOTE) {
    return "Este arquivo foi gerado por uma versão mais nova do Prumo.";
  }
  const lido = pacote.safeParse(corpo);
  if (!lido.success) return "O arquivo está incompleto ou corrompido.";
  return referenciasConsistentes(lido.data.data)
    ? lido.data
    : "O arquivo está incompleto ou corrompido.";
}

function referenciasConsistentes(dados: DadosDoPacote) {
  const grupos = new Set(dados.groups.map((item) => item.id));
  const sessoes = new Set(dados.sessions.map((item) => item.id));
  const lancamentos = new Set(dados.entries.map((item) => item.id));
  const contas = new Set(dados.accounts.map((item) => item.id));
  const extratos = new Set(dados.statements.map((item) => item.id));
  return (
    dados.sessions.every((item) => grupos.has(item.groupId)) &&
    dados.sessionAdditions.every((item) => sessoes.has(item.sessionId)) &&
    dados.entries.every((item) => sessoes.has(item.sessionId)) &&
    dados.entryOccurrences.every((item) => lancamentos.has(item.entryId)) &&
    dados.entryAdjustments.every((item) => lancamentos.has(item.entryId)) &&
    dados.entryAmounts.every((item) => lancamentos.has(item.entryId)) &&
    dados.appointments.every(
      (item) => (!item.entryId || lancamentos.has(item.entryId)) && (!item.sessionId || sessoes.has(item.sessionId)),
    ) &&
    dados.statements.every((item) => contas.has(item.accountId)) &&
    dados.statementLines.every(
      (item) => extratos.has(item.statementId) && (!item.entryId || lancamentos.has(item.entryId)),
    ) &&
    dados.statementAliases.every(
      (item) => sessoes.has(item.sessionId) && (!item.entryId || lancamentos.has(item.entryId)),
    )
  );
}

/**
 * Dá identificadores novos a tudo que vem do pacote. Os ids são únicos no banco
 * inteiro (não só por tenant), então reaproveitar os do arquivo colidiria com os
 * de quem exportou quando os dois usam o mesmo banco.
 */
export function renovarIdentificadores(dados: DadosDoPacote): DadosDoPacote {
  const grupos = novoMapa(dados.groups);
  const sessoes = novoMapa(dados.sessions);
  const lancamentos = novoMapa(dados.entries);
  const compromissos = novoMapa(dados.appointments);
  const contas = novoMapa(dados.accounts);
  const extratos = novoMapa(dados.statements);
  const de = (mapa: Map<string, string>, antigo: string | null) =>
    antigo === null ? null : (mapa.get(antigo) ?? null);
  const para = (mapa: Map<string, string>, antigo: string) => mapa.get(antigo) as string;
  return {
    ...dados,
    groups: dados.groups.map((item) => ({ ...item, id: para(grupos, item.id) })),
    sessions: dados.sessions.map((item) => ({
      ...item,
      id: para(sessoes, item.id),
      groupId: para(grupos, item.groupId),
    })),
    sessionAdditions: dados.sessionAdditions.map((item) => ({
      ...item,
      id: randomUUID(),
      sessionId: para(sessoes, item.sessionId),
    })),
    entries: dados.entries.map((item) => ({
      ...item,
      id: para(lancamentos, item.id),
      sessionId: para(sessoes, item.sessionId),
      commitmentId: de(compromissos, item.commitmentId),
    })),
    entryOccurrences: dados.entryOccurrences.map((item) => ({
      ...item,
      entryId: para(lancamentos, item.entryId),
    })),
    entryAdjustments: dados.entryAdjustments.map((item) => ({
      ...item,
      entryId: para(lancamentos, item.entryId),
    })),
    entryAmounts: dados.entryAmounts.map((item) => ({
      ...item,
      entryId: para(lancamentos, item.entryId),
    })),
    appointments: dados.appointments.map((item) => ({
      ...item,
      id: para(compromissos, item.id),
      entryId: de(lancamentos, item.entryId),
    })),
    calendars: dados.calendars.map((item) => ({ ...item, id: randomUUID() })),
    accounts: dados.accounts.map((item) => ({ ...item, id: para(contas, item.id) })),
    statements: dados.statements.map((item) => ({
      ...item,
      id: para(extratos, item.id),
      accountId: para(contas, item.accountId),
    })),
    statementLines: dados.statementLines.map((item) => ({
      ...item,
      statementId: para(extratos, item.statementId),
      entryId: de(lancamentos, item.entryId),
    })),
    statementAliases: dados.statementAliases.map((item) => ({
      ...item,
      sessionId: para(sessoes, item.sessionId),
      entryId: de(lancamentos, item.entryId),
    })),
    goals: dados.goals.map((item) => ({ ...item, id: randomUUID() })),
    holidays: dados.holidays.map((item) => ({ ...item, id: randomUUID() })),
  };
}

function novoMapa(itens: { id: string }[]) {
  return new Map(itens.map((item) => [item.id, randomUUID()]));
}

export type ResumoDaImportacao = {
  groups: number;
  sessions: number;
  entries: number;
  appointments: number;
  statements: number;
  goals: number;
};

export function resumoDe(dados: DadosDoPacote): ResumoDaImportacao {
  return {
    groups: dados.groups.length,
    sessions: dados.sessions.length,
    entries: dados.entries.length,
    appointments: dados.appointments.length,
    statements: dados.statements.length,
    goals: dados.goals.length,
  };
}
