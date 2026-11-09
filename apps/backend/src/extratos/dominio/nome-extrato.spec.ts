import { describe, expect, it } from "vitest";
import { chaveDoNome, descricoesParecidas } from "./nome-extrato.js";

describe("chave do nome do extrato", () => {
  it("ignora caixa e espaços repetidos", () => {
    expect(chaveDoNome("  Padaria   do  Centro ")).toBe("padaria do centro");
  });

  it("fica vazia quando a descrição não tem nome", () => {
    expect(chaveDoNome("   ")).toBe("");
    expect(chaveDoNome(" — ")).toBe("");
  });

  it("é a mesma compra com hífen, travessão, acento ou pontuação diferentes", () => {
    const agosto = chaveDoNome("Compra no débito via NuPay - Uber");
    expect(agosto).toBe("compra no debito via nupay uber");
    expect(chaveDoNome("Compra no débito via NuPay — Uber")).toBe(agosto);
    expect(chaveDoNome("COMPRA NO DEBITO VIA NUPAY – UBER")).toBe(agosto);
    expect(chaveDoNome("Compra no débito - DL*99 99")).toBe("compra no debito dl 99 99");
    // O estorno continua sendo outra coisa.
    expect(chaveDoNome("Estorno - Compra no débito via NuPay — Uber")).not.toBe(agosto);
  });
});

describe("descrições do mesmo destino", () => {
  it("reconhece o mesmo destino com CNPJ, banco e conta num mês e sem eles no outro", () => {
    const curta = "Transferência enviada pelo Pix - NOVA IGREJA BATISTA";
    const longa = "Transferência enviada pelo Pix — NOVA IGREJA BATISTA - 63.691.281/0001-96 - BCO BRADESCO S.A. (0237) Agência: 2396 Conta: 22920-2";
    expect(descricoesParecidas(curta, longa)).toBe(true);
    expect(descricoesParecidas(longa, curta)).toBe(true);
  });

  it("não junta destinos diferentes nem descrições só com palavras genéricas", () => {
    expect(descricoesParecidas("Pix - Nova Igreja Batista", "Pix - Igreja Universal")).toBe(false);
    expect(descricoesParecidas("Compra no débito via NuPay - Uber", "Compra no débito via NuPay - 99Food")).toBe(false);
    expect(descricoesParecidas("Compra no débito", "Compra no débito via NuPay - Uber")).toBe(false);
    expect(descricoesParecidas("Compra no débito", "COMPRA NO DEBITO")).toBe(true);
  });
});
