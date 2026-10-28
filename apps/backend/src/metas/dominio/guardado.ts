import { ocorrenciasDoLancamento, type Lancamento } from "@finnagent/contracts";
import { valorDaOcorrencia } from "../../financas/dominio/vista.js";

/**
 * O que a sessão de uma meta acumulou. Saída é negativa no sistema: o valor separado vira positivo aqui.
 * Pendente e paga contam; cancelada e estornada não. Uma entrada na sessão (retirada) abate.
 */
export function valorSeparado(entries: Lancamento[], sessionId: string) {
  let soma = 0;
  for (const entry of entries) {
    if (entry.sessionId !== sessionId) continue;
    for (const ocorrencia of ocorrenciasDoLancamento(entry)) {
      if (ocorrencia.status === "pending" || ocorrencia.status === "completed") soma += valorDaOcorrencia(ocorrencia);
    }
  }
  return Math.max(-soma, 0);
}
