import { expect, test } from "@playwright/test";
import { esperarCriacao, idDoPedido } from "./apoio";

test.describe("Agenda", () => {
  test("cria um compromisso de hoje, vê na lista do mês e apaga pela edição", async ({ page, request }) => {
    const titulo = `E2E compromisso ${Date.now()}`;
    let id: string | null = null;

    try {
      await page.goto("/agenda");
      // O formulário abre no dia selecionado, que começa em hoje.
      await page.getByRole("button", { name: "Novo compromisso", exact: true }).click();

      const dialogo = page.getByRole("dialog", { name: "Novo compromisso" });
      await dialogo.getByLabel("Título").fill(titulo);
      const diaTodo = dialogo.getByRole("checkbox", { name: "Dia todo" });
      await diaTodo.click();
      await expect(diaTodo).toBeChecked();

      const criacao = esperarCriacao(page, "compromissos");
      await dialogo.getByRole("button", { name: "Criar compromisso" }).click();
      const resposta = await criacao;
      id = idDoPedido(resposta);
      expect(resposta.ok()).toBeTruthy();
      await expect(page.getByText("Compromisso criado.")).toBeVisible();

      await page.getByRole("group", { name: "Visão" }).getByRole("button", { name: "Lista" }).click();
      const item = page.getByRole("button", { name: titulo, exact: true });
      await expect(item).toBeVisible();

      await item.click();
      const edicao = page.getByRole("dialog", { name: "Editar compromisso" });
      await edicao.getByRole("button", { name: "Excluir", exact: true }).click();
      await edicao.getByRole("button", { name: "Confirmar exclusão" }).click();
      await expect(page.getByText("Compromisso apagado.")).toBeVisible();
      await expect(page.getByRole("button", { name: titulo, exact: true })).toHaveCount(0);
    } finally {
      // Se a tela já apagou, o DELETE devolve 404 e não importa.
      if (id) await request.delete(`/api/compromissos/${id}`).catch(() => undefined);
    }
  });
});
