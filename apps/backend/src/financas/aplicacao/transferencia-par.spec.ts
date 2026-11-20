import type { Lancamento } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { ConfiguracoesRepositorio } from "../../configuracoes/portas/configuracoes-repositorio.js";
import type { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import type { PedidoLancamento } from "../dominio/pedido.js";
import type { FinancasRepositorio, NovoLancamento } from "../portas/financas-repositorio.js";
import { FinancasService } from "./financas.service.js";

const sessao = "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01";

function lado(id: string, mode: "inflows" | "outflows", cents: number, pairId: string | null): Lancamento {
  return {
    id,
    sessionId: sessao,
    name: mode === "outflows" ? "Transferência para B" : "Transferência de A",
    description: "",
    justification: "",
    date: "2026-11-20",
    mode,
    status: "completed",
    transactionType: "unusual",
    category: "unique",
    priority: "nopriority",
    cents: mode === "outflows" ? -cents : cents,
    installments: null,
    installmentNumber: null,
    dueDate: null,
    interestRate: null,
    nextDueDate: null,
    recurrence: null,
    recurrenceInterval: null,
    dueRule: null,
    accountId: `conta-${id}`,
    transfer: true,
    pairId,
    months: [],
    adjustments: [],
    occurrences: [],
    day: 20,
    startYear: 2026,
    startMonth: 11,
  } as unknown as Lancamento;
}

function montar(entries: Lancamento[]) {
  const gravados: NovoLancamento[] = [];
  const status: Array<{ id: string; status: string }> = [];
  const repositorio = {
    obter: async (_t: string, id: string) => entries.find((item) => item.id === id) ?? null,
    listar: async () => ({ entries }),
    atualizar: async (_t: string, novo: NovoLancamento) => {
      gravados.push(novo);
      return { id: novo.id } as Lancamento;
    },
    atualizarStatus: async (_t: string, id: string, novo: string) => {
      status.push({ id, status: novo });
      const atual = entries.find((item) => item.id === id) as Lancamento;
      // O motor recusa estornada para pendente: devolve o lançamento como estava.
      if (atual.status === "refunded") return atual;
      const ocorrencia = { number: 1, dueDate: "2026-11-20", plannedCents: 0, paidCents: null, paidOn: null, kind: "parcela" as const, parcel: null, paymentId: null };
      return { ...atual, status: novo, occurrences: [{ ...ocorrencia, status: novo }] } as unknown as Lancamento;
    },
  } as unknown as FinancasRepositorio;
  const configuracoes = { obter: async () => ({ vencimentos: [] }) } as unknown as ConfiguracoesRepositorio;
  const calendario = { ehUtil: () => true, feriados: () => [], feriadoDe: () => [] };
  const feriados = { calendario: async () => calendario } as unknown as FeriadosService;
  return { servico: new FinancasService(repositorio, configuracoes, feriados), gravados, status };
}

const formulario = (id: string, extra: Partial<PedidoLancamento>): PedidoLancamento => ({
  id,
  sessionId: sessao,
  name: "Transferência para B",
  description: "",
  justification: "",
  date: "2026-11-20",
  mode: "outflows",
  status: "completed",
  transactionType: "unusual",
  category: "unique",
  priority: "nopriority",
  cents: 25000,
  installments: null,
  installmentNumber: null,
  dueDate: null,
  interestRate: null,
  nextDueDate: null,
  recurrence: null,
  recurrenceInterval: null,
  dueRule: { tipo: "dia", ordem: null, ajuste: "manter", contagem: "bancaria" },
  ...extra,
});

describe("transferência entre contas", () => {
  it("muda o valor e a data nos dois lados ao editar um", async () => {
    const { servico, gravados } = montar([lado("a", "outflows", 25000, "p1"), lado("b", "inflows", 25000, "p1")]);
    await servico.editar("t", formulario("a", { cents: 30000, date: "2026-11-22" }));
    expect(gravados.map((item) => [item.id, item.cents, item.date, item.mode])).toEqual([
      ["a", -30000, "2026-11-22", "outflows"],
      ["b", 30000, "2026-11-22", "inflows"],
    ]);
  });

  it("não mexe em outro lançamento ao editar um lançamento comum", async () => {
    const { servico, gravados } = montar([lado("a", "outflows", 25000, null), lado("b", "inflows", 25000, null)]);
    await servico.editar("t", formulario("a", { cents: 30000 }));
    expect(gravados.map((item) => item.id)).toEqual(["a"]);
  });

  it("aplica o mesmo status nos dois lados", async () => {
    const { servico, status } = montar([lado("a", "outflows", 25000, "p1"), lado("b", "inflows", 25000, "p1")]);
    await servico.atualizarStatus("t", "a", "refunded");
    expect(status).toEqual([
      { id: "a", status: "refunded" },
      { id: "b", status: "refunded" },
    ]);
  });

  it("recusa a transição de status que o motor não faz, em vez de devolver sucesso", async () => {
    const estornada = { ...lado("a", "outflows", 25000, null), status: "refunded" } as Lancamento;
    const { servico } = montar([estornada]);
    await expect(servico.atualizarStatus("t", "a", "pending")).rejects.toThrow("não pode mudar para esse status");
  });

  it("recusa mudar a categoria ou o movimento na edição", async () => {
    const { servico, gravados } = montar([lado("a", "outflows", 25000, null)]);
    await expect(servico.editar("t", formulario("a", { category: "additional" }))).rejects.toThrow("não podem ser alterados");
    await expect(servico.editar("t", formulario("a", { mode: "inflows" }))).rejects.toThrow("não podem ser alterados");
    expect(gravados).toEqual([]);
  });
});
