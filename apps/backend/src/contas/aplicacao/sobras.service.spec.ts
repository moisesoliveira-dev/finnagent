import { describe, expect, it } from "vitest";
import { sobrasALevar, sobraAcumulada, totaisDoMes, type Lancamento } from "@finnagent/contracts";
import { EXEMPLO } from "../../financas/dominio/exemplo.js";
import { SobrasService } from "./sobras.service.js";

const workflow = { year: 2026, month: 9, day: 1 };
const pago = (dia: string, cents: number) => [{ number: 1, dueDate: dia, plannedCents: cents, paidCents: cents, paidOn: dia, status: "completed" as const }];
const lancamento = (parcial: Partial<Lancamento>): Lancamento =>
  ({ ...EXEMPLO[0]!, id: crypto.randomUUID(), category: "unique", accountId: null, transfer: false, coveredById: null, ...parcial }) as Lancamento;

describe("a sobra levada de mês em mês", () => {
  const entries = [
    lancamento({ day: 5, startYear: 2026, startMonth: 9, cents: 100_000, occurrences: pago("2026-09-05", 100_000) }),
    lancamento({ day: 10, startYear: 2026, startMonth: 9, cents: -30_000, occurrences: pago("2026-09-10", -30_000) }),
    lancamento({ day: 12, startYear: 2026, startMonth: 10, cents: -90_000, occurrences: pago("2026-10-12", -90_000) }),
  ];

  it("cada mês recebe a sobra acumulada até o anterior, e a falta também", () => {
    expect(sobrasALevar(entries, workflow, "2026-11-09")).toEqual([
      { de: "2026-09", para: "2026-10", cents: 70_000 },
      { de: "2026-10", para: "2026-11", cents: -20_000 },
    ]);
  });

  it("a sobra levada entra no mês seguinte e não dobra a acumulada", () => {
    const comSobras = [
      ...entries,
      lancamento({ day: 1, startYear: 2026, startMonth: 10, cents: 70_000, carryOf: "2026-09", occurrences: pago("2026-10-01", 70_000) }),
      lancamento({ day: 1, startYear: 2026, startMonth: 11, cents: -20_000, carryOf: "2026-10", occurrences: pago("2026-11-01", -20_000) }),
    ];
    expect(totaisDoMes(comSobras, workflow, 2026, 10).sobra).toBe(-20_000);
    expect(sobraAcumulada(comSobras, workflow, 2026, 10)).toBe(-20_000);
    expect(sobrasALevar(comSobras, workflow, "2026-11-09")).toEqual(sobrasALevar(entries, workflow, "2026-11-09"));
  });
});

describe("o serviço das sobras", () => {
  function montar(entries: Lancamento[]) {
    const chamadas: string[] = [];
    const financas = {
      listar: async () => ({ workflow, entries }),
      hoje: async () => "2026-11-09",
      excluir: async (_t: string, id: string) => void chamadas.push(`excluir:${id}`),
      registrar: async (_t: string, pedido: { name: string; cents: number; mode: string; date: string; carryOf: string }) =>
        void chamadas.push(`registrar:${pedido.carryOf}:${pedido.mode}:${pedido.cents}:${pedido.date}:${pedido.name}`),
    };
    const grupos = {
      listar: async () => ({ groups: [{ id: "g", name: "Conta" }], sessions: [{ id: "s", groupId: "g", name: "Sobras", endedAt: null }] }),
    };
    return { servico: new SobrasService(financas as never, grupos as never), chamadas };
  }

  it("cria a sobra que falta, corrige a que mudou e apaga a que não vale mais", async () => {
    const base = [lancamento({ day: 5, startYear: 2026, startMonth: 9, cents: 50_000, occurrences: pago("2026-09-05", 50_000) })];
    const errada = lancamento({ id: "velha", day: 1, startYear: 2026, startMonth: 10, cents: 10_000, carryOf: "2026-09", occurrences: pago("2026-10-01", 10_000) });
    const sobrando = lancamento({ id: "antiga", day: 1, startYear: 2026, startMonth: 9, cents: 5_000, carryOf: "2026-08", occurrences: pago("2026-09-01", 5_000) });
    const { servico, chamadas } = montar([...base, { ...errada, date: "2026-10-01" }, sobrando]);
    await servico.atualizar("t");
    expect(chamadas).toEqual([
      "excluir:velha",
      "registrar:2026-09:inflows:50000:2026-10-01:Sobra de setembro de 2026",
      "registrar:2026-10:inflows:50000:2026-11-01:Sobra de outubro de 2026",
      "excluir:antiga",
    ]);
  });

  it("a sobra que já está certa não é regravada", async () => {
    const base = [lancamento({ day: 5, startYear: 2026, startMonth: 9, cents: 50_000, occurrences: pago("2026-09-05", 50_000) })];
    const certas = [
      { ...lancamento({ day: 1, startYear: 2026, startMonth: 10, cents: 50_000, carryOf: "2026-09", occurrences: pago("2026-10-01", 50_000) }), date: "2026-10-01" },
      { ...lancamento({ day: 1, startYear: 2026, startMonth: 11, cents: 50_000, carryOf: "2026-10", occurrences: pago("2026-11-01", 50_000) }), date: "2026-11-01" },
    ];
    const { servico, chamadas } = montar([...base, ...certas]);
    await servico.atualizar("t");
    expect(chamadas).toEqual([]);
  });
});
