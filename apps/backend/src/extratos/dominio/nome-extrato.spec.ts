import { describe, expect, it } from "vitest";
import { chaveDoNome, ehTransferenciaDePessoa } from "./nome-extrato.js";

describe("chave do nome do extrato", () => {
  it("ignora caixa e espaços repetidos", () => {
    expect(chaveDoNome("  Padaria   do  Centro ")).toBe("padaria do centro");
  });

  it("fica vazia quando a descrição não tem nome", () => {
    expect(chaveDoNome("   ")).toBe("");
  });
});

describe("transferência para pessoa", () => {
  it("reconhece Pix, TED e DOC para pessoa, com CPF mascarado ou sem documento", () => {
    for (const texto of [
      "Transferência enviada pelo Pix - MARIA DA SILVA - •••.123.456-•• - NU PAGAMENTOS",
      "Transferência Recebida - JOAO SOUZA - •••.987.654-••",
      "PIX ENVIADO",
      "TED enviada - Carlos Alberto",
    ]) {
      expect(ehTransferenciaDePessoa(texto), texto).toBe(true);
    }
  });

  it("não vale para empresa, com CNPJ ou nome de empresa, nem para compra", () => {
    for (const texto of [
      "Transferência enviada pelo Pix - PADARIA DO ZE LTDA - 12.345.678/0001-90",
      "Transferência enviada pelo Pix - SUPERMERCADO BOM PRECO",
      "Compra no débito via NuPay - 99",
      "Pagamento de fatura",
    ]) {
      expect(ehTransferenciaDePessoa(texto), texto).toBe(false);
    }
  });
});
