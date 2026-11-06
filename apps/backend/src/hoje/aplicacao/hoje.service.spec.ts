import { describe, expect, it } from "vitest";
import { HojeService } from "./hoje.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";

function ocorrencia(number: number, dueDate: string, cents: number, status: "pending" | "completed" = "pending", paidOn: string | null = null) {
  return { number, dueDate, plannedCents: cents, paidCents: status === "completed" ? cents : null, paidOn, status, kind: "parcela", parcel: number, paymentId: status === "completed" ? "p1" : null };
}

function montar(opcoes: { hoje?: string; semConferir?: number; sobra?: number; separado?: number } = {}) {
  const hoje = opcoes.hoje ?? "2026-11-06";
  const tarefas = [
    { id: "t1", title: "Comprar presente", date: "2026-11-06", doneOn: null, position: 0 },
    { id: "t0", title: "Ligar para o dentista", date: "2026-11-05", doneOn: null, position: 1 },
  ];
  const repositorio = {
    listarDoDia: async (_tenant: string, date: string) => tarefas.filter((item) => item.date <= date),
    criar: async (_tenant: string, id: string, pedido: { title: string; date: string }) => ({ id, ...pedido, doneOn: null, position: 2 }),
    atualizar: async () => "ausente" as const,
    concluir: async (_tenant: string, id: string, doneOn: string | null) => ({ ...tarefas[0]!, id, doneOn }),
    excluir: async () => undefined,
  };
  const agenda = {
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
          id: "e1", name: "TV", description: "", groupName: "Casa", sessionName: "Compras", category: "installment", counterparty: "",
          occurrences: [ocorrencia(1, "2026-10-10", -10000), ocorrencia(2, "2026-11-06", -10000), ocorrencia(3, "2026-12-10", -10000)],
        },
        {
          id: "e2", name: "Netflix", description: "", groupName: "Assinaturas", sessionName: "Netflix", category: "fixed", counterparty: "",
          occurrences: [ocorrencia(1, "2026-11-01", -3990, "completed", "2026-11-06")],
        },
      ],
    }),
  };
  const extratos = { semConferir: async () => opcoes.semConferir ?? 0 };
  const metas = {
    listar: async () => ({ goals: [{ id: "m1" }], year: 2026, month: 11, surplusCents: opcoes.sobra ?? 0, separatedCents: opcoes.separado ?? 0 }),
  };
  return new HojeService(repositorio as never, agenda as never, financas as never, extratos as never, metas as never);
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

  it("conclui a tarefa no dia de hoje da pessoa e reabre com null", async () => {
    const servico = montar({ hoje: "2026-11-06" });
    expect((await servico.concluir(TENANT, "t1", true)).doneOn).toBe("2026-11-06");
    expect((await servico.concluir(TENANT, "t1", false)).doneOn).toBeNull();
  });
});
