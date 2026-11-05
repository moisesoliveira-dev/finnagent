import { erroDoTipoDaLinha } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

describe("o tipo que uma linha da Conferência pode virar", () => {
  it("única e extra não pedem nada; extra só em entrada, parcela só em saída", () => {
    expect(erroDoTipoDaLinha({ category: "unique" }, -500)).toBeNull();
    expect(erroDoTipoDaLinha({ category: "additional" }, 500)).toBeNull();
    expect(erroDoTipoDaLinha({ category: "additional" }, -500)).toContain("sempre entrada");
    expect(erroDoTipoDaLinha({ category: "installment", installments: 3 }, 500)).toContain("sempre saída");
  });

  it("parcela e empréstimo pedem as parcelas e a atual dentro do total", () => {
    expect(erroDoTipoDaLinha({ category: "installment" }, -500)).toContain("Informe as parcelas");
    expect(erroDoTipoDaLinha({ category: "installment", installments: 361 }, -500)).toContain("Informe as parcelas");
    expect(erroDoTipoDaLinha({ category: "installment", installments: 3, installmentNumber: 4 }, -500)).toContain("parcela atual");
    expect(erroDoTipoDaLinha({ category: "installment", installments: 3, installmentNumber: 3 }, -500)).toBeNull();
    expect(erroDoTipoDaLinha({ category: "loan", installments: 12 }, -500)).toContain("de quem");
    expect(erroDoTipoDaLinha({ category: "loan", counterparty: "Tia Ana" }, -500)).toContain("total");
    expect(erroDoTipoDaLinha({ category: "loan", counterparty: "Tia Ana", principalCents: 400 }, -500)).toContain("menor");
    expect(erroDoTipoDaLinha({ category: "loan", counterparty: "Tia Ana", principalCents: 6_000 }, -500)).toBeNull();
  });

  it("recorrente pede a recorrência e aceita o intervalo padrão", () => {
    expect(erroDoTipoDaLinha({ category: "fixed" }, -500)).toContain("se repete");
    expect(erroDoTipoDaLinha({ category: "fixed", recurrence: "monthly" }, -500)).toBeNull();
    expect(erroDoTipoDaLinha({ category: "fixed", recurrence: "weekly", recurrenceInterval: 0 }, -500)).toContain("intervalo");
  });
});
