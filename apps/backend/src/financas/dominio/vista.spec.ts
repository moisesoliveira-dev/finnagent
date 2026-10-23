import { gradeDoLancamento, transicaoDaOcorrencia, type Lancamento } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { EXEMPLO, WORKFLOW_INICIAL } from "./exemplo.js";
import {
  diaNoFuso,
  lancamentoVista,
  montarBase,
  montarGeral,
  ocorrenciaVista,
  regraDaCategoria,
  removerDaLinha,
  situacaoNoMes,
  type FiltroBase,
} from "./vista.js";

const salario = EXEMPLO[0]!;
const notebook = EXEMPLO[6]!;
const base = { workflow: WORKFLOW_INICIAL, entries: [notebook, salario] };
const filtro: FiltroBase = { year: 2026, month: null, day: null, groupId: null, category: null, q: "" };

function comPrimeiraPaga(entry: Lancamento): Lancamento {
  const grade = gradeDoLancamento(entry);
  const paga = transicaoDaOcorrencia(grade[0]!, "completed");
  if (paga === "bloqueada") throw new Error("transição bloqueada");
  return { ...entry, occurrences: [paga, ...grade.slice(1)] };
}

describe("regras da categoria", () => {
  it("define modo, tipo, prioridade e campos de cada categoria", () => {
    expect(regraDaCategoria("installment")).toEqual({
      mode: "outflows",
      transactionType: "appointment",
      priority: "sempre",
      installments: true,
      loan: false,
      recurrence: false,
    });
    expect(regraDaCategoria("additional")).toMatchObject({
      mode: "inflows",
      transactionType: null,
      priority: "nunca",
    });
    expect(regraDaCategoria("loan")).toMatchObject({ mode: null, installments: true, loan: true });
    expect(regraDaCategoria("fixed")).toMatchObject({ transactionType: "appointment", recurrence: true });
    expect(regraDaCategoria("unique")).toMatchObject({ mode: null, transactionType: null, priority: "saida" });
  });
});

describe("vista do lançamento", () => {
  it("entrega a situação, as transições e a edição de cada ocorrência", () => {
    const [primeira] = gradeDoLancamento(notebook);
    const vista = ocorrenciaVista(primeira!, false, "2026-04-20");
    expect(vista.situation).toBe("late");
    expect(vista.editable).toBe(true);
    expect(vista.next).toEqual(["completed", "cancelled"]);
    expect(ocorrenciaVista(primeira!, true, "2026-04-20").editable).toBe(false);
  });

  it("trava os termos e aponta o próximo vencimento depois de um pagamento", () => {
    const vista = lancamentoVista(comPrimeiraPaga(notebook), "2026-03-20");
    expect(vista.termsLocked).toBe(true);
    expect(vista.nextDue).toBe("2026-04-10");
    expect(vista.contractCents).toBe(notebook.cents);
    expect(vista.actions).toEqual({ remove: true, series: "installment", fixedMonth: false });
    expect(vista.occurrences[0]).toMatchObject({ status: "completed", editable: false });
  });
});

describe("situação no mês", () => {
  it("usa a ocorrência do mês e não a data do dia", () => {
    expect(situacaoNoMes(notebook, 2026, 3, "2026-04-20")).toBe("late");
    expect(situacaoNoMes(notebook, 2026, 5, "2026-04-20")).toBe("pending");
    expect(situacaoNoMes(comPrimeiraPaga(notebook), 2026, 3, "2026-04-20")).toBe("completed");
  });
});

describe("base", () => {
  it("mostra cada mês replicado como uma linha própria", () => {
    const resposta = montarBase({ ...base, entries: [notebook] }, "2026-03-01", filtro);
    expect(resposta.rows).toHaveLength(10);
    expect(resposta.rows.map((linha) => linha.installment)).toEqual(
      Array.from({ length: 10 }, (_, indice) => ({ number: indice + 1, total: 10 })),
    );
    expect(resposta.rows.every((linha) => linha.remove === "occurrence")).toBe(true);
    expect(resposta.totalCents).toBe(notebook.cents * 10);
  });

  it("filtra o mês, ordena pela data e soma só pendentes e pagas", () => {
    const resposta = montarBase(base, "2026-03-01", { ...filtro, month: 4 });
    expect(resposta.rows.map((linha) => linha.dueDate)).toEqual(["2026-04-05", "2026-04-10"]);
    expect(resposta.totalCents).toBe(salario.cents + notebook.cents);
    expect(resposta.days[0]).toBe(1);
  });

  it("corrige o filtro inválido em vez de confiar na tela", () => {
    const resposta = montarBase(base, "2026-03-01", { ...filtro, year: 2020, month: 13, day: 40 });
    expect(resposta.year).toBe(WORKFLOW_INICIAL.year);
    expect(resposta.month).toBeNull();
    expect(resposta.day).toBeNull();
    expect(resposta.months[0]).toBe(WORKFLOW_INICIAL.month);
  });

  it("busca no texto e respeita o corte do fluxo", () => {
    expect(
      montarBase(base, "2026-03-01", { ...filtro, q: "NOTE" }).rows.every(
        (linha) => linha.entryId === notebook.id,
      ),
    ).toBe(true);
    const corte = montarBase(
      { workflow: { year: 2026, month: 3, day: 6 }, entries: [salario] },
      "2026-03-01",
      { ...filtro, month: 3 },
    );
    expect(corte.rows).toEqual([]);
    expect(corte.days[0]).toBe(6);
  });
});

describe("exclusão pela linha", () => {
  it("apaga o lançamento de um mês só e cancela o mês da série", () => {
    const grade = gradeDoLancamento(notebook);
    expect(removerDaLinha(notebook, grade.slice(0, 1), grade[0]!)).toBe("entry");
    expect(removerDaLinha(notebook, grade, grade[1]!)).toBe("occurrence");
    expect(removerDaLinha({ ...notebook, synced: true }, grade, grade[1]!)).toBeNull();
    const paga = comPrimeiraPaga(notebook).occurrences ?? [];
    expect(removerDaLinha(notebook, paga, paga[0]!)).toBeNull();
  });
});

describe("visão geral", () => {
  it("soma o grupo, os totais do mês e marca o mês em que encerra", () => {
    const resposta = montarGeral({ ...base, entries: [notebook] }, 2026);
    expect(resposta.months[0]).toBe(WORKFLOW_INICIAL.month);
    expect(resposta.groups).toHaveLength(1);
    const [linha] = resposta.groups[0]!.entries;
    expect(linha?.endsIn).toBe(12);
    expect(linha?.totalCents).toBe(notebook.cents * 10);
    expect(resposta.groups[0]!.totalCents).toBe(notebook.cents * 10);
    expect(resposta.totals.outflowsCents).toBe(notebook.cents * 10);
    expect(resposta.totals.inflowsCents).toBe(0);
  });

  it("soma os lançamentos da mesma sessão no mês e mantém uma linha", () => {
    const sessao = "22222222-2222-4222-8222-000000000099";
    const maio = {
      ...salario,
      id: "33333333-3333-4333-8333-000000000091",
      type: "variável" as const,
      sessionId: sessao,
      sessionName: "Mercado",
      cents: 0,
      months: [
        { year: 2026, month: 5, cents: -1_000 },
        { year: 2026, month: 6, cents: -500 },
      ],
    };
    const outro = {
      ...maio,
      id: "33333333-3333-4333-8333-000000000092",
      months: [{ year: 2026, month: 5, cents: -200 }],
    };
    const resposta = montarGeral({ ...base, entries: [maio, outro, notebook] }, 2026);
    const mercado = resposta.groups
      .flatMap((grupo) => grupo.entries)
      .find((linha) => linha.sessionName === "Mercado");
    const maioIndice = resposta.months.indexOf(5);
    const junhoIndice = resposta.months.indexOf(6);
    expect(mercado?.summary).toBe("Soma das transações");
    expect(mercado?.cents[maioIndice]).toBe(-1_200);
    expect(mercado?.cents[junhoIndice]).toBe(-500);
    expect(resposta.groups.flatMap((grupo) => grupo.entries).filter((linha) => linha.id === sessao)).toHaveLength(1);
  });
});

describe("dia no fuso", () => {
  it("usa o fuso do tenant para decidir o dia", () => {
    const agora = new Date("2026-10-24T01:00:00.000Z");
    expect(diaNoFuso("America/Sao_Paulo", agora)).toBe("2026-10-23");
    expect(diaNoFuso("UTC", agora)).toBe("2026-10-24");
  });
});
