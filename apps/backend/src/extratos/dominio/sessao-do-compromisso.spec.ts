import { describe, expect, it } from "vitest";
import { sessaoDoCompromisso } from "./sessao-do-compromisso.js";

const saida = { year: 2026, month: 10, day: 10, sessionId: "namorada", title: "Sair com a namorada" };

describe("sessaoDoCompromisso", () => {
  it("sugere a sessão do compromisso que cai no dia da linha", () => {
    expect(sessaoDoCompromisso("2026-10-10", [saida])).toEqual({
      sessionId: "namorada",
      title: "Sair com a namorada",
    });
  });

  it("não sugere em outro dia nem sem sessão", () => {
    expect(sessaoDoCompromisso("2026-10-11", [saida])).toBeNull();
    expect(sessaoDoCompromisso("2026-10-10", [{ ...saida, sessionId: null }])).toBeNull();
  });

  it("não sugere quando dois compromissos do dia apontam para sessões diferentes", () => {
    const outro = { ...saida, sessionId: "amigos", title: "Futebol" };
    expect(sessaoDoCompromisso("2026-10-10", [saida, outro])).toBeNull();
  });

  it("aceita dois compromissos da mesma sessão", () => {
    const mesma = { ...saida, title: "Jantar" };
    expect(sessaoDoCompromisso("2026-10-10", [saida, mesma])?.sessionId).toBe("namorada");
  });
});
