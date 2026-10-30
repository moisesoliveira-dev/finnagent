import { encerrarSessao, tokenAtual } from "./sessao";

/**
 * Onde fica o BFF (o frontend Next.js). No navegador em desenvolvimento fica vazio: o Vite repassa /api.
 * No aparelho vem de VITE_API_URL, na hora do build.
 */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function cabecalhos(extra?: HeadersInit) {
  const token = tokenAtual();
  return {
    "content-type": "application/json",
    "x-prumo-app": "mobile",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function erroDe(resposta: Response) {
  const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
  if (resposta.status === 401 && tokenAtual()) await encerrarSessao();
  return new ErroDaApi(corpo.message || "Não foi possível concluir.", resposta.status);
}

export async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, { ...init, headers: cabecalhos(init?.headers) });
  } catch {
    throw new ErroDaApi("Sem conexão com o servidor.", 0);
  }
  if (!resposta.ok) throw await erroDe(resposta);
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

export const ler = <T>(caminho: string) => pedir<T>(caminho);

export const enviar = <T>(caminho: string, corpo: unknown, metodo = "POST") =>
  pedir<T>(caminho, { method: metodo, body: JSON.stringify(corpo) });

/** POST que devolve a resposta crua, para ler o assistente à medida que chega. */
export async function abrirFluxo(caminho: string, corpo: unknown, sinal?: AbortSignal) {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, { method: "POST", headers: cabecalhos(), body: JSON.stringify(corpo), signal: sinal });
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    throw new ErroDaApi("Sem conexão com o servidor.", 0);
  }
  if (!resposta.ok) throw await erroDe(resposta);
  return resposta;
}
