import {
  PADROES_DE_VENCIMENTO_INICIAIS,
  REGRA_SEM_AJUSTE,
  type CalendarioDeDiasUteis,
  type Lancamento,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { ConfiguracoesRepositorio } from "../../configuracoes/portas/configuracoes-repositorio.js";
import type { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import type { PedidoLancamento } from "../dominio/pedido.js";
import { normalizarPedido } from "../dominio/pedido.js";
import type { FinancasRepositorio, NovoLancamento } from "../portas/financas-repositorio.js";
import { FinancasService } from "./financas.service.js";

const sessao = "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01";

function pedido(extra: Partial<PedidoLancamento>): PedidoLancamento {
  return {
    id: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a02",
    sessionId: sessao,
    name: "Salário",
    description: "",
    justification: "Trabalho",
    date: "2026-10-30",
    mode: "inflows",
    status: "pending",
    transactionType: "unusual",
    category: "fixed",
    priority: "nopriority",
    cents: 500000,
    installments: null,
    installmentNumber: null,
    dueDate: null,
    interestRate: null,
    nextDueDate: "2026-10-30",
    recurrence: "monthly",
    recurrenceInterval: 1,
    dueRule: null,
    ...extra,
  };
}

function montar(vencimentos = PADROES_DE_VENCIMENTO_INICIAIS) {
  const criados: Array<{ pedido: NovoLancamento; calendario: CalendarioDeDiasUteis }> = [];
  const repositorio = {
    criar: async (_tenantId: string, novo: NovoLancamento, calendario: CalendarioDeDiasUteis) => {
      criados.push({ pedido: novo, calendario });
      return { id: novo.id } as Lancamento;
    },
  } as unknown as FinancasRepositorio;
  const configuracoes = { obter: async () => ({ vencimentos }) } as unknown as ConfiguracoesRepositorio;
  const calendario = { ehUtil: () => true, feriados: () => [], feriadoDe: () => [] };
  const feriados = { calendario: async () => calendario } as unknown as FeriadosService;
  return { servico: new FinancasService(repositorio, configuracoes, feriados), criados, calendario };
}

describe("regra de vencimento ao lançar", () => {
  it("sem regra escolhida, aplica o padrão da categoria nas configurações", async () => {
    const { servico, criados } = montar();
    await servico.registrar("t", pedido({}));
    expect(criados[0].pedido.dueRule).toMatchObject({ tipo: "dia", ajuste: "antecipar" });
    await servico.registrar("t", pedido({ mode: "outflows", name: "Aluguel" }));
    expect(criados[1].pedido.dueRule.ajuste).toBe("adiar");
  });

  it("segue o padrão que a pessoa mudou nas configurações", async () => {
    const { servico, criados } = montar({ ...PADROES_DE_VENCIMENTO_INICIAIS, fixa_entrada: "adiar_no_mes" });
    await servico.registrar("t", pedido({}));
    expect(criados[0].pedido.dueRule.ajuste).toBe("adiar_no_mes");
  });

  it("respeita a regra escolhida e calcula com o calendário da conta", async () => {
    const { servico, criados, calendario } = montar();
    await servico.registrar("t", pedido({ dueRule: { tipo: "dia_util", ordem: 5, ajuste: "antecipar", contagem: "clt" } }));
    expect(criados[0].pedido.dueRule).toEqual({ tipo: "dia_util", ordem: 5, ajuste: "antecipar", contagem: "clt" });
    expect(criados[0].calendario).toBe(calendario);
  });

  it("lançamento único não tem regra, mesmo que venha uma", async () => {
    const { servico, criados } = montar();
    await servico.registrar(
      "t",
      pedido({ category: "unique", recurrence: null, recurrenceInterval: null, nextDueDate: null, dueRule: { tipo: "dia", ordem: null, ajuste: "adiar", contagem: "bancaria" } }),
    );
    expect(criados[0].pedido.dueRule).toEqual(REGRA_SEM_AJUSTE);
  });
});

describe("normalização da regra", () => {
  it("fixa semanal não aceita Nº dia útil: vira o dia com ajuste", () => {
    const normal = normalizarPedido(pedido({ recurrence: "weekly", dueRule: { tipo: "dia_util", ordem: 5, ajuste: "adiar", contagem: "clt" } }));
    expect(normal.dueRule).toEqual({ tipo: "dia", ordem: null, ajuste: "adiar", contagem: "bancaria" });
  });

  it("a ordem só fica no Nº dia útil, e a contagem da CLT só nele", () => {
    expect(normalizarPedido(pedido({ dueRule: { tipo: "dia", ordem: 3, ajuste: "adiar", contagem: "clt" } })).dueRule).toEqual({
      tipo: "dia",
      ordem: null,
      ajuste: "adiar",
      contagem: "bancaria",
    });
    expect(normalizarPedido(pedido({ dueRule: { tipo: "ultimo_dia_util", ordem: 3, ajuste: "manter", contagem: "clt" } })).dueRule).toEqual({
      tipo: "ultimo_dia_util",
      ordem: null,
      ajuste: "antecipar",
      contagem: "bancaria",
    });
  });
});
