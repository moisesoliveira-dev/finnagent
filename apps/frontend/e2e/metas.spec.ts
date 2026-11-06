import { expect, test } from "@playwright/test";
import { esperarCriacao, idDoPedido } from "./apoio";

test.describe("Metas", () => {
  test("cria uma meta, vê na lista e exclui pela tela", async ({ page, request }) => {
    const nome = `E2E meta ${Date.now()}`;
    let id: string | null = null;

    try {
      await page.goto("/metas");
      await page.getByRole("button", { name: "Nova meta" }).click();

      const dialogo = page.getByRole("dialog", { name: "Nova meta" });
      await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
      const alvo = dialogo.getByLabel("Quanto você quer");
      await alvo.fill("150000");
      await expect(alvo).toHaveValue("1.500,00");

      const criacao = esperarCriacao(page, "metas");
      await dialogo.getByRole("button", { name: "Salvar" }).click();
      const resposta = await criacao;
      id = idDoPedido(resposta);
      expect(resposta.ok()).toBeTruthy();
      await expect(page.getByText("Meta salva.")).toBeVisible();
      await expect(page.getByRole("heading", { name: nome })).toBeVisible();

      await page.getByRole("button", { name: `Excluir ${nome}` }).click();
      const confirmacao = page.getByRole("dialog", { name: "Excluir esta meta?" });
      await expect(confirmacao.getByText(nome, { exact: true })).toBeVisible();
      await confirmacao.getByRole("button", { name: "Excluir", exact: true }).click();
      await expect(page.getByText("Meta excluída.")).toBeVisible();
      await expect(page.getByRole("heading", { name: nome })).toHaveCount(0);
    } finally {
      // Se a tela já excluiu, o DELETE devolve 404 e não importa.
      if (id) await request.delete(`/api/metas/${id}`).catch(() => undefined);
    }
  });
});
