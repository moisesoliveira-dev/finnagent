import { describe, expect, it } from "vitest";
import { interpretarPacote, renovarIdentificadores, resumoDe, type DadosDoPacote } from "./pacote.js";

const dia = "2026-10-05T00:00:00.000Z";

function pacote(alterar: (dados: Record<string, unknown>) => void = () => {}) {
  const dados: Record<string, unknown> = {
    groups: [{ id: "g1", name: "Casa", description: "" }],
    sessions: [
      {
        id: "s1",
        groupId: "g1",
        name: "Outubro",
        description: "",
        justification: "",
        startedAt: dia,
        endedAt: null,
        cents: 0,
        kind: "acumulo",
      },
    ],
    entries: [
      {
        id: "e1",
        sessionId: "s1",
        type: "fixa",
        description: "",
        justification: "",
        day: 5,
        cents: 1000,
        startYear: 2026,
        startMonth: 10,
        installments: null,
        position: 0,
        name: "Aluguel",
        occurredOn: dia,
        mode: "outflows",
        status: "pending",
        transactionType: "appointment",
        category: "fixed",
        priority: "nopriority",
        installmentNumber: null,
        dueOn: null,
        interestBps: null,
        nextDueOn: null,
        suspendedCents: 0,
        commitmentId: "a1",
        recurrence: null,
        recurrenceInterval: null,
      },
    ],
    entryAmounts: [{ entryId: "e1", year: 2026, month: 10, cents: 1200 }],
    appointments: [
      {
        id: "a1",
        title: "Aluguel",
        description: "",
        location: "",
        startAt: dia,
        endAt: dia,
        allDay: true,
        status: "undone",
        year: 2026,
        month: 10,
        day: 5,
        hour: null,
        minute: null,
        calendar: "Pessoal",
        category: "fixed",
        endYear: null,
        endMonth: null,
        endDay: null,
        entryId: "e1",
      },
    ],
  };
  alterar(dados);
  return { app: "finnagent", version: 1, exportedAt: dia, data: dados };
}

function ler(corpo: unknown): DadosDoPacote {
  const lido = interpretarPacote(corpo);
  if (typeof lido === "string") throw new Error(lido);
  return lido.data;
}

describe("pacote de dados", () => {
  it("lê o arquivo, converte as datas e completa o que faltou com vazio", () => {
    const dados = ler(pacote());
    expect(dados.entries[0].occurredOn).toBeInstanceOf(Date);
    expect(dados.goals).toEqual([]);
    expect(dados.preferences).toBeNull();
  });

  it("recusa o que não é uma exportação do Prumo", () => {
    expect(interpretarPacote({ qualquer: "coisa" })).toBe("Este arquivo não é uma exportação do Prumo.");
    expect(interpretarPacote(null)).toBe("Este arquivo não é uma exportação do Prumo.");
  });

  it("recusa um pacote de versão mais nova", () => {
    const novo = { ...pacote(), version: 99 };
    expect(interpretarPacote(novo)).toBe("Este arquivo foi gerado por uma versão mais nova do Prumo.");
  });

  it("recusa referência para algo que não está no arquivo", () => {
    const quebrado = pacote((dados) => {
      dados.entryAmounts = [{ entryId: "inexistente", year: 2026, month: 10, cents: 1 }];
    });
    expect(interpretarPacote(quebrado)).toBe("O arquivo está incompleto ou corrompido.");
  });

  it("recusa campo com tipo errado", () => {
    const quebrado = pacote((dados) => {
      dados.groups = [{ id: "g1", name: 3, description: "" }];
    });
    expect(interpretarPacote(quebrado)).toBe("O arquivo está incompleto ou corrompido.");
  });

  it("renova os ids sem perder os vínculos entre os registros", () => {
    const antes = ler(pacote());
    const depois = renovarIdentificadores(antes);
    const [grupo] = depois.groups;
    const [sessao] = depois.sessions;
    const [lancamento] = depois.entries;
    const [compromisso] = depois.appointments;
    expect(grupo.id).not.toBe("g1");
    expect(sessao.groupId).toBe(grupo.id);
    expect(lancamento.sessionId).toBe(sessao.id);
    expect(lancamento.commitmentId).toBe(compromisso.id);
    expect(compromisso.entryId).toBe(lancamento.id);
    expect(depois.entryAmounts[0].entryId).toBe(lancamento.id);
    expect(resumoDe(depois)).toMatchObject({ groups: 1, sessions: 1, entries: 1, appointments: 1 });
  });
});
