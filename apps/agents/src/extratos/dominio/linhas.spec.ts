import { describe, expect, it } from "vitest";
import { normalizarLinhas, tipoPermitido } from "./linhas.js";

describe("linhas do extrato", () => {
  it("numera e marca o que não dá para usar", () => {
    const linhas = normalizarLinhas([
      { date: "2026-03-02", description: "Mercado", cents: -1590 },
      { date: "32-13-01", description: "", cents: 1.5 },
    ]);
    expect(linhas[0]).toEqual({
      line: 1,
      date: "2026-03-02",
      description: "Mercado",
      cents: -1590,
      error: "",
    });
    expect(linhas[1]?.error).toContain("Descrição ausente.");
    expect(linhas[1]?.date).toBeNull();
    expect(linhas[1]?.cents).toBeNull();
  });

  it("aceita imagem e pdf", () => {
    expect(tipoPermitido("image/png")).toBe(true);
    expect(tipoPermitido("application/pdf")).toBe(true);
    expect(tipoPermitido("text/csv")).toBe(false);
  });
});
