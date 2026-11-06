import { describe, expect, it } from "vitest";
import { proximaDaRegra, proximaData } from "./repeticao.js";

describe("a repetição da tarefa", () => {
  it("anda um dia, uma semana ou um mês, e nos dias úteis pula o fim de semana", () => {
    expect(proximaDaRegra("2026-11-06", "daily")).toBe("2026-11-07");
    expect(proximaDaRegra("2026-11-06", "weekly")).toBe("2026-11-13");
    expect(proximaDaRegra("2026-11-06", "monthly")).toBe("2026-12-06");
    // Sexta 6 de novembro de 2026: o próximo dia útil é segunda, 9.
    expect(proximaDaRegra("2026-11-06", "weekdays")).toBe("2026-11-09");
  });

  it("no todo mês, guarda o dia original quando um mês é curto", () => {
    expect(proximaDaRegra("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(proximaDaRegra("2026-02-28", "monthly", 31)).toBe("2026-03-31");
  });

  it("a próxima nasce depois do dia em que foi feita, sem criar as que ficaram para trás", () => {
    // Semanal de segunda (2) feita na quarta (4): volta na segunda seguinte.
    expect(proximaData("2026-11-02", "weekly", "2026-11-04")).toBe("2026-11-09");
    // Feita três semanas depois: só a próxima.
    expect(proximaData("2026-11-02", "weekly", "2026-11-23")).toBe("2026-11-30");
    // Feita no próprio dia: o dia seguinte da regra.
    expect(proximaData("2026-11-06", "daily", "2026-11-06")).toBe("2026-11-07");
    // Feita adiantada: a regra segue do dia original, não do dia feito.
    expect(proximaData("2026-11-10", "monthly", "2026-11-06")).toBe("2026-12-10");
  });
});
