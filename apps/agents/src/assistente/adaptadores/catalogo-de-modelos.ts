import type { PedidoDeTesteDoProvedor, ResultadoDoTeste } from "@finnagent/contracts";
import { mensagemDaFalha } from "../dominio/erros.js";
import { erroDaUrl } from "../dominio/url.js";

const LIMITE_DE_MODELOS = 300;

type Requisicao = { url: string; headers: Record<string, string>; ler: (corpo: unknown) => string[] };

/** Cada provedor lista os modelos de um jeito. A listagem confirma a chave sem gastar tokens. */
function requisicaoDe(pedido: PedidoDeTesteDoProvedor): Requisicao {
  if (pedido.kind === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/models?limit=100",
      headers: { "x-api-key": pedido.apiKey, "anthropic-version": "2023-06-01" },
      ler: (corpo) => idsDe((corpo as { data?: unknown }).data, "id"),
    };
  }
  if (pedido.kind === "google") {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      headers: { "x-goog-api-key": pedido.apiKey },
      ler: (corpo) => {
        const modelos = (corpo as { models?: unknown }).models;
        if (!Array.isArray(modelos)) return [];
        return modelos
          .filter((item) => {
            const metodos = (item as { supportedGenerationMethods?: unknown }).supportedGenerationMethods;
            return Array.isArray(metodos) && metodos.includes("generateContent");
          })
          .map((item) => String((item as { name?: unknown }).name ?? "").replace(/^models\//, ""))
          .filter(Boolean);
      },
    };
  }
  const base = pedido.kind === "openai" ? "https://api.openai.com/v1" : pedido.baseUrl.replace(/\/+$/, "");
  return {
    url: `${base}/models`,
    headers: pedido.apiKey ? { authorization: `Bearer ${pedido.apiKey}` } : {},
    ler: (corpo) => idsDe((corpo as { data?: unknown }).data, "id"),
  };
}

function idsDe(lista: unknown, campo: string) {
  if (!Array.isArray(lista)) return [];
  return lista.map((item) => String((item as Record<string, unknown>)[campo] ?? "")).filter(Boolean);
}

export async function testarProvedor(pedido: PedidoDeTesteDoProvedor): Promise<ResultadoDoTeste> {
  const inicio = Date.now();
  const erroDeUrl = pedido.kind === "openai_compativel" || pedido.kind === "ollama" ? erroDaUrl(pedido.baseUrl) : null;
  if (erroDeUrl) return { ok: false, models: [], message: erroDeUrl, ms: 0 };
  if (!pedido.apiKey && pedido.kind !== "ollama" && pedido.kind !== "openai_compativel") {
    return { ok: false, models: [], message: "Informe a chave do provedor.", ms: 0 };
  }
  const requisicao = requisicaoDe(pedido);
  try {
    const resposta = await fetch(requisicao.url, { headers: requisicao.headers, signal: AbortSignal.timeout(15_000) });
    const ms = Date.now() - inicio;
    if (resposta.status === 401 || resposta.status === 403) {
      return { ok: false, models: [], message: "O provedor recusou a chave.", ms };
    }
    if (!resposta.ok) {
      return { ok: false, models: [], message: `O provedor respondeu ${resposta.status}. Confira a URL e a chave.`, ms };
    }
    const modelos = [...new Set(requisicao.ler(await resposta.json()))].sort().slice(0, LIMITE_DE_MODELOS);
    return {
      ok: true,
      models: modelos,
      message: modelos.length ? `Conectado. ${modelos.length} modelos disponíveis.` : "Conectado, mas o provedor não listou modelos.",
      ms,
    };
  } catch (error) {
    return { ok: false, models: [], message: mensagemDaFalha(error), ms: Date.now() - inicio };
  }
}
