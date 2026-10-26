import { describe, expect, it } from "vitest";
import {
  categoriasDaSessao,
  centavosDoLancamento,
  fimDaSessao,
  inicioDaSessao,
  aceitaLancamento,
  pedidoDaSessao,
  protegeValorBase,
  resumoDaSessao,
} from "./sessao.js";

describe("datas da sessão", () => {
  it("usa o dia anterior em São Paulo quando o UTC já virou o mês", () => {
    const instante = new Date("2026-10-01T02:30:00.000Z");
    expect(inicioDaSessao(instante)).toBe("2026-09-01");
    expect(fimDaSessao(instante)).toBe("2026-09-30");
  });

  it("usa o mês novo em São Paulo depois da meia-noite local", () => {
    const instante = new Date("2026-10-01T03:30:00.000Z");
    expect(inicioDaSessao(instante)).toBe("2026-10-01");
    expect(fimDaSessao(instante)).toBe("2026-10-01");
  });
});

describe("tipos da sessão", () => {
  it("não guarda valor na sessão", () => {
    expect(pedidoDaSessao("valor")).toEqual({ kind: "valor", cents: 0 });
    expect(pedidoDaSessao("acumulo")).toEqual({ kind: "acumulo", cents: 0 });
  });

  it("tira o valor único da lista depois do lançamento", () => {
    expect(aceitaLancamento("valor", [])).toBe(true);
    expect(aceitaLancamento("valor", [{ status: "cancelled" }])).toBe(true);
    expect(aceitaLancamento("valor", [{ status: "pending" }])).toBe(false);
    expect(aceitaLancamento("acumulo", [{ status: "pending" }, { status: "pending" }])).toBe(true);
  });

  it("libera só a única no valor e todas no acúmulo", () => {
    expect(categoriasDaSessao("valor")).toEqual(["unique"]);
    expect(categoriasDaSessao("acumulo")).toEqual(["unique", "additional", "installment", "loan", "fixed"]);
  });

  it("separa a base do acréscimo pela ordem da transação", () => {
    const lancamentos = [
      { id: "b", position: 2, status: "pending", cents: -200, months: [] },
      { id: "a", position: 1, status: "pending", cents: -1_800, months: [] },
      { id: "c", position: 0, status: "cancelled", cents: -9_000, months: [] },
    ];
    expect(resumoDaSessao("valor", lancamentos)).toEqual({
      cents: -1_800,
      additions: [{ id: "b", cents: -200, note: "" }],
      totalCents: -2_000,
    });
  });

  it("não deixa o acréscimo reescrever a base", () => {
    const lancamentos = [
      { id: "base", position: 1, status: "pending" },
      { id: "extra", position: 2, status: "pending" },
    ];
    expect(protegeValorBase("valor", "base", lancamentos, true)).toBe(true);
    expect(protegeValorBase("valor", "extra", lancamentos, true)).toBe(false);
    expect(protegeValorBase("valor", "base", lancamentos, false)).toBe(false);
    expect(protegeValorBase("valor", "base", [lancamentos[0]!], true)).toBe(false);
  });

  it("soma as transações do acúmulo e ignora a cancelada", () => {
    const lancamentos = [
      { id: "a", position: 1, status: "pending", cents: -4_000, months: [] },
      { id: "b", position: 2, status: "cancelled", cents: -9_000, months: [] },
      { id: "c", position: 3, status: "pending", cents: 0, months: [-1_000, -2_000] },
    ];
    expect(centavosDoLancamento(lancamentos[2]!)).toBe(-3_000);
    expect(resumoDaSessao("acumulo", lancamentos)).toEqual({
      cents: 0,
      additions: [],
      totalCents: -7_000,
    });
  });
});
