export function chaveDoNome(description: string) {
  return description.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").slice(0, 160);
}

const TRANSFERENCIA = /\b(transfer[eê]ncia|transf\.?|pix|ted|doc)\b/i;
// Empresa: CNPJ (com ou sem máscara) ou sufixo societário. Pessoa aparece com CPF mascarado ou sem documento.
const EMPRESA = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\b(ltda|s\/?a|eireli|mei|me|epp|cia|comercio|com[eé]rcio|servi[cç]os?|restaurante|padaria|mercado|supermercado|farm[aá]cia|loja|posto)\b/i;

/**
 * Transferência (Pix, TED, DOC) para ou de uma pessoa. O motivo muda a cada uma, então o nome não vale como pista:
 * a Conferência não lembra a sessão dessas linhas. Com CNPJ ou nome de empresa, é compra, e o nome continua valendo.
 */
export function ehTransferenciaDePessoa(description: string) {
  return TRANSFERENCIA.test(description) && !EMPRESA.test(description);
}
