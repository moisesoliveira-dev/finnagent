import { lerReais } from "@finnagent/contracts";

const formato = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export { mascaraDeValor, proximaMascara } from "@finnagent/contracts";

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
