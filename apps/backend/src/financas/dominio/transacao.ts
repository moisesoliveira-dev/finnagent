import type { StatusTransacao } from "@finnagent/contracts";

export function dataDaTransacao(year: number, month: number, day: number) {
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dia = Math.min(Math.max(day, 1), ultimo);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function dataValida(iso: string) {
  const { year, month, day } = partesDaData(iso);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const data = new Date(Date.UTC(year, month - 1, day));
  return (
    data.getUTCFullYear() === year && data.getUTCMonth() === month - 1 && data.getUTCDate() === day
  );
}

export function partesDaData(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { year: ano ?? 0, month: mes ?? 0, day: dia ?? 0 };
}

export function jurosEmPontos(percentual: number) {
  return Math.round(percentual * 100);
}

export function percentualDeJuros(pontos: number) {
  return pontos / 100;
}

export function adiantarParcela(numero: number, total: number, status: StatusTransacao) {
  if (status === "cancelled" || status === "refunded") return "encerrada" as const;
  if (numero >= total) return "concluida" as const;
  const installmentNumber = numero + 1;
  return {
    installmentNumber,
    status: installmentNumber >= total ? ("completed" as const) : status,
  };
}
