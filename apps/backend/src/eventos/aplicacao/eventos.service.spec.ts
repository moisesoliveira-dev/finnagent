import type { FiltroDeEventos, FiltroDoHistorico, LinhaOutbox } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { ConfiguracoesRepositorio } from "../../configuracoes/portas/configuracoes-repositorio.js";
import { NaoEncontrado } from "../../grupos/dominio/erros.js";
import type { EventosRepositorio, ResumoDeEventos } from "../portas/eventos-repositorio.js";
import { EventosService } from "./eventos.service.js";

const semFiltro: FiltroDeEventos = { pagina: 1, categoria: null, status: null, q: "", dia: null };
const semFiltroNoHistorico: FiltroDoHistorico = { pagina: 1, resultado: null, q: "" };

function linha(id: string, consumedAt: string | null = null): LinhaOutbox {
  return {
    id,
    operation: "criar-lancamento",
    idempotencyKey: `${id}:chave`,
    payload: "{}",
    occurredAt: "2026-10-28T12:00:00.000Z",
    publishedAt: "2026-10-28T12:00:01.000Z",
    consumedAt,
  };
}

class Memoria implements EventosRepositorio {
  pedidos: unknown[][] = [];
  resumo: ResumoDeEventos = { total: 0, porCategoria: [], porStatus: [], porDia: [] };
  consumidos = 0;
  linhas: LinhaOutbox[] = [];
  async resumir(...args: unknown[]) {
    this.pedidos.push(["resumir", ...args]);
    return this.resumo;
  }
  async listar(...args: unknown[]) {
    this.pedidos.push(["listar", ...args]);
    return this.linhas;
  }
  async contarConsumidos(...args: unknown[]) {
    this.pedidos.push(["contarConsumidos", ...args]);
    return this.consumidos;
  }
  async listarConsumidos(...args: unknown[]) {
    this.pedidos.push(["listarConsumidos", ...args]);
    return this.linhas;
  }
  async buscar(_tenantId: string, id: string) {
    return this.linhas.find((item) => item.id === id) ?? null;
  }
}

function servico(memoria: Memoria, preferencias = { timezone: "America/Manaus", history: "sempre" }) {
  const configuracoes = { obter: async () => preferencias } as unknown as ConfiguracoesRepositorio;
  return new EventosService(memoria, configuracoes);
}

describe("eventos paginados", () => {
  it("traz a página pedida para dentro do total e pede o deslocamento certo", async () => {
    const memoria = new Memoria();
    memoria.resumo = {
      total: 120,
      porCategoria: [{ chave: "financeiro", total: 120 }],
      porStatus: [{ chave: "concluído", total: 118 }, { chave: "pendente", total: 2 }],
      porDia: [{ dia: "2026-10-28", status: "concluído", total: 3 }],
    };
    memoria.linhas = [linha("a")];
    const pagina = await servico(memoria).pagina("t", { ...semFiltro, pagina: 9 }, new Date("2026-10-28T15:00:00.000Z"));

    expect(pagina.page).toEqual({ number: 3, size: 50, total: 120 });
    expect(memoria.pedidos.find((pedido) => pedido[0] === "listar")?.slice(3)).toEqual(["America/Manaus", 100, 50]);
    expect(pagina.counts.categories).toMatchObject({ financeiro: 120, agenda: 0, conta: 0 });
    expect(pagina.counts.status).toEqual({ pendente: 2, processando: 0, "concluído": 118, "com falha": 0 });
    expect(pagina.events.map((evento) => evento.id)).toEqual(["a"]);
  });

  it("monta 30 dias que terminam hoje no fuso da conta, não em UTC", async () => {
    const memoria = new Memoria();
    // 02h de 29/10 em UTC ainda é 28/10 em Manaus (UTC-4).
    const pagina = await servico(memoria).pagina("t", semFiltro, new Date("2026-10-29T02:00:00.000Z"));
    expect(pagina.timezone).toBe("America/Manaus");
    expect(pagina.today).toBe("2026-10-28");
    expect(pagina.volume).toHaveLength(30);
    expect(pagina.volume.at(-1)?.date).toBe("2026-10-28");
    expect(pagina.volume[0]?.date).toBe("2026-09-29");
    expect(memoria.pedidos[0]?.[4]).toBe("2026-09-29");
  });

  it("sem nada encontrado não lista e fica na primeira página", async () => {
    const memoria = new Memoria();
    const pagina = await servico(memoria, { timezone: "inventado", history: "sempre" }).pagina("t", { ...semFiltro, pagina: 4 });
    expect(pagina.page).toEqual({ number: 1, size: 50, total: 0 });
    expect(pagina.timezone).toBe("America/Sao_Paulo");
    expect(memoria.pedidos.some((pedido) => pedido[0] === "listar")).toBe(false);
  });
});

describe("histórico paginado", () => {
  it("aplica a retenção da conta e devolve o tempo de processamento", async () => {
    const memoria = new Memoria();
    memoria.consumidos = 1;
    memoria.linhas = [linha("c", "2026-10-28T12:00:03.000Z")];
    const pagina = await servico(memoria, { timezone: "America/Manaus", history: "90d" }).historico(
      "t",
      semFiltroNoHistorico,
      new Date("2026-10-28T12:00:00.000Z"),
    );
    expect(pagina.retention).toBe("90d");
    expect((memoria.pedidos[0]?.[3] as Date).toISOString()).toBe("2026-07-30T12:00:00.000Z");
    expect(pagina.history).toEqual([expect.objectContaining({ eventId: "c", durationMs: 2000, result: "sucesso" })]);
  });

  it("falha e iniciado ainda não têm linhas; buscar o consumidor acha todas", async () => {
    const memoria = new Memoria();
    const vazio = await servico(memoria).historico("t", { ...semFiltroNoHistorico, resultado: "falha" });
    expect(vazio.history).toEqual([]);
    expect(memoria.pedidos).toEqual([]);

    await servico(memoria).historico("t", { ...semFiltroNoHistorico, q: "Publicar" });
    expect(memoria.pedidos[0]?.[2]).toBe("");
    await servico(memoria).historico("t", { ...semFiltroNoHistorico, q: "Lanc" });
    expect(memoria.pedidos[1]?.[2]).toBe("lanc");
  });
});

describe("detalhe do evento", () => {
  it("traz o evento com o processamento ou avisa que não existe", async () => {
    const memoria = new Memoria();
    memoria.linhas = [linha("c", "2026-10-28T12:00:03.000Z")];
    const detalhe = await servico(memoria).detalhe("t", "c");
    expect(detalhe.event.status).toBe("concluído");
    expect(detalhe.history).toHaveLength(1);
    await expect(servico(memoria).detalhe("t", "outro")).rejects.toBeInstanceOf(NaoEncontrado);
  });
});
