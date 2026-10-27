import type { Compromisso } from "@finnagent/contracts";

export type SessaoDoCompromisso = { sessionId: string; title: string };

// Linha do banco no dia de um compromisso com sessão: a sessão dele é a sugestão. Se dois compromissos do dia
// apontam para sessões diferentes, não há como escolher por ela e o sistema não sugere nada.
export function sessaoDoCompromisso(
  date: string,
  compromissos: Pick<Compromisso, "year" | "month" | "day" | "sessionId" | "title">[],
): SessaoDoCompromisso | null {
  const doDia = compromissos.filter(
    (item) =>
      item.sessionId &&
      `${String(item.year).padStart(4, "0")}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}` ===
        date,
  );
  const sessoes = new Set(doDia.map((item) => item.sessionId));
  if (sessoes.size !== 1) return null;
  const [primeiro] = doDia;
  return { sessionId: primeiro.sessionId as string, title: primeiro.title };
}
