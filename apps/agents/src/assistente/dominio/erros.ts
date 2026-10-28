import { INFO_DOS_AGENTES, type AgenteIa } from "@finnagent/contracts";

export class ModeloAusente extends Error {
  constructor(agente: AgenteIa) {
    super(`Escolha um modelo para ${INFO_DOS_AGENTES[agente].nome} em Configurações, Inteligência artificial.`);
  }
}

export class FalhaDoModelo extends Error {}

/** Mensagem segura para mostrar: sem chave, sem token, curta. */
export function mensagemDaFalha(error: unknown) {
  if (error instanceof ModeloAusente || error instanceof FalhaDoModelo) return error.message;
  const texto = error instanceof Error ? error.message : "";
  const limpo = texto
    .replace(/(sk|key|AIza)[-_A-Za-z0-9]{8,}/g, "••••")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  if (/401|unauthori[sz]ed|invalid.*(api|x-api)[ -]?key|incorrect api key|permission/i.test(limpo)) {
    return "O provedor recusou a chave. Confira a chave em Configurações, Inteligência artificial.";
  }
  if (/404|not.?found|does not exist|model_not_found|unknown model/i.test(limpo)) {
    return "O provedor não encontrou o modelo escolhido. Confira o nome do modelo nas configurações.";
  }
  if (/429|rate.?limit|quota|insufficient/i.test(limpo)) {
    return "O provedor limitou o uso agora (cota ou excesso de pedidos). Tente de novo em instantes.";
  }
  if (/tool|function/i.test(limpo) && /support/i.test(limpo)) {
    return "O modelo escolhido não aceita ferramentas. Escolha outro modelo para esse agente nas configurações.";
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|timed? ?out|ETIMEDOUT/i.test(limpo)) {
    return "Não foi possível falar com o provedor de IA. Confira a URL e a conexão.";
  }
  return limpo ? `O assistente falhou: ${limpo}` : "O assistente falhou.";
}
