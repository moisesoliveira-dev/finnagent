import { describe, expect, it } from "vitest";
import {
  categoriasDaSessao,
  centavosDoLancamento,
  fimDaSessao,
  inicioDaSessao,
  aceitaLancamento,
  mesesOcupados,
  pedidoDaSessao,
  podeTrocarDeTipo,
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

  it("o Fixo fecha só o mês em que já tem a transação", () => {
    expect(aceitaLancamento("valor", [], "2026-10")).toBe(true);
    expect(aceitaLancamento("valor", [{ status: "cancelled", month: "2026-10" }], "2026-10")).toBe(true);
    expect(aceitaLancamento("valor", [{ status: "pending", month: "2026-10" }], "2026-10")).toBe(false);
    // Outubro lançado não fecha setembro nem novembro.
    expect(aceitaLancamento("valor", [{ status: "completed", month: "2026-10" }], "2026-09")).toBe(true);
    expect(aceitaLancamento("valor", [{ status: "completed", month: "2026-10" }], "2026-11")).toBe(true);
    expect(aceitaLancamento("acumulo", [{ status: "pending", month: "2026-10" }, { status: "pending", month: "2026-10" }], "2026-10")).toBe(true);
  });

  it("lista os meses ocupados do Fixo, com a base e o total de cada um", () => {
    const lancamentos = [
      { id: "out", position: 1, status: "completed", cents: -397, months: [], month: "2026-10" },
      { id: "nov-parte", position: 3, status: "pending", cents: -100, months: [], month: "2026-11" },
      { id: "nov", position: 2, status: "pending", cents: -397, months: [], month: "2026-11" },
      { id: "set", position: 0, status: "cancelled", cents: -397, months: [], month: "2026-09" },
    ];
    expect(mesesOcupados("valor", lancamentos)).toEqual([
      { month: "2026-10", cents: -397, totalCents: -397 },
      { month: "2026-11", cents: -397, totalCents: -497 },
    ]);
    expect(mesesOcupados("acumulo", lancamentos)).toEqual([]);
  });

  it("libera só a única no valor e todas no acúmulo", () => {
    expect(categoriasDaSessao("valor")).toEqual(["unique"]);
    expect(categoriasDaSessao("acumulo")).toEqual(["unique", "additional", "installment", "loan", "fixed"]);
  });

  it("separa a base do acréscimo pela ordem da transação", () => {
    const lancamentos = [
      { id: "b", position: 2, status: "pending", cents: -200, months: [], month: "2026-10" },
      { id: "a", position: 1, status: "pending", cents: -1_800, months: [], month: "2026-10" },
      { id: "c", position: 0, status: "cancelled", cents: -9_000, months: [], month: "2026-10" },
    ];
    expect(resumoDaSessao("valor", lancamentos)).toEqual({
      cents: -1_800,
      additions: [{ id: "b", cents: -200, note: "" }],
      totalCents: -2_000,
    });
  });

  it("não deixa o acréscimo reescrever a base", () => {
    const lancamentos = [
      { id: "base", position: 1, status: "pending", month: "2026-10" },
      { id: "extra", position: 2, status: "pending", month: "2026-10" },
    ];
    expect(protegeValorBase("valor", "base", lancamentos, true)).toBe(true);
    expect(protegeValorBase("valor", "extra", lancamentos, true)).toBe(false);
    expect(protegeValorBase("valor", "base", lancamentos, false)).toBe(false);
    expect(protegeValorBase("valor", "base", [lancamentos[0]!], true)).toBe(false);
    // A transação de outro mês não é parte desta: a base de outubro continua livre para mudar.
    expect(protegeValorBase("valor", "base", [lancamentos[0]!, { id: "nov", position: 2, status: "pending", month: "2026-11" }], true)).toBe(false);
  });

  it("soma as transações do acúmulo e ignora a cancelada", () => {
    const lancamentos = [
      { id: "a", position: 1, status: "pending", cents: -4_000, months: [], month: "2026-10" },
      { id: "b", position: 2, status: "cancelled", cents: -9_000, months: [], month: "2026-10" },
      { id: "c", position: 3, status: "pending", cents: 0, months: [-1_000, -2_000], month: "2026-10" },
    ];
    expect(centavosDoLancamento(lancamentos[2]!)).toBe(-3_000);
    expect(resumoDaSessao("acumulo", lancamentos)).toEqual({
      cents: 0,
      additions: [],
      totalCents: -7_000,
    });
  });
});

describe("trocar o tipo da sessão", () => {
  const unica = { status: "pending", category: "unique", month: "2026-10" };

  it("virar Acúmulo é sempre seguro, com o que a sessão tiver", () => {
    expect(podeTrocarDeTipo("valor", "acumulo", [unica])).toBe(true);
    expect(podeTrocarDeTipo("valor", "acumulo", [])).toBe(true);
  });

  it("virar Fixo cabe sem lançamento ou com uma única transação ativa", () => {
    expect(podeTrocarDeTipo("acumulo", "valor", [])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "valor", [unica])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "valor", [{ status: "completed", category: "unique", month: "2026-10" }])).toBe(true);
    // Uma única em cada mês cabe no Fixo.
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, { ...unica, month: "2026-11" }])).toBe(true);
  });

  it("a transação cancelada não conta para virar Fixo", () => {
    const cancelada = { status: "cancelled", category: "fixed", month: "2026-10" };
    expect(podeTrocarDeTipo("acumulo", "valor", [cancelada, unica, cancelada])).toBe(true);
  });

  it("não vira Fixo com duas transações ativas no mesmo mês nem com categoria que o Fixo não aceita", () => {
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, unica])).toBe(false);
    for (const category of ["fixed", "installment", "loan", "additional"]) {
      expect(podeTrocarDeTipo("acumulo", "valor", [{ status: "pending", category, month: "2026-10" }]), category).toBe(false);
    }
  });

  it("manter o tipo não pede nada", () => {
    expect(podeTrocarDeTipo("valor", "valor", [unica, unica])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "acumulo", [{ status: "pending", category: "fixed", month: "2026-10" }])).toBe(true);
  });
});
