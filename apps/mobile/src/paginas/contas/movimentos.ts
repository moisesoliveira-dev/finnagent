import { dataContabil, ocorrenciasDoLancamento, type Conta, type Lancamento } from "@finnagent/contracts";

export type Movimento = {
  chave: string;
  date: string;
  descricao: string;
  detalhe: string;
  cents: number;
  pendente: boolean;
  /** O saldo da conta depois deste movimento. O pendente é previsão. */
  saldo: number;
};

export function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** Os movimentos de uma conta num mês, pela data em que contam, com o saldo correndo a partir do início do mês. Igual ao web. */
export function movimentosDoMes(conta: Conta, entries: Lancamento[], ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const chave = inicio.slice(0, 7);
  let saldoInicial = conta.openingCents;
  const doMes: Omit<Movimento, "saldo">[] = [];
  for (const entry of entries) {
    if (entry.accountId !== conta.id) continue;
    for (const item of ocorrenciasDoLancamento(entry)) {
      if (item.status !== "pending" && item.status !== "completed") continue;
      const data = dataContabil(item);
      const cents = item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
      if (data < inicio) {
        if (item.status === "completed") saldoInicial += cents;
        continue;
      }
      if (!data.startsWith(chave)) continue;
      doMes.push({
        chave: `${entry.id}:${item.number}`,
        date: data,
        descricao: entry.name || entry.description,
        detalhe: [item.kind === "multa" ? "Multa e juros" : "", `${entry.groupName} › ${entry.sessionName}`].filter(Boolean).join(" · "),
        cents,
        pendente: item.status === "pending",
      });
    }
  }
  doMes.sort((a, b) => a.date.localeCompare(b.date) || a.descricao.localeCompare(b.descricao, "pt-BR"));
  let saldo = saldoInicial;
  const movimentos: Movimento[] = doMes.map((item) => {
    saldo += item.cents;
    return { ...item, saldo };
  });
  return { saldoInicial, movimentos, saldoFinal: saldo };
}
