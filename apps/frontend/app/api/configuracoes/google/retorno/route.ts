import { callBackend } from "../../../_lib/backend";
import { origemPublica } from "../../../_lib/origem";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origem = origemPublica(request);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const falha = url.searchParams.get("error");
  const destino = new URL("/configuracoes", origem);
  if (falha || !code || !state) {
    destino.searchParams.set("google", "erro");
    return Response.redirect(destino);
  }
  const resposta = await callBackend("configuracoes/google/retorno", {
    method: "POST",
    body: JSON.stringify({
      code,
      state,
      redirectUri: `${origem}/api/configuracoes/google/retorno`,
    }),
  });
  destino.searchParams.set("google", resposta.ok ? "conectado" : "erro");
  return Response.redirect(destino);
}
