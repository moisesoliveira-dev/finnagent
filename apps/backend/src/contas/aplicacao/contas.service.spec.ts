import { describe, expect, it } from "vitest";
import { evolucaoDoPatrimonio, faturasDoCartao, fechamentoDoCiclo, limiteDoCartao, movimentosDoMes, patrimonio, resumoDaCaixinha, resumoDaConta, vencimentoDaFatura, type Conta, type Lancamento } from "@finnagent/contracts";
import { EXEMPLO } from "../../financas/dominio/exemplo.js";
import { ContasService } from "./contas.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";
const cartao: Conta = { id: "k1", name: "Cartão", kind: "cartao", openingCents: 0, openingOn: null, closingDay: null, dueDay: null, limitCents: null };
const banco: Conta = { id: "c1", name: "Banco", kind: "conta", openingCents: 100_000, openingOn: null, closingDay: null, dueDay: null, limitCents: null };

function lancamento(parcial: Partial<Lancamento>): Lancamento {
  return { ...EXEMPLO[0]!, id: crypto.randomUUID(), accountId: banco.id, ...parcial };
}

describe("saldo da conta", () => {
  it("soma ao saldo inicial o que já foi pago até hoje, e prevê o que ainda vence no mês", () => {
    const entries = [
      lancamento({
        occurrences: [
          { number: 1, dueDate: "2026-11-05", plannedCents: 50_000, paidCents: 50_000, paidOn: "2026-11-05", status: "completed" },
          { number: 2, dueDate: "2026-11-20", plannedCents: -30_000, paidCents: null, paidOn: null, status: "pending" },
          { number: 3, dueDate: "2026-12-05", plannedCents: 50_000, paidCents: null, paidOn: null, status: "pending" },
        ],
      }),
      // De outra conta: não entra.
      lancamento({
        accountId: "outra",
        occurrences: [{ number: 1, dueDate: "2026-11-01", plannedCents: -9_000, paidCents: -9_000, paidOn: "2026-11-01", status: "completed" }],
      }),
    ];
    expect(resumoDaConta(banco, entries, "2026-11-10")).toEqual({ saldoCents: 150_000, previstoCents: 120_000 });
  });

  it("a transferência entre contas muda o saldo das duas, mesmo fora da sobra", () => {
    const entries = [
      lancamento({ transfer: true, occurrences: [{ number: 1, dueDate: "2026-11-02", plannedCents: -20_000, paidCents: -20_000, paidOn: "2026-11-02", status: "completed" }] }),
    ];
    expect(resumoDaConta(banco, entries, "2026-11-10").saldoCents).toBe(80_000);
  });
});

describe("serviço de contas", () => {
  function servico(resposta: unknown) {
    const repo = { listar: async () => [banco], criar: async () => resposta, atualizar: async () => resposta };
    return new ContasService(repo as never, { listar: async () => [] } as never, { hoje: async () => "2026-11-09" } as never, {} as never);
  }

  it("lista as contas", async () => {
    expect(await servico(banco).listar(TENANT)).toEqual({ accounts: [banco], boxes: [] });
  });

  it("recusa nome repetido e conta que não existe, com mensagens", async () => {
    await expect(servico("nome-ocupado").criar(TENANT, "x", { name: "Banco", kind: "conta", openingCents: 0 })).rejects.toThrow("Já existe uma conta");
    await expect(servico("ausente").atualizar(TENANT, "x", { name: "Banco", kind: "conta", openingCents: 0 })).rejects.toThrow("Conta não encontrada");
  });
});

describe("saldo da caixinha", () => {
  const caixinha = { id: "cx", accountId: banco.id, name: "Reserva", openingCents: 10_000, openingOn: null, sessionId: "s-cx", goalId: null };
  const pago = (dia: string, cents: number) => [{ number: 1, dueDate: dia, plannedCents: cents, paidCents: cents, paidOn: dia, status: "completed" as const }];

  it("soma aplicação e rendimento, tira o resgate, e conta o rendimento do mês pedido", () => {
    const entries = [
      lancamento({ sessionId: "s-cx", transfer: true, occurrences: pago("2026-10-03", -30_000) }),
      lancamento({ sessionId: "s-cx", accountId: null, occurrences: pago("2026-10-31", 200) }),
      lancamento({ sessionId: "s-cx", accountId: null, occurrences: pago("2026-11-30", 300) }),
      lancamento({ sessionId: "s-cx", transfer: true, occurrences: pago("2026-11-05", 5_000) }),
      // Outra sessão não entra.
      lancamento({ sessionId: "outra", accountId: null, occurrences: pago("2026-11-01", 9_999) }),
    ];
    expect(resumoDaCaixinha(caixinha, entries, "2026-11-10")).toEqual({ saldoCents: 35_200, rendimentoDoMesCents: 300, rendimentoTotalCents: 200 });
    expect(resumoDaCaixinha(caixinha, entries, "2026-11-10", "2026-10").rendimentoDoMesCents).toBe(200);
  });
});

describe("saldo inicial com data", () => {
  const comData: Conta = { ...banco, openingOn: "2026-11-01" };
  const pago = (dia: string, cents: number) => [{ number: 1, dueDate: dia, plannedCents: cents, paidCents: cents, paidOn: dia, status: "completed" as const }];
  const entries = [
    // Antes da data: extrato antigo, não dobra o saldo.
    lancamento({ occurrences: pago("2026-10-20", -40_000) }),
    lancamento({ occurrences: pago("2026-11-03", -5_000) }),
  ];

  it("só o que acontece a partir da data conta no saldo; sem data, tudo conta", () => {
    expect(resumoDaConta(comData, entries, "2026-11-10").saldoCents).toBe(95_000);
    expect(resumoDaConta(banco, entries, "2026-11-10").saldoCents).toBe(55_000);
  });

  it("o movimento anterior à data aparece na lista do mês marcado e sem mudar o saldo", () => {
    const vista = entries.map((entry) => ({ ...entry, groupName: "Casa", sessionName: "Contas" }));
    const outubro = movimentosDoMes(comData, vista, 2026, 10);
    expect(outubro.movimentos.map((item) => [item.foraDoSaldo, item.saldo])).toEqual([[true, 100_000]]);
    expect(outubro.saldoFinal).toBe(100_000);
    const novembro = movimentosDoMes(comData, vista, 2026, 11);
    expect(novembro.saldoInicial).toBe(100_000);
    expect(novembro.movimentos.map((item) => [item.foraDoSaldo, item.saldo])).toEqual([[false, 95_000]]);
  });

  it("o patrimônio soma contas e caixinhas e desconta o cartão", () => {
    const caixinha = { id: "cx", accountId: banco.id, name: "Reserva", openingCents: 10_000, openingOn: null, sessionId: "s-cx", goalId: null };
    const todos = [...entries, lancamento({ accountId: "k1", occurrences: pago("2026-11-05", -30_000) })];
    expect(patrimonio([comData, cartao], [caixinha], todos, "2026-11-10")).toEqual({ contasCents: 95_000, caixinhasCents: 10_000, cartoesCents: 30_000, totalCents: 75_000 });
    expect(evolucaoDoPatrimonio([comData], [], entries, "2026-11-10", 2).map((mes) => [mes.month, mes.totalCents])).toEqual([
      ["2026-10", 100_000],
      ["2026-11", 95_000],
    ]);
  });
});

describe("faturas do cartão", () => {
  const cartaoComCiclo: Conta = { ...cartao, closingDay: 25, dueDay: 5, limitCents: 100_000 };
  const pago = (dia: string, cents: number) => [{ number: 1, dueDate: dia, plannedCents: cents, paidCents: cents, paidOn: dia, status: "completed" as const }];
  const entries = [
    lancamento({ accountId: "k1", occurrences: pago("2026-09-10", -3_000) }),
    lancamento({ accountId: "k1", occurrences: pago("2026-10-20", -10_000) }),
    lancamento({ accountId: "k1", occurrences: pago("2026-10-28", -5_000) }),
    // O pagamento da fatura de outubro, depois do fechamento.
    lancamento({ accountId: "k1", transfer: true, occurrences: pago("2026-11-03", 10_000) }),
  ];

  it("cada compra entra no ciclo da data dela, o pagamento na última fatura fechada antes dele", () => {
    const faturas = faturasDoCartao(cartaoComCiclo, entries, "2026-11-09", 3);
    expect(faturas.map((f) => [f.month, f.closingDate, f.dueDate, f.totalCents, f.paidCents, f.status])).toEqual([
      ["2026-09", "2026-09-25", "2026-10-05", 3_000, 0, "vencida"],
      ["2026-10", "2026-10-25", "2026-11-05", 10_000, 10_000, "paga"],
      ["2026-11", "2026-11-25", "2026-12-05", 5_000, 0, "aberta"],
    ]);
  });

  it("o limite usa o que o cartão deve hoje", () => {
    expect(limiteDoCartao(cartaoComCiclo, entries, "2026-11-09")).toEqual({ usadoCents: 8_000, disponivelCents: 92_000, percent: 8 });
    expect(faturasDoCartao(cartao, entries, "2026-11-09")).toEqual([]);
  });

  it("vencimento antes do fechamento cai no mês seguinte; depois, no mesmo mês", () => {
    expect(vencimentoDaFatura({ closingDay: 25, dueDay: 5 }, "2026-12-25")).toBe("2027-01-05");
    expect(vencimentoDaFatura({ closingDay: 10, dueDay: 20 }, "2026-12-10")).toBe("2026-12-20");
    expect(fechamentoDoCiclo({ closingDay: 31 }, "2026-02-10")).toBe("2026-02-28");
  });
});
