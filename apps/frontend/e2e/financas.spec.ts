import { expect, test } from "@playwright/test";
import { escaparRegex, esperarCriacao, idDoPedido } from "./apoio";

type Sessao = { id: string; name: string; endedAt: string | null; categories: string[]; occupiedMonths: unknown[] };

test.describe("Finanças", () => {
  test("cria um lançamento único e vê a linha na Base do mês", async ({ page, request }) => {
    const nome = `E2E lançamento ${Date.now()}`;
    let id: string | null = null;

    try {
      // O formulário precisa de uma sessão aberta que aceite lançamento único: a tela lista as sessões do backend.
      const grupos = (await (await request.get("/api/grupos")).json()) as { sessions: Sessao[] };
      const sessao = grupos.sessions.find(
        (item) => !item.endedAt && item.categories.includes("unique") && item.occupiedMonths.length === 0,
      );
      test.skip(!sessao, "Não há sessão aberta que aceite lançamento único. Crie um grupo e uma sessão antes.");
      if (!sessao) return;

      await page.goto("/financas");
      await page.getByRole("button", { name: "Novo lançamento" }).click();

      const dialogo = page.getByRole("dialog");
      await expect(dialogo.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();
      await dialogo.getByLabel("Sessão", { exact: true }).selectOption(sessao.id);
      await dialogo.getByLabel("Nome", { exact: true }).fill(nome);
      await dialogo.getByLabel("Categoria", { exact: true }).selectOption("unique");
      const valor = dialogo.getByLabel("Valor", { exact: true });
      await valor.fill("12345");
      await expect(valor).toHaveValue("123,45");
      const data = await dialogo.getByLabel("Data", { exact: true }).inputValue();

      const criacao = esperarCriacao(page, "lancamentos");
      await dialogo.getByRole("button", { name: "Criar lançamento" }).click();
      const resposta = await criacao;
      id = idDoPedido(resposta);
      expect(resposta.ok()).toBeTruthy();
      await expect(page.getByText("Lançamento criado.")).toBeVisible();

      // A Base mostra um mês por vez: vai para o mês e o ano da data do lançamento e busca pelo nome.
      await page.getByRole("group", { name: "Visão" }).getByRole("button", { name: "Base" }).click();
      const [ano, mes] = data.split("-").map(Number);
      await page.getByLabel("Ano", { exact: true }).selectOption(String(ano));
      await page.getByLabel("Mês", { exact: true }).selectOption(String(mes));
      await page.getByLabel("Buscar").fill(nome);

      const linhaDaSessao = page.getByRole("button", {
        name: new RegExp(`^${escaparRegex(sessao.name)}: ver 1 lançamento$`),
      });
      await expect(linhaDaSessao).toBeVisible();
      await linhaDaSessao.click();
      await expect(page.getByRole("dialog").getByText(nome, { exact: true })).toBeVisible();
    } finally {
      if (id) {
        const limpeza = await request.delete(`/api/lancamentos/${id}`);
        expect(limpeza.ok(), "a limpeza do lançamento falhou").toBeTruthy();
      }
    }
  });
});
