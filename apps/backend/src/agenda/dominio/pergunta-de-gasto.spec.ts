import type { Compromisso, Lancamento, Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { chaveDaResposta, fimParaPergunta, perguntasDeGasto } from "./pergunta-de-gasto.js";

const FUSO = "America/Sao_Paulo";

function compromisso(parcial: Partial<Compromisso>): Compromisso {
  return {
    id: "c1",
    title: "Jantar",
    description: "",
    location: "Centro",
    // 19h às 21h em São Paulo (UTC-3).
    startAt: "2026-11-06T22:00:00.000Z",
    endAt: "2026-11-07T00:00:00.000Z",
    allDay: false,
    status: "undone",
    year: 2026,
    month: 11,
    day: 6,
    time: "19:00",
    endTime: "21:00",
    calendar: "Pessoal",
    timezone: FUSO,
    category: "fixed",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
    sessionId: null,
    sessionLabel: null,
    spentCents: 0,
    askSpending: true,
    ...parcial,
  };
}

function ocorrencia(parcial: Partial<Ocorrencia>): Ocorrencia {
  return { number: 1, dueDate: "2026-11-06", plannedCents: -5000, paidCents: -5000, paidOn: "2026-11-06", status: "completed", ...parcial };
}

const depoisDoJantar = new Date("2026-11-07T00:30:00.000Z");

describe("a pergunta de gasto do compromisso", () => {
  it("pergunta depois do fim, e não antes", () => {
    expect(perguntasDeGasto([compromisso({})], [], new Set(), new Date("2026-11-06T23:30:00.000Z"), new Map())).toEqual([]);
    const [pergunta] = perguntasDeGasto([compromisso({})], [], new Set(), depoisDoJantar, new Map());
    expect(pergunta).toMatchObject({ appointmentId: "c1", date: "2026-11-06", title: "Jantar", endedAtLocal: "21:00", sessionId: null });
  });

  it("não pergunta o que foi desligado, o lembrete de lançamento, nem o que já foi respondido", () => {
    expect(perguntasDeGasto([compromisso({ askSpending: false })], [], new Set(), depoisDoJantar, new Map())).toEqual([]);
    expect(perguntasDeGasto([compromisso({ entryId: "e1" })], [], new Set(), depoisDoJantar, new Map())).toEqual([]);
    expect(perguntasDeGasto([compromisso({})], [], new Set([chaveDaResposta("c1", "2026-11-06")]), depoisDoJantar, new Map())).toEqual([]);
  });

  it("não pergunta quando já há gasto na sessão do compromisso ou um lançamento ligado a ele no dia", () => {
    const naSessao = [{ sessionId: "s1", occurrences: [ocorrencia({})] } as Lancamento];
    expect(perguntasDeGasto([compromisso({ sessionId: "s1" })], naSessao, new Set(), depoisDoJantar, new Map())).toEqual([]);
    const ligado = [{ sessionId: "s9", commitmentId: "c1", occurrences: [ocorrencia({ status: "pending", paidOn: null, paidCents: null })] } as Lancamento];
    expect(perguntasDeGasto([compromisso({})], ligado, new Set(), depoisDoJantar, new Map())).toEqual([]);
  });

  it("o dia inteiro só pergunta com sessão de gastos, às 20h do dia", () => {
    const diaTodo = compromisso({ allDay: true, time: null, endTime: null });
    expect(perguntasDeGasto([diaTodo], [], new Set(), depoisDoJantar, new Map())).toEqual([]);
    const comSessao = { ...diaTodo, sessionId: "s1" };
    expect(fimParaPergunta(comSessao).toISOString()).toBe("2026-11-06T23:00:00.000Z");
    expect(perguntasDeGasto([comSessao], [], new Set(), new Date("2026-11-06T22:59:00.000Z"), new Map())).toEqual([]);
    const [pergunta] = perguntasDeGasto([comSessao], [], new Set(), new Date("2026-11-06T23:00:00.000Z"), new Map([["s1", "Lazer / Saídas"]]));
    expect(pergunta).toMatchObject({ allDay: true, time: null, endedAtLocal: "20:00", sessionLabel: "Lazer / Saídas" });
  });
});
