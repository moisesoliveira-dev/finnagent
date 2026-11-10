import { describe, expect, it } from "vitest";
import { centavosDe, dataCurta, paraCampo, rotuloDoMes, somarMes } from "./formato";

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

  it("lê reais digitados de vários jeitos", () => {
    expect(centavosDe("1.234,56")).toBe(123456);
    expect(centavosDe("1234.56")).toBe(123456);
    expect(centavosDe("1.234")).toBe(123400);
    expect(centavosDe("-50")).toBe(5000);
    expect(centavosDe("R$ 12,5")).toBe(1250);
    expect(centavosDe("")).toBeNull();
    expect(centavosDe("abc")).toBeNull();
    expect(paraCampo(-123456)).toBe("1234,56");
  });
});
