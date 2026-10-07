import {
  montarPainel,
  type Compromisso,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

const workflow: Workflow = { year: 2026, month: 3, day: 1 };

function lancamento(parcial: Partial<Lancamento> & Pick<Lancamento, "id" | "cents" | "day">): Lancamento {
  return {
    groupId: "casa",
    groupName: "Casa",
    sessionId: "moradia",
    sessionName: "Moradia",
    type: "fixo",
    description: "Aluguel",
    justification: "",
    startYear: 2026,
    startMonth: 1,
    installments: null,
    months: [],
    ...parcial,
  };
}

function compromisso(day: number, month = 10): Compromisso {
  return {
    id: "consulta",
    title: "Consulta",
    year: 2026,
    month,
    day,
    time: "09:00",
    calendar: "Pessoal",
    category: "unico",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
  };
}

const aluguel = lancamento({ id: "aluguel", cents: -10000, day: 7 });
const mercado = lancamento({
  id: "mercado",
  type: "variável",
  description: "Mercado",
  cents: -3000,
  day: 8,
  months: [{ year: 2026, month: 10, cents: -3000 }],
});

describe("painel do período", () => {
  it("mostra só o dia pedido", () => {
    const painel = montarPainel("dia", 2026, 10, 7, workflow, [aluguel, mercado], [compromisso(7), compromisso(8)]);
    expect(painel.saidas).toBe(-10000);
    expect(painel.lancamentos).toBe(1);
    expect(painel.compromissos).toBe(1);
    expect(painel.items.map((item) => item.title)).toEqual(["Consulta", "Aluguel"]);
    expect(painel.months).toEqual([]);
  });

  it("soma o mês inteiro", () => {
    const painel = montarPainel("mes", 2026, 10, null, workflow, [aluguel, mercado], [compromisso(7)]);
    expect(painel.saidas).toBe(-13000);
    expect(painel.lancamentos).toBe(2);
    expect(painel.compromissos).toBe(1);
    expect(painel.items).toHaveLength(3);
  });

  it("agrupa o ano em meses", () => {
    const painel = montarPainel("ano", 2026, null, null, workflow, [aluguel], [compromisso(7, 10), compromisso(7, 11)]);
    expect(painel.months).toHaveLength(12);
    expect(painel.months[9]).toMatchObject({ month: 10, saidas: -10000, compromissos: 1, lancamentos: 1 });
    expect(painel.months[10]).toMatchObject({ month: 11, saidas: -10000, compromissos: 1 });
    expect(painel.months[0]).toMatchObject({ month: 1, saidas: 0, compromissos: 0, lancamentos: 0 });
    expect(painel.months[2]).toMatchObject({ month: 3, saidas: -10000, lancamentos: 1 });
    expect(painel.items).toEqual([]);
    expect(painel.compromissos).toBe(2);
    expect(painel.saidas).toBe(-100000);
  });
});
