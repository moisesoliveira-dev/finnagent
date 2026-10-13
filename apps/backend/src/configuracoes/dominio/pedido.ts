import {
  FUSOS_AGENDA,
  HORAS_PENDENTE,
  LEMBRETES,
  LIMITE_ID_MODELO,
  LIMITE_MODELOS_IA,
  MODOS_CATEGORIA,
  RETENCOES,
  TEMAS,
  idDeModelo,
  type HorasPendente,
  type Preferencias,
} from "@finnagent/contracts";
import { z } from "zod";

const horas = z.union([
  z.literal(HORAS_PENDENTE[0]),
  z.literal(HORAS_PENDENTE[1]),
  z.literal(HORAS_PENDENTE[2]),
  z.literal(HORAS_PENDENTE[3]),
]);

const pedido = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.enum(FUSOS_AGENDA),
  theme: z.enum(TEMAS),
  workflowDate: z.string(),
  personalCalendar: z.boolean(),
  workCalendar: z.boolean(),
  showEntries: z.boolean(),
  categorize: z.enum(MODOS_CATEGORIA),
  pendingHours: horas,
  reminder: z.enum(LEMBRETES),
  reminders: z.boolean(),
  dueAlerts: z.boolean(),
  emailAlerts: z.boolean(),
  appAlerts: z.boolean(),
  history: z.enum(RETENCOES),
  googleClientId: z.string().trim().max(200).default(""),
  googleClientSecret: z.string().max(400).default(""),
  limparSegredoGoogle: z.boolean().default(false),
  googleCalendarPersonal: z.string().trim().max(300).default(""),
  googleCalendarWork: z.string().trim().max(300).default(""),
  aiModels: z.array(z.string().trim().min(1).max(LIMITE_ID_MODELO)).max(LIMITE_MODELOS_IA).default([]),
  aiModel: z.string().trim().max(LIMITE_ID_MODELO).default(""),
  aiApiKey: z.string().max(400).default(""),
  limparChaveIa: z.boolean().default(false),
});

export function dataDoWorkflow(texto: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return null;
  const data = new Date(Date.UTC(year, month - 1, day));
  if (data.getUTCFullYear() !== year || data.getUTCMonth() !== month - 1 || data.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function isoDoWorkflow(data: { year: number; month: number; day: number }) {
  const mes = String(data.month).padStart(2, "0");
  const dia = String(data.day).padStart(2, "0");
  return `${data.year}-${mes}-${dia}`;
}

export function interpretarConfiguracao(body: unknown): Preferencias | string {
  const parsed = pedido.safeParse(body);
  if (!parsed.success) {
    const campo = parsed.error.issues[0]?.path[0];
    if (campo === "name") return "Informe o nome da conta.";
    if (campo === "aiModels" || campo === "aiModel") return "Não foi possível salvar os modelos.";
    return "Não foi possível salvar as configurações.";
  }
  if (!dataDoWorkflow(parsed.data.workflowDate)) return "Informe uma data válida.";
  const modelos = listaDeModelos(parsed.data.aiModels);
  if (!modelos) return "Informe um identificador de modelo válido.";
  const ativo = idDeModelo(parsed.data.aiModel);
  if (parsed.data.aiModel && !ativo) return "Informe um identificador de modelo válido.";
  if ((modelos.length > 0 && !modelos.includes(ativo)) || (modelos.length === 0 && ativo)) {
    return "Escolha qual modelo usar.";
  }
  return { ...parsed.data, aiModels: modelos, aiModel: ativo };
}

export function horasDe(valor: number): HorasPendente {
  return HORAS_PENDENTE.find((hora) => hora === valor) ?? 24;
}

export function modelosSalvos(lista: string[] | null | undefined, ativo: string | null | undefined) {
  const vistos = new Set<string>();
  const aiModels: string[] = [];
  for (const item of lista ?? []) {
    const nome = idDeModelo(item);
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    aiModels.push(nome);
  }
  const escolhido = idDeModelo(ativo ?? "");
  return { aiModels, aiModel: aiModels.includes(escolhido) ? escolhido : "" };
}

function listaDeModelos(lista: string[]) {
  const vistos = new Set<string>();
  const modelos: string[] = [];
  for (const item of lista) {
    const nome = idDeModelo(item);
    if (!nome) return null;
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    modelos.push(nome);
  }
  return modelos;
}
