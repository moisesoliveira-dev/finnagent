import type { Page, Response } from "@playwright/test";

/** Espera o POST de criação que a tela dispara para `/api/<rota>` e devolve a resposta, para pegar o id gerado pela tela. */
export function esperarCriacao(page: Page, rota: string) {
  return page.waitForResponse(
    (resposta) => resposta.request().method() === "POST" && new URL(resposta.url()).pathname === `/api/${rota}`,
  );
}

/** O id que a tela gerou (`crypto.randomUUID()`) e mandou no corpo do POST. Serve para a limpeza no fim do teste. */
export function idDoPedido(resposta: Response) {
  const corpo = resposta.request().postDataJSON() as { id?: string } | null;
  return corpo?.id ?? null;
}

export function escaparRegex(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
