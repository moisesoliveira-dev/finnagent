import type { ProvedorIa } from "@finnagent/contracts";

/** Uma conta grosseira de tokens: cerca de 4 caracteres por token, em português e em JSON. */
export function tokensEstimados(caracteres: number) {
  return Math.round(caracteres / 4);
}

/**
 * O Ollama corta sem avisar o que passa do contexto do modelo (o padrão é pequeno), e a resposta sai sem as
 * instruções e sem as ferramentas. Quando o modelo leu bem menos tokens do que foi enviado, o pedido foi cortado.
 * Só vale para o Ollama: os provedores na nuvem recusam com erro em vez de cortar.
 */
export function avisoDeContextoCortado(kind: ProvedorIa, lidos: number | undefined, enviados: number) {
  if (kind !== "ollama" || !lidos || lidos <= 0 || enviados <= 0) return null;
  if (lidos >= enviados * 0.6) return null;
  const precisa = Math.ceil((enviados * 1.25) / 1024) * 1024;
  return `O Ollama cortou o pedido: o modelo leu cerca de ${lidos} tokens de uns ${enviados} enviados, então ficou sem as instruções e as ferramentas. Aumente o contexto do Ollama para pelo menos ${precisa} tokens (variável OLLAMA_CONTEXT_LENGTH no servidor, ou PARAMETER num_ctx no Modelfile do modelo) e tente de novo.`;
}
