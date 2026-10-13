import { callBackend } from "../../../_lib/backend";
import { origemPublica } from "../../../_lib/origem";

export async function GET(request: Request) {
  const origem = origemPublica(request);
  const redirectUri = `${origem}/api/configuracoes/google/retorno`;
  const resposta = await callBackend(
    `configuracoes/google/conectar?redirectUri=${encodeURIComponent(redirectUri)}`,
  );
  if (!resposta.ok) return Response.redirect(new URL("/configuracoes?google=erro", origem));
  const corpo = (await resposta.json().catch(() => null)) as { url?: string } | null;
  if (!corpo?.url?.startsWith("https://accounts.google.com/")) {
    return Response.redirect(new URL("/configuracoes?google=erro", origem));
  }
  return Response.redirect(corpo.url);
}
