import type { Ocorrencia } from "@finnagent/contracts";

const DIA = 24 * 60 * 60 * 1000;

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

export function pagarOcorrencia(item: Ocorrencia, cents: number, date: string): Ocorrencia {
  return { ...item, status: "completed", paidCents: cents, paidOn: date };
}
