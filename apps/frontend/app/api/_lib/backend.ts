import { loginDispensado } from "@finnagent/contracts";
import { registrar, textoDoErro } from "./registro";
import { lerToken, limparCookies } from "./sessao";

// Cold start do Railway serverless leva alguns segundos: leitura espera mais e tenta de novo uma vez.
// Escrita tem prazo maior (importação e cruzamento) e nunca repete.
const TEMPO_DA_LEITURA = 20_000;
const TEMPO_DA_ESCRITA = 60_000;
const FORA_DO_AR = new Set([502, 503, 504]);

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
  // Sem cookie só passa em desenvolvimento; o backend confere o mesmo e responde 401 em produção.
  if (!token && !loginDispensado(process.env)) return semSessao();

  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const leitura = (init?.method ?? "GET") === "GET";
  const pedido = () =>
    fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(leitura ? TEMPO_DA_LEITURA : TEMPO_DA_ESCRITA),
    });

  try {
    let response: Response;
    try {
      response = await pedido();
      if (leitura && FORA_DO_AR.has(response.status)) response = await pedido();
    } catch (error) {
      // Serviço serverless acordando: uma leitura repete uma vez. Escrita não repete, para não duplicar o efeito.
      if (!leitura || (error instanceof Error && error.name === "TimeoutError")) throw error;
      response = await pedido();
    }
    if (response.status === 401) return semSessao();
    if (response.status >= 500) registrar("error", "o backend devolveu erro", { rota: path, status: response.status });
    if (response.status === 204) return new Response(null, { status: 204 });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const demorou = error instanceof Error && error.name === "TimeoutError";
    registrar("error", demorou ? "o backend demorou demais" : "o backend não respondeu", { rota: path, err: textoDoErro(error) });
    return Response.json(
      { message: demorou ? "O servidor demorou para responder. Tente de novo." : "O backend não respondeu." },
      { status: demorou ? 504 : 503 },
    );
  }
}

/**
 * Repassa uma resposta que chega aos poucos (NDJSON), sem esperar o fim. Sem prazo e sem repetir:
 * o assistente pode levar um tempo e uma escrita não se repete. Se a pessoa parar na tela,
 * o cancelamento segue até o backend, que para o modelo.
 */
export async function streamBackend(path: string, request: Request) {
  const base = process.env.API_URL;
  if (!base) return Response.json({ message: "API_URL não está definida." }, { status: 503 });
  const token = await lerToken();
  if (!token && !loginDispensado(process.env)) return semSessao();
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: await request.text(),
      cache: "no-store",
      signal: request.signal,
    });
    if (response.status === 401) return semSessao();
    if (!response.ok || !response.body) {
      registrar("error", "o backend recusou o stream", { rota: path, status: response.status });
      return new Response(await response.text(), {
        status: response.status,
        headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
      });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    // Cancelar na tela também cai aqui: não é falha do servidor.
    if (!request.signal.aborted) registrar("error", "o backend não respondeu ao stream", { rota: path, err: textoDoErro(error) });
    return Response.json({ message: "O backend não respondeu." }, { status: 503 });
  }
}

/** Sessão ausente, vencida ou revogada: responde 401 e já apaga o cookie para a tela voltar ao login. */
function semSessao() {
  const resposta = Response.json({ message: "Sua sessão expirou. Entre de novo." }, { status: 401 });
  resposta.headers.set("cache-control", "no-store");
  limparCookies(resposta.headers);
  return resposta;
}
