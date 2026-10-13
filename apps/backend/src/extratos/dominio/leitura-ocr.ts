import type { LinhaExtrato } from "@finnagent/contracts";
import type { LeituraExtrato } from "./ler-extrato.js";

export function leituraDasLinhas(lines: LinhaExtrato[]): LeituraExtrato {
  const datas = lines.flatMap((linha) => (linha.date ? [linha.date] : [])).sort();
  const erros = lines.filter((linha) => linha.error).length;
  return {
    status: lines.length === 0 ? "falhou" : erros > 0 ? "com_erros" : "importado",
    message: lines.length === 0 ? "Nenhuma linha encontrada no extrato." : "",
    startDate: datas[0] ?? null,
    endDate: datas.at(-1) ?? null,
    lines,
  };
}
