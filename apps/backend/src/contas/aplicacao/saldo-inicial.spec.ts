import type { Caixinha, Conta, Lancamento, PedidoDeCaixinha, PedidoDeConta } from "@finnagent/contracts";
import { SESSAO_DOS_AJUSTES, primeiroSaldoInformado } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { EXEMPLO } from "../../financas/dominio/exemplo.js";
import { CaixinhasService } from "./caixinhas.service.js";
import { ContasService } from "./contas.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";
const HOJE = "2026-11-12";

const conta: Conta = { id: "c1", name: "Banco", kind: "conta", openingCents: 0, openingOn: null, closingDay: null, dueDay: null, limitCents: null };
const caixinha: Caixinha = { id: "cx", accountId: "c1", name: "Reserva", openingCents: 0, openingOn: null, sessionId: "s-cx", goalId: null };

const pago = (dia: string, cents: number) => [{ number: 1, dueDate: dia, plannedCents: cents, paidCents: cents, paidOn: dia, status: "completed" as const }];
const lancamento = (parcial: Partial<Lancamento>): Lancamento => ({ ...EXEMPLO[0]!, id: crypto.randomUUID(), ...parcial });
const ajusteAnterior = (parcial: Partial<Lancamento> = {}) =>
  lancamento({ accountId: conta.id, sessionName: SESSAO_DOS_AJUSTES, occurrences: pago("2026-11-01", 1_000), ...parcial });

describe("primeiroSaldoInformado: quando a diferença é o que já estava lá", () => {
  const foiInformado = (entry: Lancamento) => entry.sessionName === SESSAO_DOS_AJUSTES;

  it("saldo inicial zero e nenhum saldo informado antes: é a primeira vez, mesmo com movimentos lançados", () => {
    const movimento = lancamento({ accountId: conta.id, occurrences: pago("2026-11-05", -5_000) });
    expect(primeiroSaldoInformado(0, [], foiInformado)).toBe(true);
    expect(primeiroSaldoInformado(0, [movimento], foiInformado)).toBe(true);
  });

  it("com saldo inicial já definido, ou com um ajuste antes, não é mais a primeira vez", () => {
    expect(primeiroSaldoInformado(100_000, [], foiInformado)).toBe(false);
    expect(primeiroSaldoInformado(0, [ajusteAnterior()], foiInformado)).toBe(false);
  });
});

describe("conferir o saldo da conta", () => {
  function servico(entries: Lancamento[], atual: Conta = conta) {
    const gravacoes: PedidoDeConta[] = [];
    const registrados: unknown[] = [];
    const repo = {
      listar: async () => [atual],
      atualizar: async (_tenant: string, _id: string, pedido: PedidoDeConta) => {
        gravacoes.push(pedido);
        return { ...atual, ...pedido };
      },
    };
    const financas = {
      listar: async () => ({ entries }),
      hoje: async () => HOJE,
      registrar: async (_tenant: string, pedido: unknown) => {
        registrados.push(pedido);
        return { id: "novo", ...(pedido as object) };
      },
    };
    const grupos = { listar: async () => ({ groups: [{ id: "g", name: "Ajustes" }], sessions: [{ id: "s", groupId: "g", name: "Ajustes de saldo", endedAt: null }] }) };
    return { servico: new ContasService(repo as never, { listar: async () => [] } as never, financas as never, grupos as never), gravacoes, registrados };
  }

  it("na primeira vez, a conta sem nenhum movimento ganha o saldo informado como saldo inicial", async () => {
    const { servico: contas, gravacoes, registrados } = servico([]);
    const resultado = await contas.ajustarSaldo(TENANT, conta.id, { saldoCents: 500_000, date: HOJE, foraDaSobra: false });
    expect(resultado).toEqual({ diferencaCents: 500_000, entry: null, comoSaldoInicial: true });
    expect(registrados).toEqual([]);
    expect(gravacoes).toEqual([expect.objectContaining({ name: "Banco", kind: "conta", openingCents: 500_000, openingOn: null })]);
  });

  it("com movimentos já lançados dos extratos, o saldo inicial é o que falta para bater, e nada entra no mês", async () => {
    // Os extratos já trouxeram uma saída de R$ 100 e uma entrada de R$ 30: o saldo calculado é −R$ 70.
    const movimentos = [
      lancamento({ accountId: conta.id, occurrences: pago("2026-11-05", -10_000) }),
      lancamento({ accountId: conta.id, occurrences: pago("2026-11-08", 3_000) }),
    ];
    const { servico: contas, gravacoes, registrados } = servico(movimentos);
    const resultado = await contas.ajustarSaldo(TENANT, conta.id, { saldoCents: 500_000, date: HOJE, foraDaSobra: false });
    expect(resultado).toEqual({ diferencaCents: 507_000, entry: null, comoSaldoInicial: true });
    expect(registrados).toEqual([]);
    // O saldo inicial de R$ 5.070 mais os movimentos (−R$ 70) dá os R$ 5.000 que o banco mostra.
    expect(gravacoes[0]?.openingCents).toBe(507_000);
  });

  it("depois de um ajuste, ou com saldo inicial definido, a diferença continua sendo um ajuste lançado", async () => {
    const depoisDeAjuste = servico([ajusteAnterior({ occurrences: pago("2026-11-01", 100_000) })]);
    const resultado = await depoisDeAjuste.servico.ajustarSaldo(TENANT, conta.id, { saldoCents: 130_000, date: HOJE, foraDaSobra: false });
    expect(resultado.comoSaldoInicial).toBeUndefined();
    expect(resultado.diferencaCents).toBe(30_000);
    expect(depoisDeAjuste.registrados).toHaveLength(1);
    expect(depoisDeAjuste.gravacoes).toEqual([]);

    const comSaldoInicial = servico([], { ...conta, openingCents: 7_000, openingOn: "2026-11-01" });
    const outro = await comSaldoInicial.servico.ajustarSaldo(TENANT, conta.id, { saldoCents: 9_000, date: HOJE, foraDaSobra: false });
    expect(outro.comoSaldoInicial).toBeUndefined();
    expect(comSaldoInicial.registrados).toHaveLength(1);
  });

  it("saldo que já bate não faz nada", async () => {
    const { servico: contas, gravacoes, registrados } = servico([], { ...conta, openingCents: 7_000, openingOn: "2026-11-01" });
    expect(await contas.ajustarSaldo(TENANT, conta.id, { saldoCents: 7_000, date: HOJE, foraDaSobra: false })).toEqual({ diferencaCents: 0, entry: null });
    expect(registrados).toEqual([]);
    expect(gravacoes).toEqual([]);
  });
});

describe("informar o saldo da caixinha", () => {
  function servico(entries: Lancamento[], atual: Caixinha = caixinha) {
    const gravacoes: PedidoDeCaixinha[] = [];
    const registrados: Array<{ mode?: string; cents?: number; name?: string }> = [];
    const repo = {
      obter: async () => atual,
      atualizar: async (_tenant: string, _id: string, pedido: PedidoDeCaixinha) => {
        gravacoes.push(pedido);
        return { ...atual, ...pedido };
      },
    };
    const financas = {
      listar: async () => ({ entries }),
      hoje: async () => HOJE,
      registrar: async (_tenant: string, pedido: { mode?: string; cents?: number; name?: string }) => {
        registrados.push(pedido);
        return { id: "novo", ...pedido };
      },
    };
    return { servico: new CaixinhasService(repo as never, { listar: async () => [] } as never, {} as never, financas as never), gravacoes, registrados };
  }

  it("na primeira vez, o saldo informado é o que já estava lá: saldo inicial, e não rendimento de entrada", async () => {
    const { servico: caixinhas, gravacoes, registrados } = servico([]);
    const resultado = await caixinhas.informarSaldo(TENANT, caixinha.id, { saldoCents: 1_000_000, date: HOJE });
    expect(resultado).toEqual({ diferencaCents: 1_000_000, entry: null, comoSaldoInicial: true });
    expect(registrados).toEqual([]);
    expect(gravacoes).toEqual([{ name: "Reserva", openingCents: 1_000_000, openingOn: null, goalId: null }]);
  });

  it("com aplicações já lançadas, o saldo inicial é só o que falta para bater: o aplicado não é contado duas vezes", async () => {
    const aplicacao = lancamento({ sessionId: caixinha.sessionId, accountId: "c1", transfer: true, occurrences: pago("2026-11-03", -50_000) });
    const { servico: caixinhas, gravacoes, registrados } = servico([aplicacao]);
    // A caixinha mostra R$ 10.000: R$ 500 foram aplicados aqui, então R$ 9.500 já estavam lá.
    const resultado = await caixinhas.informarSaldo(TENANT, caixinha.id, { saldoCents: 1_000_000, date: HOJE });
    expect(resultado.comoSaldoInicial).toBe(true);
    expect(registrados).toEqual([]);
    expect(gravacoes[0]?.openingCents).toBe(950_000);
  });

  it("a meta ligada à caixinha continua ligada quando o saldo vira saldo inicial", async () => {
    const { servico: caixinhas, gravacoes } = servico([], { ...caixinha, goalId: "meta-1" });
    await caixinhas.informarSaldo(TENANT, caixinha.id, { saldoCents: 50_000, date: HOJE });
    expect(gravacoes[0]?.goalId).toBe("meta-1");
  });

  it("depois do primeiro rendimento, ou com saldo inicial definido, a diferença é rendimento, como sempre foi", async () => {
    const rendimento = lancamento({ sessionId: caixinha.sessionId, accountId: null, occurrences: pago("2026-11-03", 5_000) });
    const depois = servico([rendimento]);
    const resultado = await depois.servico.informarSaldo(TENANT, caixinha.id, { saldoCents: 50_800, date: HOJE });
    expect(resultado.comoSaldoInicial).toBeUndefined();
    expect(resultado.diferencaCents).toBe(45_800);
    expect(depois.gravacoes).toEqual([]);
    expect(depois.registrados).toEqual([expect.objectContaining({ mode: "inflows", cents: 45_800 })]);

    const comSaldo = servico([], { ...caixinha, openingCents: 1_000_000, openingOn: "2026-10-01" });
    const outro = await comSaldo.servico.informarSaldo(TENANT, caixinha.id, { saldoCents: 1_001_500, date: HOJE });
    expect(outro.diferencaCents).toBe(1_500);
    expect(comSaldo.gravacoes).toEqual([]);
    expect(comSaldo.registrados).toHaveLength(1);
  });
});
