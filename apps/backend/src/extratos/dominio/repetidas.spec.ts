import { describe, expect, it } from "vitest";
import type { LinhaExtrato } from "@finnagent/contracts";
import { avisoDeRepetidas, descartarRepetidas } from "./repetidas.js";

const linha = (line: number, date: string, cents: number, description: string, error = ""): LinhaExtrato => ({
  line,
  date,
  cents,
  description,
  error,
});

describe("descartarRepetidas", () => {
  it("descarta a linha que já existe em outro extrato da conta", () => {
    const { lines, ignoradas } = descartarRepetidas(
      [linha(1, "2026-01-20", -1000, "Mercado"), linha(2, "2026-01-21", -500, "Padaria")],
      [{ date: "2026-01-20", cents: -1000, description: "  mercado " }],
    );
    expect(lines.map((item) => item.line)).toEqual([2]);
    expect(ignoradas).toBe(1);
  });

  it("mantém compras iguais além das que já estavam gravadas", () => {
    const { lines, ignoradas } = descartarRepetidas(
      [linha(1, "2026-01-20", -1000, "Café"), linha(2, "2026-01-20", -1000, "Café")],
      [{ date: "2026-01-20", cents: -1000, description: "Café" }],
    );
    expect(lines.map((item) => item.line)).toEqual([2]);
    expect(ignoradas).toBe(1);
  });

  it("não mexe em linha com erro", () => {
    const { lines } = descartarRepetidas(
      [linha(1, "2026-01-20", -1000, "Café", "Valor inválido")],
      [{ date: "2026-01-20", cents: -1000, description: "Café" }],
    );
    expect(lines).toHaveLength(1);
  });

  it("avisa no singular e no plural", () => {
    expect(avisoDeRepetidas(0)).toBe("");
    expect(avisoDeRepetidas(1)).toContain("1 linha");
    expect(avisoDeRepetidas(3)).toContain("3 linhas");
  });
});
