import { describe, expect, it } from "vitest";
import { linhasDaResposta } from "./resposta.js";

describe("resposta do modelo com as linhas do extrato", () => {
  it("lê o JSON inteiro, com ou sem cerca de código", () => {
    expect(linhasDaResposta('```json\n{"linhas":[{"date":"2026-10-01","description":"Mercado","cents":-1000}]}\n```')).toEqual({
      linhas: [{ date: "2026-10-01", description: "Mercado", cents: -1000 }],
      cortada: false,
    });
    expect(linhasDaResposta("Não achei linhas.")).toEqual({ linhas: [], cortada: false });
  });

  it("quando o JSON chega cortado, guarda as linhas inteiras e marca o corte", () => {
    const texto =
      '{"linhas":[{"date":"2026-10-01","description":"Pix {Ana} \\"oi\\"","cents":-1000},{"date":"2026-10-02","description":"Uber","cents":-2350},{"date":"2026-10-0';
    expect(linhasDaResposta(texto)).toEqual({
      linhas: [
        { date: "2026-10-01", description: 'Pix {Ana} "oi"', cents: -1000 },
        { date: "2026-10-02", description: "Uber", cents: -2350 },
      ],
      cortada: true,
    });
  });

  it("cortado antes de qualquer linha inteira não inventa nada", () => {
    expect(linhasDaResposta('{"linhas":[{"date":"2026-10-01","desc')).toEqual({ linhas: [], cortada: true });
  });
});
