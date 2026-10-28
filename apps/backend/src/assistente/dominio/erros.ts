export class AssistenteIndisponivel extends Error {
  constructor(mensagem?: string) {
    super(mensagem?.trim() || "O assistente não está disponível agora. Tente de novo em instantes.");
  }
}

export class SemModelo extends Error {
  constructor() {
    super("Configure um provedor e um modelo em Configurações, Inteligência artificial.");
  }
}
