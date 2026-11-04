import type { LinhaExtrato } from "@finnagent/contracts";

/**
 * As linhas que o modelo devolveu em JSON. Extrato longo pode estourar a resposta do modelo e o JSON chega
 * cortado no meio: em vez de perder tudo, aproveita cada linha que chegou inteira e marca `cortada`.
 */
export function linhasDaResposta(texto: string): { linhas: unknown[]; cortada: boolean } {
  const limpo = texto.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const inicio = limpo.indexOf("{");
  if (inicio < 0) return { linhas: [], cortada: false };
  const fim = limpo.lastIndexOf("}");
  if (fim > inicio) {
    try {
      const corpo = JSON.parse(limpo.slice(inicio, fim + 1)) as { linhas?: unknown };
      return { linhas: Array.isArray(corpo.linhas) ? corpo.linhas : [], cortada: false };
    } catch {
      // JSON incompleto: segue para recuperar as linhas inteiras.
    }
  }
  return { linhas: linhasInteiras(limpo), cortada: true };
}

/** Os objetos completos dentro da lista "linhas", lidos caractere a caractere até onde o texto vai. */
function linhasInteiras(texto: string) {
  const chave = texto.search(/"linhas"\s*:\s*\[/);
  if (chave < 0) return [];
  const linhas: unknown[] = [];
  let profundidade = 0;
  let comeco = -1;
  let emTexto = false;
  let escapado = false;
  for (let i = texto.indexOf("[", chave) + 1; i < texto.length; i += 1) {
    const letra = texto[i];
    if (emTexto) {
      if (escapado) escapado = false;
      else if (letra === "\\") escapado = true;
      else if (letra === '"') emTexto = false;
      continue;
    }
    if (letra === '"') emTexto = true;
    else if (letra === "{") {
      if (profundidade === 0) comeco = i;
      profundidade += 1;
    } else if (letra === "}") {
      profundidade -= 1;
      if (profundidade === 0 && comeco >= 0) {
        try {
          linhas.push(JSON.parse(texto.slice(comeco, i + 1)));
        } catch {
          // Objeto malformado: fica de fora, como ficaria na leitura inteira.
        }
        comeco = -1;
      }
    } else if (letra === "]" && profundidade === 0) break;
  }
  return linhas;
}

export const MENSAGEM_DA_LEITURA_CORTADA =
  "A resposta da IA veio cortada antes de trazer uma linha completa: o extrato é longo demais para uma leitura só. Divida o arquivo em partes menores e importe cada uma.";

/** A linha que avisa, na lista de erros da importação, onde a leitura parou. */
export function linhaDoCorte(line: number): LinhaExtrato {
  return {
    line,
    date: null,
    description: "",
    cents: null,
    error: "A leitura do extrato foi cortada aqui: as linhas depois desta podem faltar. Divida o arquivo em partes menores e importe o resto.",
  };
}
