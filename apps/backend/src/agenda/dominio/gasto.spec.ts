import type { Lancamento, Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { gastoDoCompromisso } from "./gasto.js";

function ocorrencia(parcial: Partial<Ocorrencia>): Ocorrencia {
  return {
    number: 1,
    dueDate: "2026-10-10",
    plannedCents: -1000,
    paidCents: null,
    paidOn: null,
    status: "completed",
    ...parcial,
  };
}

function lancamento(sessionId: string, occurrences: Ocorrencia[]) {
  return { sessionId, occurrences } as Lancamento;
}

const compromisso = { sessionId: "namorada", year: 2026, month: 10, day: 10 };

describe("gastoDoCompromisso", () => {
  it("soma o que foi pago na sessão no dia do compromisso", () => {
    const entries = [
      lancamento("namorada", [ocorrencia({ paidCents: -8000, paidOn: "2026-10-10" })]),
      lancamento("namorada", [ocorrencia({ plannedCents: -2500, dueDate: "2026-10-10" })]),
    ];
    expect(gastoDoCompromisso(compromisso, entries)).toBe(-10500);
  });

  it("ignora outro dia, outra sessão e o que ainda está pendente", () => {
    const entries = [
      lancamento("namorada", [ocorrencia({ paidOn: "2026-10-11", dueDate: "2026-10-11" })]),
      lancamento("transporte", [ocorrencia({})]),
      lancamento("namorada", [ocorrencia({ status: "pending" })]),
    ];
    expect(gastoDoCompromisso(compromisso, entries)).toBe(0);
  });

  it("sem sessão não acumula nada", () => {
    const entries = [lancamento("namorada", [ocorrencia({})])];
    expect(gastoDoCompromisso({ ...compromisso, sessionId: null }, entries)).toBe(0);
  });
});
