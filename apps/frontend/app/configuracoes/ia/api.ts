import type {
  ConfiguracaoDeIa,
  ConfiguracaoDoAssistente,
  PedidoDeProvedor,
  ProvedorConfigurado,
  ProvedorIa,
  ResultadoDoTeste,
} from "@finnagent/contracts";

async function pedir<T>(caminho: string, init: RequestInit | undefined, padrao: string): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (resposta.status === 204) return undefined as T;
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string };
  if (!resposta.ok) throw new Error(corpo.message || padrao);
  return corpo;
}

export function carregarIa() {
  return pedir<ConfiguracaoDeIa>("/api/ia/configuracao", undefined, "Não foi possível carregar a configuração de IA.");
}

export function salvarProvedor(id: string | null, pedido: PedidoDeProvedor) {
  return pedir<ProvedorConfigurado>(
    id ? `/api/ia/provedores/${id}` : "/api/ia/provedores",
    { method: id ? "PATCH" : "POST", body: JSON.stringify(pedido) },
    "Não foi possível salvar o provedor.",
  );
}

export function removerProvedor(id: string) {
  return pedir<void>(`/api/ia/provedores/${id}`, { method: "DELETE" }, "Não foi possível remover o provedor.");
}

export function testarProvedor(pedido: { kind: ProvedorIa; apiKey: string; baseUrl: string; providerId: string | null }) {
  return pedir<ResultadoDoTeste>(
    "/api/ia/provedores/testar",
    { method: "POST", body: JSON.stringify(pedido) },
    "Não foi possível testar o provedor.",
  );
}

export function salvarAssistente(configuracao: ConfiguracaoDoAssistente) {
  return pedir<ConfiguracaoDoAssistente>(
    "/api/ia/assistente",
    { method: "PUT", body: JSON.stringify(configuracao) },
    "Não foi possível salvar o assistente.",
  );
}

export function apagarConversas() {
  return pedir<void>("/api/assistente/conversas", { method: "DELETE" }, "Não foi possível apagar as conversas.");
}
