import { describe, expect, it } from "vitest";
import { resumoDaCaixinha, resumoDaConta, type Conta, type Lancamento } from "@finnagent/contracts";
import { EXEMPLO } from "../../financas/dominio/exemplo.js";
import { ContasService } from "./contas.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";
const banco: Conta = { id: "c1", name: "Banco", kind: "conta", openingCents: 100_000 };

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
    return new ContasService(repo as never, { listar: async () => [] } as never);
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
  const caixinha = { id: "cx", accountId: banco.id, name: "Reserva", openingCents: 10_000, sessionId: "s-cx", goalId: null };
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
