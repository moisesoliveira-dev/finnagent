import type { LinhaExtrato } from "@finnagent/contracts";
import { chaveDoNome } from "./nome-extrato.js";

export type LinhaGravada = { date: string; cents: number; description: string };

function chaveDaLinha(linha: { date: string | null; cents: number | null; description: string }) {
  return `${linha.date ?? ""}|${linha.cents ?? ""}|${chaveDoNome(linha.description)}`;
}

// Extratos de períodos que se sobrepõem trazem a mesma transação duas vezes. Cada linha já gravada em outro
// extrato da conta cobre uma linha nova igual; o que sobra entra. Duas compras iguais no mesmo dia continuam
// valendo, porque só se descarta até a quantidade que já existe.
export function descartarRepetidas(novas: LinhaExtrato[], gravadas: LinhaGravada[]) {
  const sobra = new Map<string, number>();
  for (const linha of gravadas) {
    const chave = chaveDaLinha(linha);
    sobra.set(chave, (sobra.get(chave) ?? 0) + 1);
  }
  const lines: LinhaExtrato[] = [];
  let ignoradas = 0;
  for (const linha of novas) {
    const chave = chaveDaLinha(linha);
    const restante = sobra.get(chave) ?? 0;
    if (linha.error || restante === 0) {
      lines.push(linha);
      continue;
    }
    sobra.set(chave, restante - 1);
    ignoradas += 1;
  }
  return { lines, ignoradas };
}

export function avisoDeRepetidas(ignoradas: number) {
  if (ignoradas === 0) return "";
  return ignoradas === 1
    ? "1 linha já estava em outro extrato desta conta e foi ignorada."
    : `${ignoradas} linhas já estavam em outro extrato desta conta e foram ignoradas.`;
}
