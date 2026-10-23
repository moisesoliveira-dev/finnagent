import { describe, expect, it } from "vitest";
import { EXEMPLO } from "./exemplo.js";
import {
  erroDoPedido,
  normalizarPedido,
  novoLancamento,
  pedidoDaEdicao,
  type PedidoLancamento,
} from "./pedido.js";

const notebook = EXEMPLO[6]!;

function pedido(parcial: Partial<PedidoLancamento> = {}): PedidoLancamento {
  return {
    id: notebook.id,
    sessionId: notebook.sessionId,
    name: "Compra",
    description: "",
    justification: "",
    date: "2026-04-10",
    mode: "outflows",
    status: "pending",
    transactionType: "unusual",
    category: "unique",
    priority: "normal",
    cents: 12_000,
    installments: 3,
    installmentNumber: 1,
    dueDate: "2026-05-10",
    interestRate: 2,
    nextDueDate: "2026-05-10",
    recurrence: "monthly",
    recurrenceInterval: 1,
    ...parcial,
  };
}

describe("pedido de lançamento", () => {
  it("descarta os campos que a categoria não usa", () => {
    expect(normalizarPedido(pedido())).toMatchObject({
      installments: null,
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
    });
  });

  it("impõe o modo, o tipo e a prioridade da categoria", () => {
    expect(normalizarPedido(pedido({ category: "additional", mode: "outflows" }))).toMatchObject({
      mode: "inflows",
      priority: "nopriority",
    });
    expect(normalizarPedido(pedido({ category: "installment", mode: "inflows" }))).toMatchObject({
      mode: "outflows",
      transactionType: "appointment",
      installments: 3,
    });
  });

  it("recusa o pedido incompleto para a categoria", () => {
    expect(erroDoPedido(pedido({ cents: 0 }))).toBe("Informe o valor.");
    expect(erroDoPedido(pedido({ date: "2026-02-31" }))).toBe("Informe uma data válida.");
    expect(erroDoPedido(pedido({ category: "installment", installments: null }))).toBe(
      "Informe as parcelas.",
    );
    expect(erroDoPedido(pedido({ category: "installment", installmentNumber: 4 }))).toBe(
      "Informe a parcela atual.",
    );
    expect(erroDoPedido(pedido({ category: "loan", interestRate: null }))).toBe(
      "Informe o vencimento e a taxa de juros.",
    );
    expect(erroDoPedido(pedido({ category: "fixed", nextDueDate: null }))).toBe(
      "Informe o próximo vencimento.",
    );
    expect(erroDoPedido(pedido({ category: "fixed", recurrence: null }))).toBe("Informe a recorrência.");
    expect(erroDoPedido(pedido())).toBeNull();
  });

  it("mantém a identidade gravada na edição", () => {
    const editado = pedidoDaEdicao(notebook, pedido({ category: "unique", cents: 1 }), false);
    expect(editado).toMatchObject({
      category: notebook.category,
      mode: notebook.mode,
      transactionType: notebook.transactionType,
      status: notebook.status,
      installmentNumber: notebook.installmentNumber,
      cents: 1,
    });
  });

  it("mantém data, valor e termos quando os termos estão travados", () => {
    const editado = pedidoDaEdicao(
      notebook,
      pedido({ name: "Notebook novo", date: "2026-09-01", cents: 1, installments: 2 }),
      true,
    );
    expect(editado).toMatchObject({
      name: "Notebook novo",
      date: notebook.date,
      cents: notebook.cents,
      installments: notebook.installments,
    });
  });

  it("aplica o sinal pelo modo e separa a data", () => {
    expect(novoLancamento(pedido())).toMatchObject({
      cents: -12_000,
      day: 10,
      startYear: 2026,
      startMonth: 4,
    });
    expect(novoLancamento(pedido({ mode: "inflows", cents: -500 })).cents).toBe(500);
  });
});
