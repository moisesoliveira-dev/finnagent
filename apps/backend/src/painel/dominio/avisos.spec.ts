import {
  avisosDe,
  categoriaDoTipo,
  modoDoValor,
  propostaNoPrazo,
  type Compromisso,
  type Lancamento,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

const agora = new Date(2026, 9, 21, 12, 0, 0);

function conta(parcial: Partial<Lancamento> & Pick<Lancamento, "id" | "cents" | "day">): Lancamento {
  const base = {
    groupId: "casa",
    groupName: "Casa",
    sessionId: "moradia",
    sessionName: "Moradia",
    type: "fixo" as const,
    description: "Aluguel",
    justification: "",
    startYear: 2026,
    startMonth: 1,
    installments: null,
    months: [],
    ...parcial,
  };
  return {
    ...base,
    name: base.description,
    date: "2026-01-21",
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
    recurrence: "monthly",
    recurrenceInterval: 1,
    synced: false,
  };
}

function consulta(startAt: string, status: Compromisso["status"] = "undone"): Compromisso {
  return {
    id: "consulta",
    title: "Consulta",
    description: "",
    location: "",
    startAt,
    endAt: startAt,
    allDay: false,
    status,
    year: 2026,
    month: 10,
    day: 21,
    time: "12:30",
    calendar: "Pessoal",
    timezone: "America/Sao_Paulo",
    category: "fixed",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
  };
}

const prefs = {
  reminders: true,
  reminder: "1h" as const,
  dueAlerts: true,
  appAlerts: true,
};

describe("avisos das preferências", () => {
  it("lembra o compromisso dentro da antecedência e o vencimento de hoje", () => {
    const perto = new Date(agora.getTime() + 30 * 60 * 1000).toISOString();
    const avisos = avisosDe(prefs, [consulta(perto)], [conta({ id: "aluguel", cents: -10000, day: 21 })], agora);
    expect(avisos.map((item) => item.kind)).toEqual(["lembrete", "vencimento"]);
  });

  it("ignora compromisso fora da janela ou já cumprido", () => {
    const longe = new Date(agora.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const perto = new Date(agora.getTime() + 20 * 60 * 1000).toISOString();
    const avisos = avisosDe(
      { ...prefs, dueAlerts: false },
      [consulta(longe), consulta(perto, "done")],
      [],
      agora,
    );
    expect(avisos).toEqual([]);
  });

  it("não avisa no aplicativo quando o aviso do aplicativo está desligado", () => {
    const perto = new Date(agora.getTime() + 20 * 60 * 1000).toISOString();
    const avisos = avisosDe(
      { ...prefs, appAlerts: false },
      [consulta(perto)],
      [conta({ id: "aluguel", cents: -10000, day: 21 })],
      agora,
    );
    expect(avisos).toEqual([]);
  });

  it("expira a proposta depois das horas pendentes", () => {
    expect(propostaNoPrazo(new Date(agora.getTime() - 60 * 60 * 1000).toISOString(), 24, agora)).toBe(true);
    expect(propostaNoPrazo(new Date(agora.getTime() - 48 * 60 * 60 * 1000).toISOString(), 24, agora)).toBe(false);
  });
});
