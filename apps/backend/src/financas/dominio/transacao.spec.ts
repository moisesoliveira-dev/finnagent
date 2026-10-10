import { ajustarTransacao, vezesDaRecorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { adiantarParcela, dataDaTransacao, percentualDeJuros } from "./transacao.js";

describe("transação", () => {
  it("monta a data do mês sem estourar o dia", () => {
    expect(dataDaTransacao(2026, 2, 31)).toBe("2026-02-28");
    expect(dataDaTransacao(2026, 10, 9)).toBe("2026-10-09");
  });

  it("adianta a parcela e conclui na última", () => {
    expect(adiantarParcela(1, 3, "pending")).toEqual({
      installmentNumber: 2,
      status: "pending",
    });
    expect(adiantarParcela(2, 3, "pending")).toEqual({
      installmentNumber: 3,
      status: "completed",
    });
  });

  it("não adianta transação cancelada nem parcela já concluída", () => {
    expect(adiantarParcela(1, 3, "cancelled")).toBe("encerrada");
    expect(adiantarParcela(3, 3, "completed")).toBe("concluida");
  });

  it("guarda juros em centésimos de ponto", () => {
    expect(percentualDeJuros(250)).toBe(2.5);
  });

  it("deixa a extra só como entrada e a parcela com prioridade", () => {
    expect(
      ajustarTransacao({
        category: "fixed",
        mode: "inflows",
        priority: "high",
        transactionType: "unusual",
      }),
    ).toMatchObject({ mode: "inflows", priority: "nopriority", transactionType: "appointment" });
    expect(
      ajustarTransacao({
        category: "installment",
        mode: "inflows",
        priority: "high",
        transactionType: "unusual",
      }),
    ).toMatchObject({ mode: "outflows", priority: "high", transactionType: "appointment" });
    expect(
      ajustarTransacao({
        category: "additional",
        mode: "outflows",
        priority: "low",
        transactionType: "unusual",
      }),
    ).toMatchObject({ mode: "inflows", priority: "nopriority", transactionType: "unusual" });
  });

  it("repete a fixa conforme a recorrência", () => {
    expect(vezesDaRecorrencia("quarterly", 1, 2026, 3, 1, 2026, 2)).toBe(1);
    expect(vezesDaRecorrencia("quarterly", 1, 2026, 3, 1, 2026, 3)).toBe(0);
    expect(vezesDaRecorrencia("quarterly", 1, 2026, 3, 1, 2026, 5)).toBe(1);
    expect(vezesDaRecorrencia("weekly", 1, 2026, 3, 1, 2026, 2)).toBe(5);
    expect(vezesDaRecorrencia("annual", 1, 2026, 3, 1, 2027, 2)).toBe(1);
    expect(vezesDaRecorrencia("customize", 10, 2026, 3, 1, 2026, 2)).toBe(4);
  });

  it("mantém a prioridade da saída que não é parcela nem extra", () => {
    expect(
      ajustarTransacao({
        category: "loan",
        mode: "outflows",
        priority: "high",
        transactionType: "unusual",
      }),
    ).toMatchObject({ mode: "outflows", priority: "high", transactionType: "appointment" });
    expect(
      ajustarTransacao({
        category: "unique",
        mode: "outflows",
        priority: "low",
        transactionType: "unusual",
      }),
    ).toMatchObject({ priority: "low", transactionType: "unusual" });
  });
});
