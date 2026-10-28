import {
  REGRA_SEM_AJUSTE,
  criarCalendario,
  dataPelaRegra,
  feriadosDoAno,
  gradeDoLancamento,
  pascoa,
  proximosVencimentos,
  regraPadrao,
  textoDaRegra,
  PADROES_DE_VENCIMENTO_INICIAIS,
  type RegraDeVencimento,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

const regra = (extra: Partial<RegraDeVencimento>): RegraDeVencimento => ({ ...REGRA_SEM_AJUSTE, ...extra });
const nacional = criarCalendario();

describe("feriados", () => {
  it("calcula a Páscoa e os móveis a partir dela", () => {
    expect(new Date(pascoa(2026)).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(new Date(pascoa(2025)).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(new Date(pascoa(2024)).toISOString().slice(0, 10)).toBe("2024-03-31");
    const datas = Object.fromEntries(feriadosDoAno(2026).map((item) => [item.data, item]));
    expect(datas["2026-02-16"]).toMatchObject({ nome: "Carnaval", tipo: "bancario" });
    expect(datas["2026-02-17"]).toMatchObject({ nome: "Carnaval", tipo: "bancario" });
    expect(datas["2026-02-18"]).toMatchObject({ tipo: "facultativo" });
    expect(datas["2026-04-03"]).toMatchObject({ nome: "Sexta-feira Santa", tipo: "nacional" });
    expect(datas["2026-06-04"]).toMatchObject({ nome: "Corpus Christi", tipo: "bancario" });
  });

  it("só conta a Consciência Negra como feriado nacional a partir de 2024", () => {
    expect(feriadosDoAno(2023).some((item) => item.data === "2023-11-20")).toBe(false);
    expect(feriadosDoAno(2024).some((item) => item.data === "2024-11-20" && item.tipo === "nacional")).toBe(true);
  });

  it("inclui os feriados locais da conta, todo ano no mesmo dia", () => {
    const locais = [{ id: "1", nome: "Aniversário da cidade", dia: 25, mes: 1 }];
    expect(feriadosDoAno(2027, locais).find((item) => item.data === "2027-01-25")).toMatchObject({ tipo: "local" });
  });

  it("separa dia útil bancário de dia útil da CLT", () => {
    expect(nacional.ehUtil("2026-05-30", "bancaria")).toBe(false); // sábado
    expect(nacional.ehUtil("2026-05-30", "clt")).toBe(true);
    expect(nacional.ehUtil("2026-05-31", "clt")).toBe(false); // domingo
    expect(nacional.ehUtil("2026-02-16", "bancaria")).toBe(false); // Carnaval: banco fechado
    expect(nacional.ehUtil("2026-02-16", "clt")).toBe(true); // ponto facultativo não para a CLT
    expect(nacional.ehUtil("2026-11-02", "clt")).toBe(false); // Finados
    expect(nacional.ehUtil("2026-02-18", "bancaria")).toBe(true); // Cinzas: banco abre ao meio-dia
  });
});

describe("regra de vencimento", () => {
  it("dia 30 num sábado: antecipa, adia, ou adia sem trocar de mês", () => {
    expect(dataPelaRegra(2026, 5, 30, regra({}))).toBe("2026-05-30");
    expect(dataPelaRegra(2026, 5, 30, regra({ ajuste: "antecipar" }))).toBe("2026-05-29");
    expect(dataPelaRegra(2026, 5, 30, regra({ ajuste: "adiar" }))).toBe("2026-06-01");
    expect(dataPelaRegra(2026, 5, 30, regra({ ajuste: "adiar_no_mes" }))).toBe("2026-05-29");
  });

  it("pula feriado e ponto facultativo bancário ao adiar", () => {
    expect(dataPelaRegra(2026, 2, 16, regra({ ajuste: "adiar" }))).toBe("2026-02-18");
    // Na CLT o Carnaval é dia útil, mas o banco está fechado: a data segue o ajuste até um dia de banco.
    expect(dataPelaRegra(2026, 2, 16, regra({ ajuste: "adiar", contagem: "clt" }))).toBe("2026-02-18");
  });

  it("dia 31 em fevereiro vira o último dia e depois se ajusta", () => {
    expect(dataPelaRegra(2026, 2, 31, regra({}))).toBe("2026-02-28");
    expect(dataPelaRegra(2026, 2, 31, regra({ ajuste: "antecipar" }))).toBe("2026-02-27");
  });

  it("5º dia útil: a contagem bancária pula sábado e feriado; a da CLT conta o sábado e paga no dia útil bancário antes", () => {
    expect(dataPelaRegra(2026, 11, 1, regra({ tipo: "dia_util", ordem: 5 }))).toBe("2026-11-09");
    expect(dataPelaRegra(2026, 11, 1, regra({ tipo: "dia_util", ordem: 5, contagem: "clt" }))).toBe("2026-11-06");
    expect(dataPelaRegra(2026, 6, 1, regra({ tipo: "dia_util", ordem: 1 }))).toBe("2026-06-01");
  });

  it("último dia útil do mês", () => {
    expect(dataPelaRegra(2026, 2, 1, regra({ tipo: "ultimo_dia_util" }))).toBe("2026-02-27");
    expect(dataPelaRegra(2026, 6, 1, regra({ tipo: "ultimo_dia_util" }))).toBe("2026-06-30");
  });

  it("antecipar pode voltar um ano: dia 1º de janeiro é feriado", () => {
    expect(dataPelaRegra(2027, 1, 1, regra({ ajuste: "antecipar" }))).toBe("2026-12-31");
  });

  it("feriado local muda o dia útil", () => {
    const comLocal = criarCalendario([{ id: "1", nome: "Aniversário da cidade", dia: 25, mes: 1 }]);
    expect(dataPelaRegra(2027, 1, 25, regra({ ajuste: "adiar" }))).toBe("2027-01-25");
    expect(dataPelaRegra(2027, 1, 25, regra({ ajuste: "adiar" }), comLocal)).toBe("2027-01-26");
  });

  it("a sugestão segue a categoria e o sentido do dinheiro", () => {
    expect(regraPadrao(PADROES_DE_VENCIMENTO_INICIAIS, "fixed", "inflows").ajuste).toBe("antecipar");
    expect(regraPadrao(PADROES_DE_VENCIMENTO_INICIAIS, "fixed", "outflows").ajuste).toBe("adiar");
    expect(regraPadrao(PADROES_DE_VENCIMENTO_INICIAIS, "installment", "outflows").ajuste).toBe("adiar");
    expect(regraPadrao({ ...PADROES_DE_VENCIMENTO_INICIAIS, emprestimo: "manter" }, "loan", "outflows").ajuste).toBe("manter");
    expect(regraPadrao(PADROES_DE_VENCIMENTO_INICIAIS, "unique", "outflows")).toEqual(REGRA_SEM_AJUSTE);
  });

  it("descreve a regra em poucas palavras", () => {
    expect(textoDaRegra(regra({ tipo: "dia_util", ordem: 5, contagem: "clt" }), 1)).toBe("5º dia útil (CLT)");
    expect(textoDaRegra(regra({ ajuste: "antecipar" }), 30)).toBe("Dia 30, antecipa");
    expect(textoDaRegra(regra({ tipo: "ultimo_dia_util", contagem: "clt" }), 1)).toBe("Último dia útil");
    expect(textoDaRegra(regra({}), 10)).toBe("Dia 10");
  });
});

describe("ocorrências com regra", () => {
  const base = {
    cents: -10000,
    status: "pending" as const,
    months: [],
    adjustments: [],
    recurrence: null,
    recurrenceInterval: null,
  };

  it("parcelas no dia 30 que adiam quando caem em fim de semana", () => {
    const grade = gradeDoLancamento({
      ...base,
      type: "parcela",
      day: 30,
      startYear: 2026,
      startMonth: 5,
      installments: 3,
      dueRule: regra({ ajuste: "adiar" }),
    });
    expect(grade.map((item) => item.dueDate)).toEqual(["2026-06-01", "2026-06-30", "2026-07-30"]);
  });

  it("salário fixo no 5º dia útil pela CLT, mês a mês", () => {
    const grade = gradeDoLancamento({
      ...base,
      cents: 500000,
      type: "fixo",
      day: 5,
      startYear: 2026,
      startMonth: 10,
      installments: null,
      recurrence: "monthly",
      recurrenceInterval: 1,
      dueRule: regra({ tipo: "dia_util", ordem: 5, contagem: "clt" }),
    });
    // Dezembro: o 5º dia útil da CLT é o sábado, dia 5; o crédito vem na sexta, dia 4.
    expect(grade.map((item) => item.dueDate)).toEqual(["2026-10-06", "2026-11-06", "2026-12-04"]);
  });

  it("fixa semanal só ajusta o dia que cai em fim de semana", () => {
    const grade = gradeDoLancamento({
      ...base,
      type: "fixo",
      day: 30,
      startYear: 2026,
      startMonth: 5,
      installments: null,
      recurrence: "weekly",
      recurrenceInterval: 1,
      dueRule: regra({ tipo: "dia_util", ordem: 5, ajuste: "adiar" }),
    });
    expect(grade.slice(0, 2).map((item) => item.dueDate)).toEqual(["2026-06-01", "2026-06-08"]);
  });

  it("sem regra, as datas não mudam", () => {
    const grade = gradeDoLancamento({ ...base, type: "parcela", day: 30, startYear: 2026, startMonth: 5, installments: 1 });
    expect(grade[0].dueDate).toBe("2026-05-30");
  });
});

describe("prévia das próximas datas", () => {
  const fixa = { category: "fixed" as const, recurrence: "monthly" as const, recurrenceInterval: 1, installments: null };

  it("salário no dia 30 que antecipa: maio e agosto caem no fim de semana", () => {
    const previa = proximosVencimentos({ ...fixa, date: "2026-05-30" }, regra({ ajuste: "antecipar" }), nacional);
    expect(previa.map((item) => item.data)).toEqual(["2026-05-29", "2026-06-30", "2026-07-30", "2026-08-28"]);
    expect(previa[3]).toMatchObject({ base: "2026-08-30", feriado: null });
  });

  it("a fixa para em dezembro do ano em que começa; a parcela segue para o ano seguinte", () => {
    const fixaNoFim = proximosVencimentos({ ...fixa, date: "2026-11-30" }, regra({ ajuste: "adiar" }), nacional);
    expect(fixaNoFim.map((item) => item.data)).toEqual(["2026-11-30", "2026-12-30"]);
    const parcelas = proximosVencimentos(
      { category: "installment", date: "2026-11-30", recurrence: null, recurrenceInterval: null, installments: 10 },
      regra({ ajuste: "adiar" }),
      nacional,
    );
    expect(parcelas.map((item) => item.data)).toEqual(["2026-11-30", "2026-12-30", "2027-02-01", "2027-03-01"]);
  });

  it("diz qual feriado empurrou a data", () => {
    const [primeira] = proximosVencimentos({ ...fixa, date: "2026-11-15" }, regra({ ajuste: "adiar" }), nacional);
    expect(primeira).toEqual({ data: "2026-11-16", base: "2026-11-15", feriado: "Proclamação da República" });
  });

  it("5º dia útil da CLT segue mês a mês", () => {
    const previa = proximosVencimentos(
      { ...fixa, date: "2026-11-05" },
      regra({ tipo: "dia_util", ordem: 5, ajuste: "antecipar", contagem: "clt" }),
      nacional,
    );
    expect(previa[1].data).toBe("2026-12-04");
  });

  it("parcelas param no número de parcelas", () => {
    const previa = proximosVencimentos(
      { category: "installment", date: "2026-10-30", recurrence: null, recurrenceInterval: null, installments: 2 },
      regra({ ajuste: "adiar" }),
      nacional,
    );
    expect(previa).toHaveLength(2);
  });

  it("fixa semanal ignora o Nº dia útil e só ajusta o dia", () => {
    const previa = proximosVencimentos(
      { ...fixa, recurrence: "weekly", date: "2026-10-31" },
      regra({ tipo: "dia_util", ordem: 5, ajuste: "adiar" }),
      nacional,
    );
    // 31/10 é sábado e 02/11 é Finados: vai para a terça.
    expect(previa.map((item) => item.data)).toEqual(["2026-11-03", "2026-11-09", "2026-11-16", "2026-11-23"]);
  });

  it("lançamento único não tem prévia", () => {
    expect(
      proximosVencimentos({ category: "unique", date: "2026-10-31", recurrence: null, recurrenceInterval: null, installments: null }, REGRA_SEM_AJUSTE),
    ).toEqual([]);
  });
});
