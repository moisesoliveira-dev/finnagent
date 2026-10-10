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

export function centavosParaReais(cents: number) {
  const absoluto = Math.abs(cents);
  const inteiro = Math.trunc(absoluto / 100);
  const frac = absoluto % 100;
  if (frac === 0) return String(inteiro);
  return `${inteiro},${String(frac).padStart(2, "0")}`;
}

export function doisDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}
