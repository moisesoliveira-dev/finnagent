import type { Compromisso, Lancamento, PerguntaDeGasto } from "@finnagent/contracts";
import { dataDoCompromisso, gastoDoCompromisso } from "./gasto.js";
import { instanteNoFuso, partesNoFuso } from "./fuso.js";

/** O compromisso do dia inteiro não tem hora de fim: a pergunta sai nesta hora local do próprio dia. */
export const HORA_DA_PERGUNTA_DO_DIA_TODO = { hour: 20, minute: 0 };

/** A chave de uma resposta: o compromisso e o dia da ocorrência (o que repete tem uma resposta por dia). */
export function chaveDaResposta(appointmentId: string, date: string) {
  return `${appointmentId}:${date}`;
}

/** Quando a ocorrência termina, de verdade, para a pergunta: o fim marcado, ou as 20h no dia inteiro. */
export function fimParaPergunta(item: Pick<Compromisso, "allDay" | "endAt" | "year" | "month" | "day" | "timezone">) {
  if (!item.allDay) return new Date(item.endAt);
  const { hour, minute } = HORA_DA_PERGUNTA_DO_DIA_TODO;
  return instanteNoFuso(item.year, item.month, item.day, hour, minute, item.timezone);
}

/** Já existe gasto do compromisso nesse dia: na sessão dele, ou um lançamento ligado a ele com data nesse dia. */
function jaTemGasto(item: Compromisso, entries: Lancamento[]) {
  if (gastoDoCompromisso(item, entries) !== 0) return true;
  const data = dataDoCompromisso(item);
  return entries.some(
    (entry) =>
      entry.commitmentId === item.id &&
      (entry.occurrences ?? []).some((ocorrencia) => (ocorrencia.paidOn ?? ocorrencia.dueDate) === data),
  );
}

/**
 * Os compromissos que terminaram e merecem a pergunta "teve gasto?": a pessoa não desligou a pergunta, o compromisso
 * não é o lembrete de um lançamento (esse já é dinheiro), o dia inteiro só pergunta quando tem sessão de gastos,
 * ainda não há gasto dele nesse dia e a pessoa não respondeu. As ocorrências chegam já filtradas pelos dias que
 * contam (ontem e hoje).
 */
export function perguntasDeGasto(
  ocorrencias: Compromisso[],
  entries: Lancamento[],
  respondidas: Set<string>,
  agora: Date,
  rotulos: Map<string, string>,
): PerguntaDeGasto[] {
  const lista: PerguntaDeGasto[] = [];
  for (const item of ocorrencias) {
    if (!item.askSpending || item.entryId) continue;
    if (item.allDay && !item.sessionId) continue;
    const fim = fimParaPergunta(item);
    if (fim.getTime() > agora.getTime()) continue;
    const date = dataDoCompromisso(item);
    if (respondidas.has(chaveDaResposta(item.id, date))) continue;
    if (jaTemGasto(item, entries)) continue;
    const local = partesNoFuso(fim, item.timezone);
    lista.push({
      appointmentId: item.id,
      date,
      title: item.title,
      location: item.location,
      time: item.allDay ? null : item.time,
      endTime: item.allDay ? null : (item.endTime ?? null),
      allDay: item.allDay,
      endedAt: fim.toISOString(),
      endedAtLocal: `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`,
      sessionId: item.sessionId,
      sessionLabel: item.sessionId ? (rotulos.get(item.sessionId) ?? null) : null,
    });
  }
  return lista.sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.title.localeCompare(b.title, "pt-BR"));
}
