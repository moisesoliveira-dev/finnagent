import { describe, expect, it } from "vitest";
import { fraseDoPlanoDeParcelas, parcelaDaDescricao, planoDoPagamentoDeParcelas } from "@finnagent/contracts";

describe("parcela escrita na descrição do extrato", () => {
  it.each([
    ["Magalu - Parcela 3/10", 3, 10],
    ["MERCADOLIVRE*PARC 03/12", 3, 12],
    ["Compra no crédito - parcela 2 de 6", 2, 6],
    ["LOJA X PARCELA Nº 4/8", 4, 8],
    ["AMERICANAS 07/24", 7, 24],
    ["Parc. 5 de 12 Netshoes", 5, 12],
  ])("lê %s", (descricao, numero, total) => {
    expect(parcelaDaDescricao(descricao)).toEqual({ numero, total });
  });

  it("lê só o número ou só o total quando o banco escreve só um deles", () => {
    expect(parcelaDaDescricao("Seguro Parc 3")).toEqual({ numero: 3, total: null });
    expect(parcelaDaDescricao("Notebook em 10x")).toEqual({ numero: null, total: 10 });
  });

  it("não confunde data, valor ou texto comum com parcela", () => {
    expect(parcelaDaDescricao("Compra no débito via NuPay — Uber")).toBeNull();
    expect(parcelaDaDescricao("Pix recebido 03/11")).toBeNull();
    expect(parcelaDaDescricao("Boleto vencimento 15/11/2026")).toBeNull();
    expect(parcelaDaDescricao("Parcelamento da fatura")).toBeNull();
    expect(parcelaDaDescricao("Mercado 1x")).toBeNull();
    // Número maior que o total não é parcela.
    expect(parcelaDaDescricao("Loja parcela 12/10")).toBeNull();
  });
});

describe("a frase diz quais parcelas a linha paga", () => {
  const formatar = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
  const plano = (pago: number) => planoDoPagamentoDeParcelas([10_000, 10_000, 10_000], pago);

  it("uma, duas ou várias, com o número a partir da próxima do contrato", () => {
    expect(fraseDoPlanoDeParcelas(plano(10_000), formatar, { numero: 3, total: 10 })).toBe("Paga a parcela 3 de 10.");
    expect(fraseDoPlanoDeParcelas(plano(20_000), formatar, { numero: 3, total: 10 })).toBe("Paga as parcelas 3 e 4 de 10 (R$ 100.00 + R$ 100.00).");
    expect(fraseDoPlanoDeParcelas(plano(30_000), formatar, { numero: 3, total: null })).toBe("Paga as parcelas 3 a 5 (R$ 100.00 + R$ 100.00 + R$ 100.00).");
    expect(fraseDoPlanoDeParcelas(plano(12_500), formatar, { numero: 1, total: 4 })).toBe("Paga a parcela 1 de 4, e sobram R$ 25.00.");
  });
});
