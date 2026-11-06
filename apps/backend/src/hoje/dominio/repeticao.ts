import type { RepeticaoDeTarefa } from "@finnagent/contracts";

function somar(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function diaDaSemana(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** O mesmo dia no mês seguinte; quando o mês não tem esse dia, o último dia dele (31 de janeiro → 28 de fevereiro). */
function mesSeguinte(iso: string, diaDesejado: number) {
  const [ano, mes] = iso.split("-").map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // o dia 0 do mês seguinte é o último deste
  const dia = Math.min(diaDesejado, new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate());
  void ultimo;
  return new Date(Date.UTC(ano, mes, dia)).toISOString().slice(0, 10);
}

/** O próximo dia da regra depois de `date`. O dia pedido no "todo mês" é o do `date` original, guardado em `diaDoMes`. */
export function proximaDaRegra(date: string, repeat: RepeticaoDeTarefa, diaDoMes = Number(date.slice(8, 10))): string {
  if (repeat === "daily") return somar(date, 1);
  if (repeat === "weekly") return somar(date, 7);
  if (repeat === "monthly") return mesSeguinte(date, diaDoMes);
  // Dias úteis: pula o sábado e o domingo.
  let proxima = somar(date, 1);
  while (diaDaSemana(proxima) === 0 || diaDaSemana(proxima) === 6) proxima = somar(proxima, 1);
  return proxima;
}

/**
 * Quando a tarefa feita em `doneOn` nasce de novo: o próximo dia da regra depois do dia dela que ainda não passou.
 * Uma semanal de segunda feita na quarta volta na segunda seguinte; feita três semanas depois, não cria as que
 * ficaram para trás.
 */
export function proximaData(date: string, repeat: RepeticaoDeTarefa, doneOn: string): string {
  const diaDoMes = Number(date.slice(8, 10));
  let proxima = proximaDaRegra(date, repeat, diaDoMes);
  let voltas = 0;
  while (proxima <= doneOn && voltas < 10_000) {
    proxima = proximaDaRegra(proxima, repeat, diaDoMes);
    voltas += 1;
  }
  return proxima;
}
