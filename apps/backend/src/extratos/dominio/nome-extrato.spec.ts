import { describe, expect, it } from "vitest";
import { chaveDoNome } from "./nome-extrato.js";

describe("chave do nome do extrato", () => {
  it("ignora caixa e espaços repetidos", () => {
    expect(chaveDoNome("  Padaria   do  Centro ")).toBe("padaria do centro");
  });

  it("fica vazia quando a descrição não tem nome", () => {
    expect(chaveDoNome("   ")).toBe("");
  });
});
