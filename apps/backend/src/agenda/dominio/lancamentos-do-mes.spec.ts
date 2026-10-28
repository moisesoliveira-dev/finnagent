import type { Lancamento, Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { lancamentosDoMes } from "./lancamentos-do-mes.js";

const workflow = { year: 2026, month: 1, day: 1 };

function ocorrencia(number: number, dueDate: string, extra: Partial<Ocorrencia> = {}): Ocorrencia {
  return { number, dueDate, plannedCents: -10000, paidCents: null, paidOn: null, status: "pending", ...extra };
}

function aluguel(occurrences: Ocorrencia[], extra: Partial<Lancamento> = {}) {
  return {
    id: "aluguel",
    description: "Aluguel",
    groupName: "Casa",
    sessionName: "Contas",
    type: "fixo",
    category: "fixed",
    day: 31,
    cents: -10000,
    startYear: 2026,
    startMonth: 10,
    installments: null,
    months: [],
    adjustments: [],
    recurrence: "monthly",
    recurrenceInterval: 1,
    status: "pending",
    occurrences,
    ...extra,
  } as unknown as Lancamento;
}

describe("vencimentos do mês na agenda", () => {
  // 31/10/2026 é sábado e 02/11 é Finados: com "adiar", o aluguel de outubro vence em 03/11.
  const adiado = aluguel([
    ocorrencia(1, "2026-11-03"),
    ocorrencia(2, "2026-11-30"),
    ocorrencia(3, "2026-12-31"),
  ]);

  it("o vencimento adiado sai do mês de origem", () => {
    expect(lancamentosDoMes({ workflow, entries: [adiado] }, 2026, 10, "2026-10-28")).toEqual([]);
  });

  it("o mês que recebe o vencimento mostra os dois dias, cada um com o seu valor", () => {
    const novembro = lancamentosDoMes({ workflow, entries: [adiado] }, 2026, 11, "2026-10-28");
    expect(novembro.map((item) => [item.day, item.number, item.cents])).toEqual([
      [3, 1, -10000],
      [30, 2, -10000],
    ]);
  });

  it("fixa semanal: um item por semana; cancelada fica de fora e paga usa o valor pago", () => {
    const semanal = aluguel(
      [
        ocorrencia(1, "2026-11-07"),
        ocorrencia(2, "2026-11-14", { status: "completed", paidCents: -9000, paidOn: "2026-11-14" }),
        ocorrencia(3, "2026-11-21", { status: "cancelled" }),
        ocorrencia(4, "2026-11-28"),
      ],
      { recurrence: "weekly", day: 7, startMonth: 11 },
    );
    const novembro = lancamentosDoMes({ workflow, entries: [semanal] }, 2026, 11, "2026-10-28");
    expect(novembro.map((item) => [item.day, item.cents])).toEqual([
      [7, -10000],
      [14, -9000],
      [28, -10000],
    ]);
  });

  it("dois vencimentos no mesmo dia viram um item com a soma", () => {
    const juntos = aluguel([ocorrencia(1, "2026-11-30"), ocorrencia(2, "2026-11-30")]);
    const novembro = lancamentosDoMes({ workflow, entries: [juntos] }, 2026, 11, "2026-10-28");
    expect(novembro.map((item) => [item.day, item.number, item.cents])).toEqual([[30, 1, -20000]]);
  });
});
