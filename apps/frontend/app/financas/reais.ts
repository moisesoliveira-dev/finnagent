import { lerReais } from "@finnagent/contracts";

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

/** O valor digitado em centavos; zero, vazio e o que não é valor são null ("Informe o valor"). A leitura é a do contrato. */
export function reaisParaCentavos(texto: string) {
  const valor = lerReais(texto);
  return valor === 0 ? null : valor;
}

export function centavosParaReais(cents: number) {
  return formato.format(Math.abs(cents) / 100);
}

export function doisDigitos(valor: number) {
  return String(valor).padStart(2, "0");
}

/** Mantém só dígitos, até `maximo` deles. */
export function apenasDigitos(texto: string, maximo = 10) {
  return texto.replace(/\D/g, "").slice(0, maximo);
}

/** Mantém só dígitos e a primeira vírgula, com até duas casas; o ponto digitado vira vírgula. */
export function apenasDecimal(texto: string) {
  const limpo = texto.replace(".", ",").replace(/[^\d,]/g, "");
  const [inteiro, ...resto] = limpo.split(",");
  return resto.length ? `${inteiro},${resto.join("").slice(0, 2)}` : inteiro;
}
