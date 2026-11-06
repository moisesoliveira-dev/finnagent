import { expect, test } from "@playwright/test";
import { esperarCriacao, idDoPedido } from "./apoio";

test.describe("Hoje", () => {
  test("anota uma tarefa, marca como feita e apaga pelo menu da linha", async ({ page, request }) => {
    const titulo = `E2E tarefa ${Date.now()}`;
    let id: string | null = null;

    try {
      await page.goto("/hoje");

      const campo = page.getByLabel("Nova tarefa");
      await expect(campo).toHaveAttribute("placeholder", "Anotar uma tarefa para hoje");

      const criacao = esperarCriacao(page, "tarefas");
      await campo.fill(titulo);
      await campo.press("Enter");
      const resposta = await criacao;
      id = idDoPedido(resposta);
      expect(resposta.ok()).toBeTruthy();

      await expect(page.getByRole("region", { name: "Para fazer" }).getByText(titulo, { exact: true })).toBeVisible();

      await page.getByRole("checkbox", { name: `Marcar como feito: Tarefa ${titulo}` }).click();
      await expect(page.getByRole("region", { name: "Feito" }).getByText(titulo, { exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: `Desmarcar: Tarefa ${titulo}` })).toBeChecked();

      await page.getByRole("button", { name: `Opções: Tarefa ${titulo}` }).click();
      await page.getByRole("menuitem", { name: "Apagar" }).click();
      await expect(page.getByText(titulo, { exact: true })).toHaveCount(0);
    } finally {
      // Se a tela já apagou, o DELETE devolve 404 e não importa.
      if (id) await request.delete(`/api/tarefas/${id}`).catch(() => undefined);
    }
  });
});
