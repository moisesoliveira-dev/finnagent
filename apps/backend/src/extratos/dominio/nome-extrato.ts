/**
 * A chave que a Conferência usa para lembrar a sessão e o nome de uma linha em qualquer mês. Fica só com letras sem
 * acento e números: o mesmo banco escreve "NuPay - Uber" num mês e "NuPay — Uber" no outro (a leitura do PDF troca
 * hífen por travessão), e a pontuação não pode separar o que é a mesma compra. A migração
 * 20261109120000_chave_do_nome_sem_pontuacao refaz as chaves gravadas com esta mesma regra.
 */
export function chaveDoNome(description: string) {
  return description
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 160)
    .trim();
}

// As palavras que todo extrato repete e não dizem quem recebeu: o tipo do movimento, o meio e o banco.
const GENERICAS = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "por", "pelo", "pela", "para", "via", "com",
  "compra", "debito", "credito", "pagamento", "pagto", "pgto", "transferencia", "transf", "enviada", "enviado", "recebida", "recebido",
  "pix", "ted", "doc", "boleto", "cartao", "nupay", "mp", "pag", "parcela", "parc", "agencia", "ag", "conta", "cc", "bco", "banco", "s", "sa", "ltda", "me",
]);

/** As palavras que identificam o destino: sem as genéricas, sem números soltos e sem letra sozinha. */
export function palavrasDoDestino(description: string) {
  return new Set(
    chaveDoNome(description)
      .split(" ")
      .filter((palavra) => palavra.length > 1 && !/^\d+$/.test(palavra) && !GENERICAS.has(palavra)),
  );
}

/**
 * Duas descrições do mesmo destino, mesmo escritas de jeitos diferentes: a chave é igual, ou todas as palavras do
 * destino da mais curta estão na mais longa. "Pix - Nova Igreja Batista" e "Pix — NOVA IGREJA BATISTA - CNPJ -
 * banco - conta" são o mesmo destino. Uma descrição sem palavra de destino só vale pela chave igual.
 */
export function descricoesParecidas(a: string, b: string) {
  const chaveA = chaveDoNome(a);
  const chaveB = chaveDoNome(b);
  if (!chaveA || !chaveB) return false;
  if (chaveA === chaveB) return true;
  const palavrasA = palavrasDoDestino(a);
  const palavrasB = palavrasDoDestino(b);
  const [curta, longa] = palavrasA.size <= palavrasB.size ? [palavrasA, palavrasB] : [palavrasB, palavrasA];
  if (curta.size === 0) return false;
  return [...curta].every((palavra) => longa.has(palavra));
}

/** Quantas palavras de destino as duas têm em comum: desempata quando mais de uma lembrança combina. */
export function palavrasEmComum(a: string, b: string) {
  const palavrasB = palavrasDoDestino(b);
  return [...palavrasDoDestino(a)].filter((palavra) => palavrasB.has(palavra)).length;
}
