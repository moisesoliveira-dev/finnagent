import { alocarSobra, type Lancamento, type Meta } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import type { FinancasService } from "../../financas/aplicacao/financas.service.js";
import type { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { valorSeparado } from "../dominio/guardado.js";
import type { MetasRepositorio, NovaMeta } from "../portas/metas-repositorio.js";
import { MetasService } from "./metas.service.js";

class Memoria implements MetasRepositorio {
  lista: Meta[] = [];
  divisoesGravadas: Array<{ goalId: string; percent: number; approvedCents: number | null }> = [];
  async divisoes() {
    return this.divisoesGravadas.map((linha) => ({ ...linha }));
  }
  async dividir(_t: string, _y: number, _m: number, percentuais: Record<string, number>) {
    if (Object.keys(percentuais).some((id) => !this.lista.some((meta) => meta.id === id))) return "meta-ausente" as const;
    const aprovadas = this.divisoesGravadas.filter((linha) => linha.approvedCents !== null);
    this.divisoesGravadas = [
      ...aprovadas,
      ...Object.entries(percentuais)
        .filter(([id, percent]) => percent > 0 && !aprovadas.some((linha) => linha.goalId === id))
        .map(([goalId, percent]) => ({ goalId, percent, approvedCents: null })),
    ];
    return "ok" as const;
  }
  async aprovar(_t: string, goalId: string, _y: number, _m: number, cents: number) {
    const linha = this.divisoesGravadas.find((item) => item.goalId === goalId);
    if (!linha) return "sem-divisao" as const;
    if (linha.approvedCents !== null) return "ja-aprovada" as const;
    linha.approvedCents = cents;
    return "ok" as const;
  }
  async reabrir(_t: string, goalId: string) {
    const linha = this.divisoesGravadas.find((item) => item.goalId === goalId);
    if (linha) linha.approvedCents = null;
  }
  async reordenar(_tenant: string, ids: string[]) {
    if (ids.length !== this.lista.length || !this.lista.every((meta) => ids.includes(meta.id))) return "diferente" as const;
    this.lista = ids.map((id, indice) => ({ ...(this.lista.find((meta) => meta.id === id) as Meta), position: indice + 1 }));
    return "ok" as const;
  }
  async listar() {
    return [...this.lista];
  }
  async criar(_tenant: string, pedido: NovaMeta) {
    const atual = this.lista.find((item) => item.id === pedido.id);
    if (atual) return atual;
    const meta: Meta = { ...pedido, position: this.lista.length + 1 };
    this.lista.push(meta);
    return meta;
  }
  async excluir(_tenant: string, id: string) {
    const antes = this.lista.length;
    this.lista = this.lista.filter((item) => item.id !== id);
    return this.lista.length < antes;
  }
}

function montar(opcoes: { grupos?: Array<{ id: string; name: string }>; nomeOcupado?: boolean; entries?: Lancamento[] } = {}) {
  const memoria = new Memoria();
  const chamadas = { grupos: [] as unknown[][], sessoes: [] as unknown[][], lancamentos: [] as Array<Record<string, unknown>>, removidas: [] as string[] };
  const grupos = {
    listar: async () => ({ groups: opcoes.grupos ?? [], sessions: [] }),
    criarGrupo: async (...args: unknown[]) => {
      chamadas.grupos.push(args);
      return { id: args[1] as string };
    },
    criarSessao: async (...args: unknown[]) => {
      if (opcoes.nomeOcupado) throw new Conflito("Esse grupo já tem uma sessão com esse nome.");
      chamadas.sessoes.push(args);
    },
    removerSessao: async (_tenant: string, id: string) => {
      chamadas.removidas.push(id);
    },
  } as unknown as GruposService;
  const financas = {
    hoje: async () => "2026-10-28",
    registrar: async (_tenant: string, pedido: Record<string, unknown>) => {
      chamadas.lancamentos.push(pedido);
    },
    listar: async () => ({
      workflow: { year: 2026, month: 3, day: 1 },
      entries: opcoes.entries ?? [],
    }),
  } as unknown as FinancasService;
  return { servico: new MetasService(memoria, financas, grupos), memoria, chamadas };
}

const pedido = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Viagem",
  targetCents: 500_000,
  savedCents: 0,
  dueYear: null,
  dueMonth: null,
};

function saida(sessionId: string, cents: number, status: "pending" | "completed" | "cancelled" = "completed"): Lancamento {
  return {
    id: `l-${sessionId}-${cents}`,
    sessionId,
    occurrences: [{ number: 1, dueDate: "2026-10-28", plannedCents: -cents, paidCents: status === "completed" ? -cents : null, paidOn: null, status }],
  } as unknown as Lancamento;
}

describe("meta com grupo e sessão", () => {
  it("cria o grupo Metas na primeira meta e uma sessão de acúmulo com o nome dela", async () => {
    const { servico, memoria, chamadas } = montar();
    const meta = await servico.criar("t", pedido);
    expect(chamadas.grupos).toHaveLength(1);
    expect(chamadas.grupos[0]?.[2]).toBe("Metas");
    expect(chamadas.sessoes).toHaveLength(1);
    expect(chamadas.sessoes[0]?.[2]).toMatchObject({ name: "Viagem" });
    expect(chamadas.sessoes[0]?.[3]).toBe("acumulo");
    expect(meta.sessionId).toBe(chamadas.sessoes[0]?.[1]);
    expect(memoria.lista).toHaveLength(1);
    expect(chamadas.lancamentos).toHaveLength(0);
  });

  it("reaproveita o grupo Metas, mesmo com a caixa diferente", async () => {
    const { servico, chamadas } = montar({ grupos: [{ id: "g-1", name: "metas" }] });
    await servico.criar("t", pedido);
    expect(chamadas.grupos).toHaveLength(0);
    expect(chamadas.sessoes[0]?.[2]).toMatchObject({ groupId: "g-1" });
  });

  it("o valor já separado vira uma saída paga na sessão da meta", async () => {
    const { servico, chamadas } = montar();
    const meta = await servico.criar("t", { ...pedido, savedCents: 150_000 });
    expect(chamadas.lancamentos).toEqual([
      expect.objectContaining({ sessionId: meta.sessionId, mode: "outflows", status: "completed", cents: 150_000, category: "unique" }),
    ]);
  });

  it("nome repetido no grupo Metas vira conflito claro e não grava a meta", async () => {
    const { servico, memoria } = montar({ nomeOcupado: true });
    await expect(servico.criar("t", pedido)).rejects.toThrow("Já existe uma meta com esse nome.");
    expect(memoria.lista).toHaveLength(0);
  });

  it("repetir o mesmo pedido não cria outra sessão nem outro lançamento", async () => {
    const { servico, chamadas } = montar();
    await servico.criar("t", { ...pedido, savedCents: 1000 });
    await servico.criar("t", { ...pedido, savedCents: 1000 });
    expect(chamadas.sessoes).toHaveLength(1);
    expect(chamadas.lancamentos).toHaveLength(1);
  });

  it("separar lança uma saída na sessão; meta sem sessão ou inexistente recusa", async () => {
    const { servico, memoria, chamadas } = montar();
    const meta = await servico.criar("t", pedido);
    await servico.separar("t", meta.id, 20_000);
    expect(chamadas.lancamentos[0]).toMatchObject({ sessionId: meta.sessionId, mode: "outflows", cents: 20_000 });
    memoria.lista.push({ ...pedido, id: "22222222-2222-4222-8222-222222222222", sessionId: null, position: 9 });
    await expect(servico.separar("t", "22222222-2222-4222-8222-222222222222", 100)).rejects.toBeInstanceOf(Conflito);
    await expect(servico.separar("t", "33333333-3333-4333-8333-333333333333", 100)).rejects.toBeInstanceOf(NaoEncontrado);
  });

  it("excluir encerra a sessão só se ela nunca recebeu lançamento", async () => {
    const vazia = montar();
    const meta = await vazia.servico.criar("t", pedido);
    await vazia.servico.excluir("t", meta.id);
    expect(vazia.chamadas.removidas).toEqual([meta.sessionId]);

    const usada = montar();
    const outra = await usada.servico.criar("t", pedido);
    (usada.servico as unknown as { financas: { listar: () => Promise<unknown> } }).financas.listar = async () => ({
      workflow: { year: 2026, month: 3, day: 1 },
      entries: [saida(outra.sessionId as string, 1000)],
    });
    await usada.servico.excluir("t", outra.id);
    expect(usada.chamadas.removidas).toEqual([]);
  });
});

describe("divisão da sobra do mês", () => {
  it("guarda as porcentagens, mostra o valor pela sobra e recusa meta que não existe", async () => {
    const { servico } = montar();
    const meta = await servico.criar("t", pedido);
    await servico.dividir("t", { [meta.id]: 40 });
    const resposta = await servico.listar("t");
    expect(resposta.division[meta.id]).toEqual({ percent: 40, cents: 0, approved: false });
    await expect(servico.dividir("t", { "99999999-9999-4999-8999-999999999999": 10 })).rejects.toBeInstanceOf(NaoEncontrado);
  });

  it("não aprova sem divisão nem sem sobra, e não lança nada", async () => {
    const { servico, chamadas } = montar();
    const meta = await servico.criar("t", pedido);
    await expect(servico.aprovar("t", meta.id)).rejects.toThrow("Defina a porcentagem");
    await servico.dividir("t", { [meta.id]: 50 });
    await expect(servico.aprovar("t", meta.id)).rejects.toThrow("Não há sobra");
    expect(chamadas.lancamentos).toHaveLength(0);
    await expect(servico.aprovar("t", "99999999-9999-4999-8999-999999999999")).rejects.toBeInstanceOf(NaoEncontrado);
  });
});

describe("valor separado", () => {
  it("soma as saídas pendentes e pagas como positivo e ignora a cancelada", () => {
    const entries = [saida("s1", 30_000), saida("s1", 10_000, "pending"), saida("s1", 99_999, "cancelled"), saida("s2", 5_000)];
    expect(valorSeparado(entries, "s1")).toBe(40_000);
    expect(valorSeparado(entries, "s3")).toBe(0);
  });
});

describe("sobra com prioridade", () => {
  const hoje = { year: 2026, month: 10 };
  const meta = (id: string, over: Partial<Meta>): Meta => ({ id, name: id, targetCents: 0, savedCents: 0, dueYear: null, dueMonth: null, sessionId: null, position: 1, ...over });

  it("atende na ordem de prioridade que a pessoa escolheu, até acabar a sobra", () => {
    const metas = [
      meta("sem-prazo", { targetCents: 50_000, position: 1 }),
      meta("longe", { targetCents: 120_000, dueYear: 2027, dueMonth: 9, position: 3 }),
      meta("perto", { targetCents: 30_000, dueYear: 2026, dueMonth: 12, position: 2 }),
    ];
    // A sem prazo vem primeiro e pede o que falta (50.000); com 25.000 de sobra, as outras ficam sem nada.
    expect(alocarSobra(metas, hoje, 25_000)).toEqual({ "sem-prazo": 25_000, perto: 0, longe: 0 });
    // Trocando a ordem, o prazo mais perto passa na frente: perto pede 10.000 por mês, longe 10.000.
    const trocada = [metas[0]!, metas[1]!, metas[2]!].map((item, indice) => ({ ...item, position: [3, 2, 1][indice]! }));
    expect(alocarSobra(trocada, hoje, 25_000)).toEqual({ perto: 10_000, longe: 10_000, "sem-prazo": 5_000 });
  });

  it("reordenar exige todas as metas da conta e grava a ordem", async () => {
    const { servico, memoria } = montar();
    const a = await servico.criar("t", pedido);
    const b = await servico.criar("t", { ...pedido, id: "44444444-4444-4444-8444-444444444444", name: "Carro" });
    await servico.reordenar("t", [b.id, a.id]);
    expect(memoria.lista.map((meta) => [meta.id, meta.position])).toEqual([[b.id, 1], [a.id, 2]]);
    await expect(servico.reordenar("t", [a.id])).rejects.toBeInstanceOf(Conflito);
  });

  it("sem sobra ou com meta alcançada ninguém pede nada", () => {
    const metas = [meta("a", { targetCents: 1000, savedCents: 1000 }), meta("b", { targetCents: 1000 })];
    expect(alocarSobra(metas, hoje, 5_000)).toEqual({ a: 0, b: 1000 });
    expect(alocarSobra(metas, hoje, -300)).toEqual({ a: 0, b: 0 });
  });
});
