import { createHash } from "node:crypto";

/**
 * O id do pagamento que uma linha do extrato (ou uma parte dela) faz num lançamento. É sempre o mesmo para a mesma
 * linha, então desfazer a linha acha exatamente o que ela pagou, mesmo quando pagou mais de uma parcela.
 */
export function idDoPagamentoDaLinha(statementId: string, line: number, parte?: number) {
  const hex = createHash("sha1").update(`linha:${statementId}:${line}:${parte ?? ""}`).digest("hex").slice(0, 32);
  // Formato de UUID, com a versão 5 e a variante RFC marcadas, para caber onde um id é esperado.
  const versao = `5${hex.slice(13, 16)}`;
  const variante = `${(parseInt(hex.slice(16, 17), 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${versao}-${variante}-${hex.slice(20, 32)}`;
}
