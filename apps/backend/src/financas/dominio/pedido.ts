import {
  REGRA_SEM_AJUSTE,
  ajustarTransacao,
  normalizarRegra,
  centavosComSinal,
  tipoDaCategoria,
  type CategoriaTransacao,
  type Lancamento,
  type ModoTransacao,
  type PrioridadeTransacao,
  type Recorrencia,
  type RegraDeVencimento,
  type StatusTransacao,
  type TipoTransacao,
} from "@finnagent/contracts";
import type { NovoLancamento } from "../portas/financas-repositorio.js";
import { dataValida, partesDaData } from "./transacao.js";
import { centavosDoContrato, regraDaCategoria } from "./vista.js";

export type PedidoLancamento = {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  justification: string;
  date: string;
  mode: ModoTransacao;
  status: StatusTransacao;
  transactionType: TipoTransacao;
  category: CategoriaTransacao;
  priority: PrioridadeTransacao;
  cents: number;
  installments: number | null;
  installmentNumber: number | null;
  dueDate: string | null;
  interestRate: number | null;
  nextDueDate: string | null;
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
  /** null: use o padrão da categoria nas configurações (o serviço resolve antes de validar). */
  dueRule: RegraDeVencimento | null;
  /** Ausente: na edição, a cobertura gravada permanece. */
  coveredById?: string | null;
  accountId?: string | null;
  transfer?: boolean;
  /** Os dois lados de uma transferência dividem este id. */
  pairId?: string | null;
  /** A sobra do mês AAAA-MM levada para o seguinte. Só o sistema manda. */
  carryOf?: string | null;
  /** Empréstimo: de quem é e o total combinado. */
  counterparty?: string;
  principalCents?: number | null;
};

export function normalizarPedido<T extends PedidoLancamento>(pedido: T): T {
  const regra = regraDaCategoria(pedido.category);
  const ajustado = ajustarTransacao(pedido);
  return {
    ...ajustado,
    installments: regra.installments ? pedido.installments : null,
    installmentNumber: regra.installments ? pedido.installmentNumber : null,
    dueDate: regra.loan ? pedido.dueDate : null,
    interestRate: regra.loan ? pedido.interestRate : null,
    nextDueDate: regra.recurrence ? pedido.nextDueDate : null,
    recurrence: regra.recurrence ? pedido.recurrence : null,
    recurrenceInterval: regra.recurrence ? pedido.recurrenceInterval : null,
    counterparty: regra.loan ? (pedido.counterparty ?? "").trim() : "",
    principalCents: regra.loan ? (pedido.principalCents ?? null) : null,
    dueRule: normalizarRegra(
      ajustado.category,
      regra.recurrence ? pedido.recurrence : null,
      pedido.dueRule ?? REGRA_SEM_AJUSTE,
    ),
  };
}

export function erroDoPedido(pedido: PedidoLancamento) {
  if (pedido.cents === 0) return "Informe o valor.";
  if (!dataValida(pedido.date)) return "Informe uma data válida.";
  const regra = regraDaCategoria(pedido.category);
  if (regra.installments) {
    if (pedido.installments == null) return "Informe as parcelas.";
    if (pedido.installmentNumber == null || pedido.installmentNumber > pedido.installments) {
      return "Informe a parcela atual.";
    }
  }
  if (regra.loan) {
    // O empréstimo é um contrato: quem, quanto ao todo e a parcela combinada. Vencimento e juros são opcionais.
    if (!pedido.counterparty?.trim()) return "Informe de quem é o empréstimo.";
    if (pedido.principalCents == null || pedido.principalCents <= 0) return "Informe o total combinado do empréstimo.";
    if (pedido.dueDate != null && !dataValida(pedido.dueDate)) return "Informe uma data válida.";
  }
  if (regra.recurrence) {
    if (pedido.nextDueDate == null || !dataValida(pedido.nextDueDate)) {
      return "Informe o próximo vencimento.";
    }
    if (pedido.recurrence == null || pedido.recurrenceInterval == null) {
      return "Informe a recorrência.";
    }
  }
  return null;
}

export function pedidoDaEdicao(
  atual: Lancamento,
  pedido: PedidoLancamento,
  travado: boolean,
): PedidoLancamento {
  const base = {
    ...pedido,
    dueRule: pedido.dueRule ?? atual.dueRule ?? REGRA_SEM_AJUSTE,
    category: atual.category,
    mode: atual.mode,
    transactionType: atual.transactionType,
    status: atual.status,
    installmentNumber: atual.installmentNumber,
    nextDueDate: atual.nextDueDate,
  };
  if (!travado) return base;
  return {
    ...base,
    date: atual.date,
    cents: centavosDoContrato(atual),
    installments: atual.installments,
    dueDate: atual.dueDate,
    interestRate: atual.interestRate,
    recurrence: atual.recurrence,
    recurrenceInterval: atual.recurrenceInterval,
  };
}

export function novoLancamento(pedido: PedidoLancamento): NovoLancamento {
  const partes = partesDaData(pedido.date);
  return {
    ...pedido,
    cents: centavosComSinal(pedido.cents, pedido.mode),
    dueRule: pedido.dueRule ?? REGRA_SEM_AJUSTE,
    type: tipoDaCategoria(pedido.category),
    day: partes.day,
    startYear: partes.year,
    startMonth: partes.month,
  };
}
