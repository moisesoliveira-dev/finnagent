import { describe, expect, it } from "vitest";
import { dataCurta, rotuloDoMes, somarMes } from "./formato";

describe("formato", () => {
  it("vira o ano ao somar meses", () => {
    expect(somarMes({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMes({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(somarMes({ ano: 2026, mes: 5 }, -17)).toEqual({ ano: 2024, mes: 12 });
  });

  it("escreve mês e data em português", () => {
    expect(rotuloDoMes({ ano: 2026, mes: 3 })).toBe("março de 2026");
    expect(dataCurta("2026-11-30")).toBe("seg 30/nov");
  });
});
