import { describe, expect, it } from "vitest";
import { resumoDaConta, type Conta, type Lancamento } from "@finnagent/contracts";
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
    return new ContasService(repo as never);
  }

  it("lista as contas", async () => {
    expect(await servico(banco).listar(TENANT)).toEqual({ accounts: [banco] });
  });

  it("recusa nome repetido e conta que não existe, com mensagens", async () => {
    await expect(servico("nome-ocupado").criar(TENANT, "x", { name: "Banco", kind: "conta", openingCents: 0 })).rejects.toThrow("Já existe uma conta");
    await expect(servico("ausente").atualizar(TENANT, "x", { name: "Banco", kind: "conta", openingCents: 0 })).rejects.toThrow("Conta não encontrada");
  });
});
