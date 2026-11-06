import { describe, expect, it } from "vitest";
import { HojeService } from "./hoje.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";

function ocorrencia(number: number, dueDate: string, cents: number, status: "pending" | "completed" = "pending", paidOn: string | null = null) {
  return { number, dueDate, plannedCents: cents, paidCents: status === "completed" ? cents : null, paidOn, status, kind: "parcela", parcel: number, paymentId: status === "completed" ? "p1" : null };
}

function montar(opcoes: { hoje?: string; semConferir?: number; sobra?: number; separado?: number; limite?: number; gastos?: Array<{ appointmentId: string; sessionId: string | null }> } = {}) {
  const hoje = opcoes.hoje ?? "2026-11-06";
  const tarefas = [
    { id: "t1", title: "Comprar presente", date: "2026-11-06", doneOn: null, position: 0, parentId: null, repeat: null },
    { id: "t0", title: "Ligar para o dentista", date: "2026-11-05", doneOn: null, position: 1, parentId: null, repeat: null },
  ];
  const repositorio = {
    listarDoDia: async (_tenant: string, date: string) => tarefas.filter((item) => item.date <= date),
    criar: async (_tenant: string, id: string, pedido: { title: string; date: string }) => ({ id, ...pedido, doneOn: null, position: 2, parentId: null, repeat: null }),
    atualizar: async () => "ausente" as const,
    concluir: async (_tenant: string, id: string, doneOn: string | null) => ({ ...tarefas[0]!, id, doneOn }),
    excluir: async () => undefined,
  };
  const agenda = {
    perguntasDeGasto: async () => opcoes.gastos ?? [],
    sessoesDeGasto: async () => [{ id: "s1", label: "Casa / Compras" }],
    listar: async () => ({
      appointments: [
        { id: "c1", title: "Dentista", day: 6, time: "09:30", endTime: "10:30", allDay: false, location: "Clínica", calendar: "Pessoal", status: "undone" },
        { id: "c2", title: "Outro dia", day: 7, time: "14:00", endTime: null, allDay: false, location: "", calendar: "Trabalho", status: "undone" },
      ],
    }),
  };
  const financas = {
    hoje: async () => hoje,
    listar: async () => ({
      workflow: { year: 2026, month: 3, day: 1 },
      entries: [
        {
          id: "e1", name: "TV", description: "", groupName: "Casa", sessionName: "Compras", sessionId: "s1", category: "installment", counterparty: "",
          type: "parcela", day: 10, cents: -10000, startYear: 2026, startMonth: 10, installments: 3, months: [],
          occurrences: [ocorrencia(1, "2026-10-10", -10000), ocorrencia(2, "2026-11-06", -10000), ocorrencia(3, "2026-12-10", -10000)],
        },
        {
          id: "e2", name: "Netflix", description: "", groupName: "Assinaturas", sessionName: "Netflix", sessionId: "s2", category: "fixed", counterparty: "",
          type: "fixo", day: 1, cents: -3990, startYear: 2026, startMonth: 1, installments: null, months: [],
          occurrences: [ocorrencia(1, "2026-11-01", -3990, "completed", "2026-11-06")],
        },
      ],
    }),
  };
  const extratos = { semConferir: async () => opcoes.semConferir ?? 0 };
  const metas = {
    listar: async () => ({
      goals: [{ id: "m1" }],
      year: 2026,
      month: 11,
      surplusCents: opcoes.sobra ?? 0,
      monthSurplusCents: opcoes.sobra ?? 0,
      carriedCents: 0,
      separatedCents: opcoes.separado ?? 0,
    }),
  };
  const grupos = {
    listar: async () => ({
      groups: [{ id: "g1", name: "Casa", description: "" }],
      sessions: [{ id: "s1", groupId: "g1", name: "Compras", kind: "acumulo", endedAt: null, limitCents: opcoes.limite ?? null }],
    }),
  };
  return new HojeService(repositorio as never, agenda as never, financas as never, extratos as never, metas as never, grupos as never);
}

describe("o dia da pessoa", () => {
  it("junta tarefas (com as que ficaram de antes), compromissos e vencimentos do dia", async () => {
    const dia = await montar().dia(TENANT);
    expect(dia.date).toBe("2026-11-06");
    expect(dia.tarefas.map((item) => item.id)).toEqual(["t1", "t0"]);
    expect(dia.compromissos.map((item) => item.id)).toEqual(["c1"]);
    // A parcela de outubro atrasada, a recorrente paga hoje e a parcela do dia, nessa ordem de vencimento.
    expect(dia.vencimentos.map((item) => `${item.description}:${item.situation}:${item.series}`)).toEqual(["TV:late:true", "Netflix:completed:false", "TV:pending:true"]);
    expect(dia.vencimentos.find((item) => item.description === "Netflix")?.paymentId).toBe("p1");
  });

  it("só hoje traz as pendências (extrato por conferir e sobra por separar) e os atrasados", async () => {
    const dia = await montar({ semConferir: 12, sobra: 35862 }).dia(TENANT);
    expect(dia.pendencias.map((item) => item.kind)).toEqual(["conferencia", "sobra"]);
    expect(dia.pendencias[0]?.detail).toBe("12 linhas sem lançamento");
    expect(dia.pendencias[1]?.title).toBe("Separar a sobra de novembro para as metas");
    const outroDia = await montar({ semConferir: 12, sobra: 35862 }).dia(TENANT, "2026-11-07");
    expect(outroDia.pendencias).toEqual([]);
    expect(outroDia.vencimentos).toEqual([]);
    expect(outroDia.compromissos.map((item) => item.id)).toEqual(["c2"]);
  });

  it("sobra já separada e extrato conferido não viram pendência", async () => {
    const dia = await montar({ sobra: 35862, separado: 10000 }).dia(TENANT);
    expect(dia.pendencias).toEqual([]);
  });

  it("em hoje, diz o livre até o fim do mês por dia e o uso das sessões com limite", async () => {
    const dia = await montar({ sobra: 50000 }).dia(TENANT);
    // 6 de novembro: faltam 25 dias, contando hoje.
    expect(dia.livre).toEqual({ cents: 50000, monthCents: 50000, carriedCents: 0, separatedCents: 0, daysLeft: 25, perDayCents: 2000 });
    expect(dia.limites).toEqual([]);
    const comLimite = await montar({ limite: 8000 }).dia(TENANT);
    // A parcela de novembro (R$ 100) usa 125% do limite de R$ 80: vira pendência.
    expect(comLimite.limites).toEqual([{ sessionId: "s1", sessionName: "Compras", groupName: "Casa", limitCents: 8000, usedCents: 10000, percent: 125 }]);
    expect(comLimite.pendencias.map((item) => item.kind)).toEqual(["limite"]);
    expect(comLimite.pendencias[0]?.title).toBe("Compras passou do limite de novembro");
    expect((await montar({ sobra: 50000 }).dia(TENANT, "2026-11-07")).livre).toBeNull();
  });

  it("em hoje, traz as perguntas de gasto e as sessões só quando alguma pergunta não tem sessão", async () => {
    const semSessao = await montar({ gastos: [{ appointmentId: "c1", sessionId: null }] }).dia(TENANT);
    expect(semSessao.gastos.map((item) => item.appointmentId)).toEqual(["c1"]);
    expect(semSessao.sessoesParaGasto).toEqual([{ id: "s1", label: "Casa / Compras" }]);
    const comSessao = await montar({ gastos: [{ appointmentId: "c1", sessionId: "s1" }] }).dia(TENANT);
    expect(comSessao.sessoesParaGasto).toEqual([]);
    expect((await montar({ gastos: [{ appointmentId: "c1", sessionId: null }] }).dia(TENANT, "2026-11-07")).gastos).toEqual([]);
  });

  it("conclui a tarefa no dia de hoje da pessoa e reabre com null", async () => {
    const servico = montar({ hoje: "2026-11-06" });
    expect((await servico.concluir(TENANT, "t1", true)).doneOn).toBe("2026-11-06");
    expect((await servico.concluir(TENANT, "t1", false)).doneOn).toBeNull();
  });
});
