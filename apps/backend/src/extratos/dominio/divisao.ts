const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const PARTES_MINIMAS = 2;
export const PARTES_MAXIMAS = 10;

/**
 * Confere a divisão de uma linha do extrato: de 2 a 10 partes, nenhuma zerada, todas no mesmo sentido da linha
 * (saída ou entrada) e somando exatamente o valor dela. Devolve o motivo da recusa, ou null.
 */
export function erroDaDivisao(total: number, partes: number[]) {
  if (partes.length < PARTES_MINIMAS || partes.length > PARTES_MAXIMAS) {
    return `Divida a linha em ${PARTES_MINIMAS} a ${PARTES_MAXIMAS} partes.`;
  }
  if (partes.some((parte) => !Number.isInteger(parte) || parte === 0)) return "Toda parte precisa de um valor.";
  if (partes.some((parte) => Math.sign(parte) !== Math.sign(total))) {
    return total < 0 ? "Numa saída, toda parte é saída." : "Numa entrada, toda parte é entrada.";
  }
  const soma = partes.reduce((acumulado, parte) => acumulado + parte, 0);
  if (soma === total) return null;
  const diferenca = Math.abs(total) - Math.abs(soma);
  const quanto = reais.format(Math.abs(diferenca) / 100);
  return `As partes somam ${reais.format(Math.abs(soma) / 100)} e a linha é ${reais.format(Math.abs(total) / 100)}: ${diferenca > 0 ? `faltam ${quanto}` : `sobram ${quanto}`}.`;
}

/** O nome do lançamento da linha: o que a pessoa escolheu, ou a descrição do extrato. */
export function nomeDaLinha(nome: string | undefined, descricao: string) {
  return (nome?.trim() || descricao.trim() || "Extrato").slice(0, 160);
}
