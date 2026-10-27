import type { Compromisso, Lancamento } from "@finnagent/contracts";

export function dataDoCompromisso({ year, month, day }: Pick<Compromisso, "year" | "month" | "day">) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// O compromisso acumula o que foi pago na sessão dele no próprio dia. Saída vem negativa, como no extrato.
export function gastoDoCompromisso(
  compromisso: Pick<Compromisso, "sessionId" | "year" | "month" | "day">,
  entries: Lancamento[],
) {
  if (!compromisso.sessionId) return 0;
  const data = dataDoCompromisso(compromisso);
  let soma = 0;
  for (const entry of entries) {
    if (entry.sessionId !== compromisso.sessionId) continue;
    for (const ocorrencia of entry.occurrences ?? []) {
      if (ocorrencia.status !== "completed") continue;
      if ((ocorrencia.paidOn ?? ocorrencia.dueDate) !== data) continue;
      soma += ocorrencia.paidCents ?? ocorrencia.plannedCents;
    }
  }
  return soma;
}
