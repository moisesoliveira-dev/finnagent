import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { mensagensPara } from "./mensagens.js";
import { mensagemDaFalha } from "./erros.js";
import { erroDaUrl } from "./url.js";

describe("mensagens para um agente", () => {
  it("guarda só texto do histórico e junta mensagens seguidas do mesmo lado", () => {
    const vistas = mensagensPara("financas", [
      { role: "user", content: "oi" },
      { role: "assistant", content: "Olá!", agente: "coordenador" },
      { role: "assistant", content: "Posso ajudar.", agente: "coordenador" },
      { role: "user", content: "Quanto gastei?" },
    ]);
    expect(vistas.map((item) => item.constructor.name)).toEqual(["HumanMessage", "AIMessage", "HumanMessage"]);
    expect(vistas[1].content).toBe("Olá!\n\nPosso ajudar.");
  });

  it("mostra estruturado o que o próprio agente fez e como nota o que os outros fizeram", () => {
    const vistas = mensagensPara("agenda", [
      { role: "user", content: "Pague o aluguel e marque o dentista" },
      { role: "assistant", content: "", agente: "financas", toolCalls: [{ id: "f1", nome: "alterar_status_lancamento", args: {} }] },
      { role: "tool", content: '{"status":"completed"}', toolCallId: "f1", nome: "alterar_status_lancamento", agente: "financas" },
      { role: "assistant", content: "Finanças passou para Agenda: marcar o dentista", agente: "financas" },
      { role: "assistant", content: "", agente: "agenda", toolCalls: [{ id: "a1", nome: "consultar_agenda", args: { year: 2026, month: 10 } }] },
      { role: "tool", content: "[]", toolCallId: "a1", nome: "consultar_agenda", agente: "agenda" },
    ]);
    expect(vistas).toHaveLength(3);
    expect(vistas[0]).toBeInstanceOf(HumanMessage);
    expect(String(vistas[0].content)).toContain("Finanças usou alterar_status_lancamento");
    expect(String(vistas[0].content)).toContain("marcar o dentista");
    expect((vistas[1] as AIMessage).tool_calls?.map((item) => item.name)).toEqual(["consultar_agenda"]);
    expect(vistas[2]).toBeInstanceOf(ToolMessage);
  });

  it("completa o resultado que faltar, para o provedor aceitar a conversa", () => {
    const vistas = mensagensPara("metas", [
      { role: "user", content: "crie duas metas" },
      {
        role: "assistant",
        content: "",
        agente: "metas",
        toolCalls: [
          { id: "m1", nome: "criar_meta", args: {} },
          { id: "m2", nome: "criar_meta", args: {} },
        ],
      },
      { role: "tool", content: "ok", toolCallId: "m1", nome: "criar_meta", agente: "metas" },
    ]);
    const resultados = vistas.filter((item) => item instanceof ToolMessage) as ToolMessage[];
    expect(resultados.map((item) => item.tool_call_id)).toEqual(["m1", "m2"]);
  });

  it("para a conversa direta, sem agente, tudo do turno vira nota", () => {
    const vistas = mensagensPara(null, [
      { role: "user", content: "e aí?" },
      { role: "assistant", content: "", agente: "financas", toolCalls: [{ id: "x", nome: "consultar_metas", args: {} }] },
      { role: "tool", content: "[]", toolCallId: "x", nome: "consultar_metas", agente: "financas" },
    ]);
    expect(vistas.every((item) => !(item instanceof ToolMessage))).toBe(true);
  });
});

describe("falhas e URLs", () => {
  it("não deixa a chave vazar na mensagem e traduz os erros comuns", () => {
    expect(mensagemDaFalha(new Error("401 Incorrect API key provided: sk-abcdef1234567890"))).toBe(
      "O provedor recusou a chave. Confira a chave em Configurações, Inteligência artificial.",
    );
    expect(mensagemDaFalha(new Error("boom sk-proj-abcdef1234567890xyz"))).not.toContain("abcdef1234567890");
    expect(mensagemDaFalha(new Error("429 Rate limit reached"))).toContain("limitou o uso");
  });

  it("aceita qualquer URL local e bloqueia endereço interno na nuvem", () => {
    expect(erroDaUrl("http://localhost:11434/v1", {})).toBeNull();
    expect(erroDaUrl("ftp://exemplo.com", {})).toBe("A URL do provedor precisa começar com http ou https.");
    const nuvem = { RAILWAY_ENVIRONMENT: "production" };
    expect(erroDaUrl("https://openrouter.ai/api/v1", nuvem)).toBeNull();
    expect(erroDaUrl("http://openrouter.ai/api/v1", nuvem)).toBe("Na nuvem, a URL do provedor precisa ser https.");
    for (const interno of ["https://backend.railway.internal", "https://10.0.0.5", "https://127.0.0.1", "https://192.168.1.2", "https://localhost"]) {
      expect(erroDaUrl(interno, nuvem)).toBe("Na nuvem, a URL do provedor não pode apontar para um endereço interno.");
    }
  });
});
