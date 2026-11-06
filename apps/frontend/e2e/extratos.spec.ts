import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { esperarCriacao, idDoPedido } from "./apoio";

const fixture = path.join(__dirname, "fixtures", "extrato.csv");

type Extratos = { accounts: { id: string; name: string }[]; statements: { id: string; filename: string }[] };

async function lerExtratos(request: APIRequestContext) {
  return (await (await request.get("/api/extratos")).json()) as Extratos;
}

test.describe("Importações", () => {
  test("importa um CSV numa conta nova, vê as linhas lidas e exclui o extrato", async ({ page, request }) => {
    // Nome de arquivo e de conta únicos: o backend recusa extrato repetido na mesma conta e período.
    const marca = Date.now();
    const nomeArquivo = `e2e-extrato-${marca}.csv`;
    const nomeConta = `E2E conta ${marca}`;
    let id: string | null = null;

    try {
      await page.goto("/extratos");
      await page.getByRole("button", { name: "Importar extrato" }).click();

      const dialogo = page.getByRole("dialog", { name: "Importar extrato" });
      await dialogo
        .getByLabel("Arquivo")
        .setInputFiles({ name: nomeArquivo, mimeType: "text/csv", buffer: readFileSync(fixture) });
      // A prévia vem do backend (CSV lido sem IA): o cabeçalho Data;Descrição;Valor já sugere o mapeamento.
      await expect(dialogo.getByText("Prévia das primeiras linhas")).toBeVisible();
      await expect(dialogo.getByRole("cell", { name: "Padaria E2E" })).toBeVisible();
      await expect(dialogo.getByRole("cell", { name: "Salário E2E" })).toBeVisible();

      await dialogo.getByLabel("Conta", { exact: true }).selectOption({ label: "Nova conta" });
      await dialogo.getByLabel("Nome da conta").fill(nomeConta);

      const criacao = esperarCriacao(page, "extratos");
      await dialogo.getByRole("button", { name: "Importar", exact: true }).click();
      const resposta = await criacao;
      id = idDoPedido(resposta);
      expect(resposta.ok()).toBeTruthy();
      await expect(page.getByText("Extrato importado.")).toBeVisible();

      await page.getByLabel("Buscar").fill(nomeArquivo);
      // Cada extrato é um item da lista animada; a busca pelo nome deixa só este.
      const cartao = page.getByRole("listitem").filter({ hasText: nomeArquivo });
      await expect(cartao).toHaveCount(1);
      await expect(cartao.getByText("2 linhas", { exact: true })).toBeVisible();
      await expect(cartao.getByText("Importado", { exact: true })).toBeVisible();
      await expect(cartao.getByRole("img", { name: "2 linhas lidas sem erro e 0 com erro" })).toBeVisible();

      await cartao.getByRole("button", { name: "Excluir", exact: true }).click();
      const confirmacao = page.getByRole("dialog", { name: "Excluir extrato?" });
      await expect(confirmacao.getByText(nomeArquivo)).toBeVisible();
      await confirmacao.getByRole("button", { name: "Excluir extrato" }).click();
      await expect(page.getByText("Extrato excluído.")).toBeVisible();
      await expect(page.getByText(nomeArquivo)).toHaveCount(0);
    } finally {
      // Se a tela já excluiu, o DELETE devolve 404 e não importa. A conta criada pela importação sai depois do extrato.
      if (id) await request.delete(`/api/extratos/${id}`).catch(() => undefined);
      const atual = await lerExtratos(request).catch(() => null);
      const conta = atual?.accounts.find((item) => item.name === nomeConta);
      if (conta) {
        const limpeza = await request.delete(`/api/contas/${conta.id}`);
        expect(limpeza.ok(), "a limpeza da conta criada pelo teste falhou").toBeTruthy();
      }
    }
  });
});
