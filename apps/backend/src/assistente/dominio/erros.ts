export class AssistenteIndisponivel extends Error {
  constructor(mensagem?: string) {
    super(mensagem?.trim() || "O assistente não está disponível agora. Tente de novo em instantes.");
  }
}

export const MENSAGEM_DA_QUEDA =
  "A conexão com o serviço de IA caiu no meio da resposta. Pode ter sido uma atualização do sistema. Tente de novo.";

/** Não foi possível falar com o agents (parado, reiniciando). Tentar de novo costuma resolver. */
export class SemConexaoComOAgents extends AssistenteIndisponivel {}

/** A conexão com o agents caiu enquanto ele respondia. */
export class ConexaoComOAgentsCaiu extends AssistenteIndisponivel {
  constructor() {
    super(MENSAGEM_DA_QUEDA);
  }
}

export class SemModelo extends Error {
  constructor() {
    super("Configure um provedor e um modelo em Configurações, Inteligência artificial.");
  }
}
