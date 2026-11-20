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

  it("renova a conta do lançamento e a sessão do compromisso", () => {
    const comConta = pacote((dados) => {
      dados.accounts = [{ id: "c1", name: "Nubank" }];
      (dados.entries as Array<Record<string, unknown>>)[0].accountId = "c1";
      (dados.appointments as Array<Record<string, unknown>>)[0].sessionId = "s1";
    });
    const depois = renovarIdentificadores(ler(comConta));
    expect(depois.accounts[0].id).not.toBe("c1");
    expect(depois.entries[0].accountId).toBe(depois.accounts[0].id);
    expect(depois.appointments[0].sessionId).toBe(depois.sessions[0].id);
  });

  it("recusa lançamento com conta que não está no arquivo", () => {
    const quebrado = pacote((dados) => {
      (dados.entries as Array<Record<string, unknown>>)[0].accountId = "inexistente";
    });
    expect(interpretarPacote(quebrado)).toBe("O arquivo está incompleto ou corrompido.");
  });

  it("renova também as partes de uma linha de extrato dividida", () => {
    const comExtrato = pacote((dados) => {
      dados.accounts = [{ id: "c1", name: "Nubank" }];
      dados.statements = [
        {
          id: "x1",
          accountId: "c1",
          filename: "nubank.csv",
          format: "csv",
          status: "done",
          message: "",
          startDate: null,
          endDate: null,
          lineCount: 1,
          errorCount: 0,
          importedAt: dia,
          content: "",
          contentHash: "h",
          dateColumn: null,
          descriptionColumn: null,
          amountColumn: null,
        },
      ];
      dados.statementLines = [{ statementId: "x1", line: 1, postedOn: null, description: "Mercado", cents: -1000, error: "", entryId: "e1" }];
      dados.statementLineParts = [{ statementId: "x1", line: 1, entryId: "e1", cents: 1000, position: 0 }];
    });
    const depois = renovarIdentificadores(ler(comExtrato));
    const [parte] = depois.statementLineParts;
    expect(parte.statementId).toBe(depois.statements[0].id);
    expect(parte.statementId).toBe(depois.statementLines[0].statementId);
    expect(parte.entryId).toBe(depois.entries[0].id);
  });

  it("recusa parte de linha que aponta para um lançamento fora do arquivo", () => {
    const quebrado = pacote((dados) => {
      dados.statementLineParts = [{ statementId: "x1", line: 1, entryId: "e1", cents: 1, position: 0 }];
    });
    expect(interpretarPacote(quebrado)).toBe("O arquivo está incompleto ou corrompido.");
  });

  it("leva as tarefas e a divisão das metas, e renova os vínculos delas", () => {
    const lido = interpretarPacote({
      app: "finnagent",
      version: 1,
      exportedAt: dia,
      data: {
        ...((pacote() as { data: Record<string, unknown> }).data),
        appointments: [
          { id: "a1", title: "Dentista", description: "", location: "", startAt: dia, endAt: dia, allDay: false, status: "undone", year: 2026, month: 10, day: 5, hour: 10, minute: 0, calendar: "Pessoal", category: "fixed", endYear: null, endMonth: null, endDay: null, entryId: null, sessionId: null, askSpending: true },
        ],
        goals: [{ id: "m1", name: "Viagem", targetCents: 1000, savedCents: 0, dueYear: null, dueMonth: null }],
        tasks: [
          { id: "t2", title: "Filha", date: dia, createdAt: dia, parentId: "t1", appointmentId: null },
          { id: "t1", title: "Mãe", date: dia, createdAt: dia, parentId: null, appointmentId: null },
          { id: "t3", title: "Item do checklist", date: dia, createdAt: dia, parentId: null, appointmentId: "a1" },
        ],
        goalAllocations: [{ goalId: "m1", year: 2026, month: 10, percent: 30 }],
      },
    });
    expect(typeof lido).toBe("object");
    if (typeof lido === "string") return;
    const novos = renovarIdentificadores(lido.data);
    const mae = novos.tasks.find((item) => item.title === "Mãe")!;
    const filha = novos.tasks.find((item) => item.title === "Filha")!;
    const checklist = novos.tasks.find((item) => item.title === "Item do checklist")!;
    expect(filha.parentId).toBe(mae.id);
    expect([mae.id, filha.id].includes("t1")).toBe(false);
    expect(checklist.appointmentId).toBe(novos.appointments[0]!.id);
    expect(novos.goalAllocations[0]!.goalId).toBe(novos.goals[0]!.id);
    expect(novos.goalAllocations[0]!.approvedCents).toBeNull();
  });

  it("recusa tarefa que aponta para mãe ou compromisso fora do arquivo, e divisão de meta sem a meta", () => {
    const base = (pacote() as { data: Record<string, unknown> }).data;
    const com = (extra: Record<string, unknown>) => interpretarPacote({ app: "finnagent", version: 1, exportedAt: dia, data: { ...base, ...extra } });
    const tarefa = { id: "t1", title: "x", date: dia, createdAt: dia };
    expect(com({ tasks: [{ ...tarefa, parentId: "sumiu" }] })).toBe("O arquivo está incompleto ou corrompido.");
    expect(com({ tasks: [{ ...tarefa, appointmentId: "sumiu" }] })).toBe("O arquivo está incompleto ou corrompido.");
    expect(com({ goalAllocations: [{ goalId: "sumiu", year: 2026, month: 10, percent: 10 }] })).toBe("O arquivo está incompleto ou corrompido.");
  });

  it("leva a cobertura entre lançamentos e renova o vínculo", () => {
    const base = (pacote() as { data: Record<string, unknown> }).data;
    const primeiro = (base.entries as Record<string, unknown>[])[0]!;
    const lido = interpretarPacote({
      app: "finnagent",
      version: 1,
      exportedAt: dia,
      data: { ...base, entries: [primeiro, { ...primeiro, id: "e2", name: "Cobre", coveredById: "e1" }] },
    });
    expect(typeof lido).toBe("object");
    if (typeof lido === "string") return;
    const novos = renovarIdentificadores(lido.data);
    const alvo = novos.entries.find((item) => item.name === "Aluguel")!;
    expect(novos.entries.find((item) => item.name === "Cobre")!.coveredById).toBe(alvo.id);
    expect(interpretarPacote({ app: "finnagent", version: 1, exportedAt: dia, data: { ...base, entries: [{ ...primeiro, coveredById: "sumiu" }] } })).toBe(
      "O arquivo está incompleto ou corrompido.",
    );
  });

  it("guarda a ordem dos grupos e das sessões, e completa com zero nos pacotes antigos", () => {
    const base = (pacote() as { data: Record<string, unknown> }).data;
    const comOrdem = interpretarPacote({
      app: "finnagent",
      version: 1,
      exportedAt: dia,
      data: {
        ...base,
        groups: [{ id: "g1", name: "Casa", description: "", position: 3 }],
        sessions: [{ ...(base.sessions as Record<string, unknown>[])[0], position: 2 }],
      },
    });
    expect(typeof comOrdem).toBe("object");
    if (typeof comOrdem === "string") return;
    expect(comOrdem.data.groups[0]!.position).toBe(3);
    expect(comOrdem.data.sessions[0]!.position).toBe(2);
    expect(renovarIdentificadores(comOrdem.data).groups[0]!.position).toBe(3);
    expect(ler(pacote()).groups[0]!.position).toBe(0);
  });

  it("leva as ocorrências feitas dos compromissos que repetem e renova o vínculo", () => {
    const base = (pacote() as { data: Record<string, unknown> }).data;
    const compromisso = (base.appointments as Record<string, unknown>[])[0]!;
    const lido = interpretarPacote({
      app: "finnagent",
      version: 1,
      exportedAt: dia,
      data: { ...base, appointmentDone: [{ appointmentId: compromisso.id, date: dia }] },
    });
    expect(typeof lido).toBe("object");
    if (typeof lido === "string") return;
    const novos = renovarIdentificadores(lido.data);
    expect(novos.appointmentDone[0]!.appointmentId).toBe(novos.appointments[0]!.id);
    expect(interpretarPacote({ app: "finnagent", version: 1, exportedAt: dia, data: { ...base, appointmentDone: [{ appointmentId: "sumiu", date: dia }] } })).toBe(
      "O arquivo está incompleto ou corrompido.",
    );
  });
});
