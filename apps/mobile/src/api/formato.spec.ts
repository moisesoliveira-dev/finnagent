import { lerReais } from "@finnagent/contracts";
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

describe("lerReais, a leitura de reais da web e do celular", () => {
  it("lê o mesmo valor, qualquer que seja o jeito de digitar", () => {
    for (const texto of ["1.234,56", "1234,56", "1234.56", "R$ 1.234,56"]) expect(lerReais(texto)).toBe(123456);
    expect(lerReais("12.5")).toBe(1250);
    expect(lerReais("12,5")).toBe(1250);
    expect(lerReais("1.234")).toBe(123400);
    expect(lerReais("1.000")).toBe(100000);
    expect(lerReais("0,05")).toBe(5);
  });

  it("guarda o sinal e não inventa menos zero", () => {
    expect(lerReais("-50")).toBe(-5000);
    expect(lerReais("−50,25")).toBe(-5025);
    expect(lerReais("-0")).toBe(0);
    expect(Object.is(lerReais("-0,00"), 0)).toBe(true);
    expect(lerReais("0")).toBe(0);
  });

  it("recusa o que não é valor, mais de duas casas e o que o banco não guarda", () => {
    for (const texto of ["", "   ", "abc", "1,234", "12,5,3", "1e5", "21.474.836,48"]) expect(lerReais(texto)).toBeNull();
    expect(lerReais("21.474.836,47")).toBe(2147483647);
  });

  it("o celular lê sem o sinal, como sempre leu", () => {
    expect(centavosDe("-50")).toBe(5000);
    expect(centavosDe("12.5")).toBe(1250);
  });
});

