import { describe, expect, it } from "vitest";
import {
  categoriasDaSessao,
  centavosDoLancamento,
  fimDaSessao,
  inicioDaSessao,
  mesEmConflito,
  mesesDoLancamento,
  mesesOcupados,
  mensagemDoMesOcupado,
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

const unicaEm = (month: string, cents: number) => [{ month, cents }];

describe("tipos da sessão", () => {
  it("não guarda valor na sessão", () => {
    expect(pedidoDaSessao("valor")).toEqual({ kind: "valor", cents: 0 });
    expect(pedidoDaSessao("acumulo")).toEqual({ kind: "acumulo", cents: 0 });
  });

  it("o Fixo aceita única, parcela, empréstimo e fixa; a extra fica no acúmulo", () => {
    expect(categoriasDaSessao("valor")).toEqual(["unique", "installment", "loan", "fixed"]);
    expect(categoriasDaSessao("acumulo")).toEqual(["unique", "additional", "installment", "loan", "fixed"]);
  });

  it("lista os meses ocupados do Fixo, com a base e o total de cada um", () => {
    const lancamentos = [
      { id: "out", position: 1, status: "completed", cents: -397, months: [], meses: unicaEm("2026-10", -397) },
      { id: "nov-parte", position: 3, status: "pending", cents: -100, months: [], meses: unicaEm("2026-11", -100) },
      { id: "nov", position: 2, status: "pending", cents: -397, months: [], meses: unicaEm("2026-11", -397) },
      { id: "set", position: 0, status: "cancelled", cents: -397, months: [], meses: unicaEm("2026-09", -397) },
    ];
    expect(mesesOcupados("valor", lancamentos)).toEqual([
      { month: "2026-10", cents: -397, totalCents: -397 },
      { month: "2026-11", cents: -397, totalCents: -497 },
    ]);
    expect(mesesOcupados("acumulo", lancamentos)).toEqual([]);
  });

  it("a parcela do Fixo ocupa cada mês em que vence", () => {
    const parcela = {
      id: "tv",
      position: 0,
      status: "pending",
      cents: -50_000,
      months: [],
      meses: [
        { month: "2026-11", cents: -50_000 },
        { month: "2026-12", cents: -50_000 },
        { month: "2027-01", cents: -50_000 },
      ],
    };
    expect(mesesOcupados("valor", [parcela]).map((mes) => mes.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("separa a base do acréscimo pela ordem da transação", () => {
    const lancamentos = [
      { id: "b", position: 2, status: "pending", cents: -200, months: [], meses: unicaEm("2026-10", -200) },
      { id: "a", position: 1, status: "pending", cents: -1_800, months: [], meses: unicaEm("2026-10", -1_800) },
      { id: "c", position: 0, status: "cancelled", cents: -9_000, months: [], meses: unicaEm("2026-10", -9_000) },
    ];
    expect(resumoDaSessao("valor", lancamentos)).toEqual({
      cents: -1_800,
      additions: [{ id: "b", cents: -200, note: "" }],
      totalCents: -2_000,
    });
  });

  it("não deixa o acréscimo reescrever a base", () => {
    const lancamentos = [
      { id: "base", position: 1, status: "pending", meses: ["2026-10"] },
      { id: "extra", position: 2, status: "pending", meses: ["2026-10"] },
    ];
    expect(protegeValorBase("valor", "base", lancamentos, true)).toBe(true);
    expect(protegeValorBase("valor", "extra", lancamentos, true)).toBe(false);
    expect(protegeValorBase("valor", "base", lancamentos, false)).toBe(false);
    expect(protegeValorBase("valor", "base", [lancamentos[0]!], true)).toBe(false);
    // A transação de outro mês não é parte desta: a base de outubro continua livre para mudar.
    expect(protegeValorBase("valor", "base", [lancamentos[0]!, { id: "nov", position: 2, status: "pending", meses: ["2026-11"] }], true)).toBe(false);
  });

  it("protege a parcela que é base de algum mês com parte atrás dela", () => {
    const lancamentos = [
      { id: "parcela", position: 1, status: "pending", meses: ["2026-10", "2026-11", "2026-12"] },
      { id: "parte", position: 2, status: "pending", meses: ["2026-11"] },
    ];
    expect(protegeValorBase("valor", "parcela", lancamentos, true)).toBe(true);
  });

  it("soma as transações do acúmulo e ignora a cancelada", () => {
    const lancamentos = [
      { id: "a", position: 1, status: "pending", cents: -4_000, months: [], meses: [] },
      { id: "b", position: 2, status: "cancelled", cents: -9_000, months: [], meses: [] },
      { id: "c", position: 3, status: "pending", cents: 0, months: [-1_000, -2_000], meses: [] },
    ];
    expect(centavosDoLancamento(lancamentos[2]!)).toBe(-3_000);
    expect(resumoDaSessao("acumulo", lancamentos)).toEqual({
      cents: 0,
      additions: [],
      totalCents: -7_000,
    });
  });
});

describe("meses que a transação ocupa", () => {
  const base = { startYear: 2026, startMonth: 11, installments: null, status: "pending", cents: -10_000, months: [], vencimentos: [] };
  const venc = (dueDate: string, status = "pending", kind: string | null = "parcela") => ({ dueDate, status, kind, cents: -10_000 });

  it("a única ocupa só o mês dela", () => {
    expect(mesesDoLancamento({ ...base, category: "unique" })).toEqual([{ month: "2026-11", cents: -10_000 }]);
  });

  it("a parcela ocupa os meses dos vencimentos, sem o cancelado e sem a multa", () => {
    const meses = mesesDoLancamento({
      ...base,
      category: "installment",
      installments: 4,
      vencimentos: [venc("2026-11-10"), venc("2026-12-10", "completed"), venc("2026-12-20", "completed", "multa"), venc("2027-01-10", "cancelled"), venc("2027-02-10")],
    });
    expect(meses).toEqual([
      { month: "2026-11", cents: -10_000 },
      { month: "2026-12", cents: -10_000 },
      { month: "2027-02", cents: -10_000 },
    ]);
  });

  it("sem vencimento gravado, conta as parcelas a partir do início, virando o ano", () => {
    const meses = mesesDoLancamento({ ...base, category: "loan", installments: 3 }).map((mes) => mes.month);
    expect(meses).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("a fixa ocupa cada mês em que vence", () => {
    const meses = mesesDoLancamento({ ...base, category: "fixed", vencimentos: [venc("2026-11-05"), venc("2026-12-05"), venc("2027-01-05")] });
    expect(meses.map((mes) => mes.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("mês em conflito no Fixo", () => {
  it("acha o primeiro mês já ocupado por outra transação", () => {
    const outras = [{ status: "pending", meses: ["2027-03"] }, { status: "pending", meses: ["2027-01"] }];
    expect(mesEmConflito("valor", outras, ["2026-12", "2027-01", "2027-02", "2027-03"])).toBe("2027-01");
  });

  it("mês livre, transação cancelada e acúmulo não conflitam", () => {
    expect(mesEmConflito("valor", [{ status: "pending", meses: ["2027-05"] }], ["2027-01", "2027-02"])).toBeNull();
    expect(mesEmConflito("valor", [{ status: "cancelled", meses: ["2027-01"] }], ["2027-01"])).toBeNull();
    expect(mesEmConflito("acumulo", [{ status: "pending", meses: ["2027-01"] }], ["2027-01"])).toBeNull();
  });

  it("na edição, o mês que a transação já ocupava continua dela", () => {
    const partes = [{ status: "pending", meses: ["2027-01"] }];
    expect(mesEmConflito("valor", partes, ["2027-01", "2027-02"], ["2027-01"])).toBeNull();
    expect(mesEmConflito("valor", [{ status: "pending", meses: ["2027-02"] }], ["2027-01", "2027-02"], ["2027-01"])).toBe("2027-02");
  });

  it("diz o mês por extenso", () => {
    expect(mensagemDoMesOcupado("2027-03")).toContain("março de 2027");
  });
});

describe("trocar o tipo da sessão", () => {
  const unica = { status: "pending", category: "unique", meses: ["2026-10"] };

  it("virar Acúmulo é sempre seguro, com o que a sessão tiver", () => {
    expect(podeTrocarDeTipo("valor", "acumulo", [unica])).toBe(true);
    expect(podeTrocarDeTipo("valor", "acumulo", [])).toBe(true);
  });

  it("virar Fixo cabe sem lançamento ou com uma transação por mês", () => {
    expect(podeTrocarDeTipo("acumulo", "valor", [])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "valor", [unica])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, { ...unica, meses: ["2026-11"] }])).toBe(true);
    // Parcela de novembro a janeiro e uma única em outubro: cada mês tem uma só.
    const parcela = { status: "pending", category: "installment", meses: ["2026-11", "2026-12", "2027-01"] };
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, parcela])).toBe(true);
    for (const category of ["fixed", "loan"]) {
      expect(podeTrocarDeTipo("acumulo", "valor", [{ ...parcela, category }]), category).toBe(true);
    }
  });

  it("a transação cancelada não conta para virar Fixo", () => {
    const cancelada = { status: "cancelled", category: "additional", meses: ["2026-10"] };
    expect(podeTrocarDeTipo("acumulo", "valor", [cancelada, unica, cancelada])).toBe(true);
  });

  it("não vira Fixo com duas transações no mesmo mês nem com extra", () => {
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, unica])).toBe(false);
    const parcela = { status: "pending", category: "installment", meses: ["2026-09", "2026-10"] };
    expect(podeTrocarDeTipo("acumulo", "valor", [unica, parcela])).toBe(false);
    expect(podeTrocarDeTipo("acumulo", "valor", [{ status: "pending", category: "additional", meses: ["2026-10"] }])).toBe(false);
  });

  it("manter o tipo não pede nada", () => {
    expect(podeTrocarDeTipo("valor", "valor", [unica, unica])).toBe(true);
    expect(podeTrocarDeTipo("acumulo", "acumulo", [{ status: "pending", category: "additional", meses: ["2026-10"] }])).toBe(true);
  });
});
