import { lerToken, limparCookies } from "./sessao";

// O tenant não é mais escolhido aqui: o backend o descobre pela sessão (Authorization).
export async function callBackend(path: string, init?: RequestInit) {
  const base = process.env.API_URL;
  if (!base) {
    return Response.json(
      { message: "API_URL não está definida." },
      { status: 503 },
    );
  }

  const token = await lerToken();
  if (!token) return semSessao();

  try {
    const response = await fetch(new URL(path, base.endsWith("/") ? base : `${base}/`), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (response.status === 401) return semSessao();
    if (response.status === 204) return new Response(null, { status: 204 });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "O backend não respondeu." },
      { status: 503 },
    );
  }
}

/** Sessão ausente, vencida ou revogada: responde 401 e já apaga o cookie para a tela voltar ao login. */
function semSessao() {
  const resposta = Response.json({ message: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  resposta.headers.set("cache-control", "no-store");
  limparCookies(resposta.headers);
  return resposta;
}
