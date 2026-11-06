import { describe, expect, it } from "vitest";
import type { Conta, Lancamento, Ocorrencia } from "@finnagent/contracts";
import { movimentosDoMes } from "./movimentos";

const conta: Conta = { id: "c1", name: "Banco", kind: "conta", openingCents: 10000 };

const ocorrencia = (number: number, dueDate: string, cents: number, status: Ocorrencia["status"], paidOn: string | null = null): Ocorrencia => ({
  number,
  dueDate,
  plannedCents: cents,
  paidCents: status === "completed" ? cents : null,
  paidOn,
  status,
});

/** Só o que `movimentosDoMes` lê: com `occurrences` preenchido, o contrato não monta a grade. */
const lancamento = (id: string, accountId: string | null, occurrences: Ocorrencia[]): Lancamento =>
  ({ id, accountId, name: id, description: "", groupName: "Casa", sessionName: "Contas", occurrences }) as unknown as Lancamento;

describe("movimentosDoMes", () => {
  it("corre o saldo do mês a partir do que já foi pago antes dele", () => {
    const entries = [
      lancamento("Salário", "c1", [ocorrencia(1, "2026-10-05", 500000, "completed", "2026-10-05"), ocorrencia(2, "2026-11-05", 500000, "completed", "2026-11-05")]),
      lancamento("Luz", "c1", [ocorrencia(1, "2026-10-20", -12000, "pending"), ocorrencia(2, "2026-11-20", -12000, "pending")]),
      lancamento("Outra conta", "c2", [ocorrencia(1, "2026-11-01", -99999, "completed", "2026-11-01")]),
      lancamento("Cancelada", "c1", [ocorrencia(1, "2026-11-02", -500, "cancelled")]),
    ];
    const { saldoInicial, movimentos, saldoFinal } = movimentosDoMes(conta, entries, 2026, 11);
    // O pendente de outubro não entra no saldo inicial; o pago entra.
    expect(saldoInicial).toBe(510000);
    expect(movimentos.map((item) => [item.descricao, item.cents, item.pendente, item.saldo])).toEqual([
      ["Salário", 500000, false, 1010000],
      ["Luz", -12000, true, 998000],
    ]);
    expect(saldoFinal).toBe(998000);
  });

  it("usa a data do pagamento quando a ocorrência foi paga em outro mês", () => {
    const entries = [lancamento("Internet", "c1", [ocorrencia(1, "2026-10-30", -9900, "completed", "2026-11-02")])];
    const { saldoInicial, movimentos } = movimentosDoMes(conta, entries, 2026, 11);
    expect(saldoInicial).toBe(10000);
    expect(movimentos).toHaveLength(1);
    expect(movimentos[0]?.date).toBe("2026-11-02");
  });
});
