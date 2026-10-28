import { centavosNoMes, ocorrenciasDoLancamento, type FinancasResposta, type LancamentoDoMes } from "@finnagent/contracts";
import { situacaoNoMes } from "../../financas/dominio/vista.js";

/** Os vencimentos do mês para a agenda, no dia real de cada um. */
export function lancamentosDoMes(base: FinancasResposta, year: number, month: number, hoje: string) {
  const monthIndex = month - 1;
  const ultimo = new Date(year, month, 0).getDate();
  const entries: LancamentoDoMes[] = [];
  const prefixo = `${year}-${String(month).padStart(2, "0")}-`;
  for (const entry of base.entries) {
    if (centavosNoMes(entry, base.workflow, year, monthIndex) === undefined) continue;
    // Um item por dia de vencimento no mês, já com a regra de dia útil: o ajuste pode trazer para cá o
    // vencimento de outro mês, e a fixa semanal vence mais de uma vez. A soma dos dias é o valor do mês.
    const porDia = new Map<number, { number: number; cents: number }>();
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (!item.dueDate.startsWith(prefixo) || (item.status !== "pending" && item.status !== "completed")) continue;
      const dia = Math.min(Number(item.dueDate.slice(8, 10)), ultimo);
      const valor = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
      const atual = porDia.get(dia);
      porDia.set(dia, { number: atual?.number ?? item.number, cents: (atual?.cents ?? 0) + valor });
    }
    for (const [day, item] of [...porDia].sort((a, b) => a[0] - b[0])) {
      entries.push({
        id: entry.id,
        number: item.number,
        description: entry.description,
        day,
        groupName: entry.groupName,
        sessionName: entry.sessionName,
        cents: item.cents,
        situation: situacaoNoMes(entry, year, month, hoje),
      });
    }
  }
  return entries;
}
