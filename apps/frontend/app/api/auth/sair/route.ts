import { lerToken, limparCookies } from "../../_lib/sessao";

export async function POST() {
  const token = await lerToken();
  const base = process.env.API_URL;
  // Revoga no backend; se ele não responder, o cookie sai do mesmo jeito.
  if (token && base) {
    await fetch(new URL("auth/sair", base.endsWith("/") ? base : `${base}/`), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const resposta = new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  limparCookies(resposta.headers);
  return resposta;
}
