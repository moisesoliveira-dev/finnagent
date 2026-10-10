import {
  categoriaDoTipo,
  modoDoValor,
  montarRelatorio,
  type Lancamento,
  type Workflow,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

const workflow: Workflow = { year: 2026, month: 3, day: 1 };

function lancamento(parcial: Partial<Lancamento> & Pick<Lancamento, "id" | "type" | "cents">): Lancamento {
  const base = {
    groupId: "casa",
    groupName: "Casa",
    sessionId: "moradia",
    sessionName: "Moradia",
    description: "Lançamento",
    justification: "",
    day: 1,
    startYear: 2026,
    startMonth: 1,
    installments: null,
    months: [],
    ...parcial,
  };
  return {
    ...base,
    name: base.description,
    date: "2026-01-01",
    mode: modoDoValor(base.cents),
    status: "pending",
    transactionType: "unusual",
    category: categoriaDoTipo(base.type),
    priority: "normal",
    installmentNumber: null,
    dueDate: null,
    interestRate: null,
    nextDueDate: null,
    suspendedCents: 0,
    commitmentId: null,
    adjustments: [],
    recurrence: base.type === "fixo" ? "monthly" : null,
    recurrenceInterval: base.type === "fixo" ? 1 : null,
  };
}

describe("relatório do ano", () => {
  const entradas = lancamento({
    id: "salario",
    groupId: "trabalho",
    groupName: "Trabalho",
    sessionName: "Renda",
    type: "adicional",
    cents: 25000,
    months: [{ year: 2026, month: 3, cents: 25000 }],
  });
  const aluguel = lancamento({
    id: "aluguel",
    type: "fixo",
    cents: -10000,
    description: "Aluguel",
  });
  const mercado = lancamento({
    id: "mercado",
    type: "variável",
    cents: -3000,
    description: "Mercado",
    months: [{ year: 2026, month: 4, cents: -3000 }],
  });

  it("soma os meses visíveis e separa grupo e tipo", () => {
    const relatorio = montarRelatorio([entradas, aluguel, mercado], workflow, 2026);
    expect(relatorio?.months).toHaveLength(10);
    expect(relatorio?.months[0]).toEqual({ month: 3, entradas: 25000, saidas: -10000, sobra: 15000 });
    expect(relatorio?.months[1]).toEqual({ month: 4, entradas: 0, saidas: -13000, sobra: -13000 });
    expect(relatorio?.entradas).toBe(25000);
    expect(relatorio?.saidas).toBe(-103000);
    expect(relatorio?.sobra).toBe(-78000);
    expect(relatorio?.groups.map((grupo) => grupo.name)).toEqual(["Casa", "Trabalho"]);
    expect(relatorio?.groups[0]).toMatchObject({ saidas: -103000, entradas: 0 });
    expect(relatorio?.types.map((tipo) => tipo.type)).toEqual(["adicional", "fixo", "variável"]);
  });

  it("não monta um ano anterior ao workflow", () => {
    expect(montarRelatorio([aluguel], workflow, 2025)).toBeNull();
  });

  it("corta o mês inicial quando o dia do lançamento é anterior ao workflow", () => {
    const relatorio = montarRelatorio(
      [lancamento({ id: "tarde", type: "fixo", cents: -10000, day: 5 })],
      { year: 2026, month: 3, day: 10 },
      2026,
    );
    expect(relatorio?.months[0]).toEqual({ month: 3, entradas: 0, saidas: 0, sobra: 0 });
    expect(relatorio?.saidas).toBe(-90000);
  });
});
