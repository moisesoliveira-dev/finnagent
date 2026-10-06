export function reaisParaCentavos(texto: string) {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const negativo = limpo.startsWith("-") || limpo.startsWith("−");
  let corpo = limpo.replace(/^[-−]/, "");
  if (corpo.includes(",")) corpo = corpo.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(corpo)) corpo = corpo.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(corpo)) return null;
  const [inteiro, frac = ""] = corpo.split(".");
  const cents = Number(inteiro) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) return null;
  const valor = negativo ? -cents : cents;
  if (valor === 0) return null;
  return valor;
}

export function doisDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}
