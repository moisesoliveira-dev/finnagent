import { describe, expect, it } from "vitest";
import { resultadoParaOModelo } from "./conversa.js";
import { limpar, textoDoResultado } from "./resultados.js";

describe("resultado das ferramentas para o modelo", () => {
  it("lança uma linha por lançamento, com o id, o valor e a situação", () => {
    const texto = textoDoResultado("consultar_lancamentos", {
      year: 2026, month: 11, day: null, years: [2026], months: [11], days: [], groups: [{ id: "g1", name: "Moradia" }], totalCents: -120000,
      rows: [{
        entryId: "e1", number: 1, dueDate: "2026-11-10", name: "Aluguel", description: "", justification: "", groupName: "Moradia", sessionName: "Aluguel",
        category: "fixed", priority: "nopriority", situation: "pending", cents: -120000, installment: null, remove: "occurrence", synced: false, transfer: false,
      }],
    });
    expect(texto).toContain("Lançamentos de 11/2026: 1 linhas");
    expect(texto).toContain("- e1 oc.1 · 2026-11-10 · Aluguel · Moradia/Aluguel · fixed · pending · -R$");
    expect(texto).not.toContain("justification");
  });

  it("a conferência traz o id da linha, a sugestão e a sessão sugerida", () => {
    const vinculo = { entryId: "e2", description: "Mercado", groupName: "Casa", sessionName: "Comida", day: 3, cents: -5000, category: "unique" as const };
    const texto = textoDoResultado("consultar_conferencia", {
      year: 2026, month: 11, pending: 2, checked: false, page: { number: 1, size: 10, total: 2 },
      lines: [{
        statementId: "s1", line: 4, date: "2026-11-03", description: "MERCADO X", cents: -5000, accountName: "Nubank", filename: "x.ofx", entryId: null, ignored: false,
        link: null, parts: [], names: ["Mercado"], suggestion: vinculo, suggestionSource: "nome", candidates: [], sessionId: "ses1", sessionSource: "nome", appointmentTitle: null,
      }],
    });
    expect(texto).toContain("Página 1 de 1");
    expect(texto).toContain("- s1:4 · 2026-11-03 · MERCADO X");
    expect(texto).toContain('sugestão (nome): e2 "Mercado"');
    expect(texto).toContain("sessão sugerida: ses1 (nome)");
    expect(texto).toContain("nomes já dados: Mercado");
  });

  it("sem formato, o JSON perde null, vazio e lista vazia, e mantém false", () => {
    expect(limpar({ a: null, b: "", c: [], d: {}, e: false, f: 0, g: { h: null, i: "x" } })).toEqual({ e: false, f: 0, g: { i: "x" } });
    expect(resultadoParaOModelo({ ok: true, nada: null }, "consultar_metas")).toBe('{"ok":true}');
  });

  it("formato inesperado cai no JSON limpo, sem quebrar", () => {
    expect(resultadoParaOModelo({ rows: "não é lista" }, "consultar_lancamentos")).toBe('{"rows":"não é lista"}');
  });
});
