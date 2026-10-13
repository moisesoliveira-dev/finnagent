import { describe, expect, it } from "vitest";
import { ehOcr } from "./formato-ocr.js";
import { leituraDasLinhas } from "./leitura-ocr.js";

describe("leitura ocr", () => {
  it("reconhece foto e pdf", () => {
    expect(ehOcr("extrato.PNG")).toBe(true);
    expect(ehOcr("conta.pdf")).toBe(true);
    expect(ehOcr("banco.csv")).toBe(false);
  });

  it("monta o período a partir das linhas", () => {
    const leitura = leituraDasLinhas([
      { line: 1, date: "2026-03-10", description: "Aluguel", cents: -100, error: "" },
      { line: 2, date: "2026-03-02", description: "Mercado", cents: -50, error: "" },
    ]);
    expect(leitura.status).toBe("importado");
    expect(leitura.startDate).toBe("2026-03-02");
    expect(leitura.endDate).toBe("2026-03-10");
  });
});
