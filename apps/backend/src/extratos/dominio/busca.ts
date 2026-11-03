function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/** Os nomes da busca, separados por "|". Termo curto demais (menos de 2 letras) não entra: casaria com tudo. */
export function termosDaBusca(busca: string | undefined) {
  return (busca ?? "")
    .split("|")
    .map(normalizar)
    .filter((termo) => termo.length >= 2)
    .slice(0, 8);
}

/** A descrição casa se tiver qualquer um dos termos. Sem termos, casa com tudo. */
export function casaComABusca(descricao: string, termos: string[]) {
  if (termos.length === 0) return true;
  const alvo = normalizar(descricao);
  return termos.some((termo) => alvo.includes(termo));
}
