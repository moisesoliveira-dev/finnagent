import { movimentosDoMes, type MovimentoDaConta } from "@finnagent/contracts";

export type Movimento = MovimentoDaConta;

export function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** Os movimentos do mês vêm do contrato, os mesmos do web. */
export { movimentosDoMes };
