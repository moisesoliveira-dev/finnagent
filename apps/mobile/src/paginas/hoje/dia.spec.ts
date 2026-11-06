import { describe, expect, it } from "vitest";
import type { HojeResposta, Tarefa } from "@finnagent/contracts";
import { andamento, ehData, filhasDe, resumoDoDia, rotaDaPendencia, rotuloDoDia, somarDias } from "./dia";

const tarefa = (id: string, extra: Partial<Tarefa> = {}): Tarefa => ({ id, title: id, date: "2026-11-06", doneOn: null, position: 0, parentId: null, repeat: null, ...extra });

const dia: HojeResposta = {
  date: "2026-11-06",
  today: "2026-11-06",
  tarefas: [tarefa("b", { position: 1 }), tarefa("a", { position: 0 }), tarefa("a1", { parentId: "a", doneOn: "2026-11-06" }), tarefa("c", { doneOn: "2026-11-05", position: 2 })],
  compromissos: [
    { id: "c1", title: "Dentista", time: "14:00", endTime: null, allDay: false, location: "", calendar: "Pessoal", status: "undone" },
    { id: "c2", title: "Reunião", time: null, endTime: null, allDay: true, location: "", calendar: "Trabalho", status: "done" },
  ],
  vencimentos: [
    { entryId: "e1", number: 1, description: "Luz", groupName: "Casa", sessionName: "Contas", category: "fixed", cents: -12000, situation: "late", dueDate: "2026-11-02", series: false, paymentId: null, counterparty: "" },
    { entryId: "e2", number: 1, description: "Internet", groupName: "Casa", sessionName: "Contas", category: "fixed", cents: -9900, situation: "completed", dueDate: "2026-11-06", series: false, paymentId: null, counterparty: "" },
  ],
  pendencias: [{ id: "p1", kind: "conferencia", title: "3 linhas sem lançamento", detail: "Conferir", href: "/extratos/conferencia" }],
  livre: null,
  limites: [],
};

describe("dia", () => {
  it("soma dias virando o mês e o ano", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(ehData("2026-11-06")).toBe(true);
    expect(ehData("ontem")).toBe(false);
  });

  it("escreve o dia em português com a inicial maiúscula", () => {
    expect(rotuloDoDia("2026-11-06")).toMatch(/^Sexta-feira, 6 de novembro$/);
  });

  it("conta o que foi feito de tudo o que o dia tem", () => {
    // Compromissos: 1 de 2. Vencimentos: 1 de 2. Tarefas (com subatividades): 2 de 4.
    expect(andamento(dia)).toEqual({ feitas: 4, total: 8 });
  });

  it("devolve as filhas na ordem da posição", () => {
    expect(filhasDe(dia.tarefas, null).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(filhasDe(dia.tarefas, "a").map((item) => item.id)).toEqual(["a1"]);
  });

  it("leva a pendência para a aba do app", () => {
    expect(rotaDaPendencia("/extratos/conferencia")).toBe("/extratos?aba=conferencia");
    expect(rotaDaPendencia("/metas")).toBe("/metas");
  });

  it("resume o dia: atrasado primeiro, só as raízes abertas, até o limite", () => {
    const linhas = resumoDoDia(dia, 10);
    expect(linhas.map((item) => item.titulo)).toEqual(["Luz", "Dentista", "Reunião", "Internet", "a", "b", "3 linhas sem lançamento"]);
    expect(linhas[0]?.detalhe).toBe("Venceu em 2 de nov");
    expect(resumoDoDia(dia, 2)).toHaveLength(2);
  });
});
