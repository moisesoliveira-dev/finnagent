const formato = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function mascaraDeValor(digitos: string) {
  const so = digitos.replace(/\D/g, "");
  if (!so) return "";
  const limpo = so.replace(/^0+/, "");
  if (!limpo) return formato.format(0);
  const corte = limpo.length > 10 ? limpo.slice(0, 10) : limpo;
  if (Number(corte) > 2_147_483_647) return mascaraDeValor(corte.slice(0, -1));
  return formato.format(Number(corte) / 100);
}

export function proximaMascara(anterior: string, texto: string) {
  const velhos = anterior.replace(/\D/g, "");
  const novos = texto.replace(/\D/g, "");
  const significativos = velhos.replace(/^0+/, "");
  if (novos.length < velhos.length) return mascaraDeValor(significativos.slice(0, -1));
  if (novos.length > velhos.length) return mascaraDeValor(significativos + novos.slice(velhos.length));
  return mascaraDeValor(novos);
}

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
  return formato.format(Math.abs(cents) / 100);
}

export function doisDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}
