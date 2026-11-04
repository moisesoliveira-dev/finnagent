import { describe, expect, it } from "vitest";
import { erroDaDivisao, nomeDaLinha } from "./divisao.js";

describe("divisão da linha do extrato", () => {
  it("aceita partes no mesmo sentido que somam o valor da linha", () => {
    expect(erroDaDivisao(-10000, [-6000, -4000])).toBeNull();
    expect(erroDaDivisao(5000, [2500, 2500])).toBeNull();
  });

  it("diz quanto falta ou sobra", () => {
    expect(erroDaDivisao(-10000, [-6000, -3000])).toContain("faltam R$");
    expect(erroDaDivisao(-10000, [-6000, -5000])).toContain("sobram R$");
  });

  it("recusa parte zerada, no sentido contrário, uma parte só ou mais de 10", () => {
    expect(erroDaDivisao(-10000, [-10000, 0])).toBe("Toda parte precisa de um valor.");
    expect(erroDaDivisao(-10000, [-12000, 2000])).toBe("Numa saída, toda parte é saída.");
    expect(erroDaDivisao(-10000, [-10000])).toContain("2 a 10 partes");
    expect(erroDaDivisao(-1100, Array.from({ length: 11 }, () => -100))).toContain("2 a 10 partes");
  });

  it("o nome é o escolhido, ou a descrição do extrato", () => {
    expect(nomeDaLinha("  Almoço  ", "PIX JOAO")).toBe("Almoço");
    expect(nomeDaLinha(undefined, "PIX JOAO")).toBe("PIX JOAO");
    expect(nomeDaLinha("", "  ")).toBe("Extrato");
  });
});
