/** O conteúdo do arquivo em base64, como o BFF espera. Lê em pedaços para não estourar a pilha com arquivos grandes. */
export async function base64DoArquivo(arquivo: File) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let binario = "";
  for (let indice = 0; indice < bytes.length; indice += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(indice, indice + 0x8000));
  }
  return btoa(binario);
}

/** "2026-10-30" em "30/10/2026". */
export function diaCompleto(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "2026-10-30" em "30/10". */
export function diaEMes(iso: string) {
  return diaCompleto(iso).slice(0, 5);
}
