import { describe, expect, it } from "vitest";
import { PedidoInvalido } from "../dominio/erros.js";
import { criarGrafo } from "./grafo.js";

const pedido = {
  tenantId: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01",
  filename: "extrato.pdf",
  mediaType: "application/pdf",
  content: "JVBERi0=",
};

function grafoCom(resposta: { linhas: unknown[]; cortada: boolean }) {
  const leitor = { ler: async () => "texto do extrato" };
  return criarGrafo(leitor, { organizarTexto: async () => resposta });
}

describe("leitura do extrato pela IA", () => {
  it("resposta cortada guarda as linhas que chegaram e marca onde parou", async () => {
    const linhas = await grafoCom({ linhas: [{ date: "2026-10-01", description: "Mercado", cents: -1000 }], cortada: true }).organizar(pedido);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ line: 1, description: "Mercado", error: "" });
    expect(linhas[1]).toMatchObject({ line: 2, cents: null });
    expect(linhas[1]?.error).toContain("foi cortada aqui");
  });

  it("resposta cortada sem nenhuma linha inteira diz para dividir o arquivo", async () => {
    await expect(grafoCom({ linhas: [], cortada: true }).organizar(pedido)).rejects.toBeInstanceOf(PedidoInvalido);
  });

  it("resposta inteira segue como antes", async () => {
    const linhas = await grafoCom({ linhas: [{ date: "2026-10-01", description: "Mercado", cents: -1000 }], cortada: false }).organizar(pedido);
    expect(linhas).toEqual([{ line: 1, date: "2026-10-01", description: "Mercado", cents: -1000, error: "" }]);
  });
});
