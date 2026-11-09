import { describe, expect, it } from "vitest";
import { MENSAGEM_DE_LANCAMENTO_SINCRONIZADO } from "../../financas/aplicacao/financas.service.js";
import { Conflito } from "../../grupos/dominio/erros.js";
import { ExclusoesService } from "./exclusoes.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";

function montar(opcoes: { metaDaSessao?: string; caixinhaDaSessao?: string; sessaoDaMetaApagada?: string; sincronizadoNaOcorrencia?: boolean; par?: boolean; sessaoDasSobras?: string } = {}) {
  const chamadas: string[] = [];
  let tentativas = 0;
  const financas = {
    listar: async () => ({
      entries: [
        ...(opcoes.par ? [{ id: "e1", pairId: "p1" }, { id: "e2", pairId: "p1" }, { id: "e3", pairId: null }] : []),
        ...(opcoes.sessaoDasSobras ? [{ id: "sobra", sessionId: opcoes.sessaoDasSobras, carryOf: "2026-10" }] : []),
      ],
    }),
    excluir: async (_t: string, id: string) => void chamadas.push(`excluir:${id}`),
    excluirOcorrencia: async (_t: string, id: string) => {
      tentativas += 1;
      chamadas.push(`ocorrencia:${id}`);
      if (opcoes.sincronizadoNaOcorrencia && tentativas === 1) throw new Conflito(MENSAGEM_DE_LANCAMENTO_SINCRONIZADO);
      return { removed: "entry" as const };
    },
  };
  const grupos = {
    listar: async () => ({ groups: [], sessions: [{ id: "s1", groupId: "g1" }, { id: "s2", groupId: "g2" }] }),
    removerSessao: async (_t: string, id: string) => void chamadas.push(`removerSessao:${id}`),
    removerGrupo: async (_t: string, id: string) => void chamadas.push(`removerGrupo:${id}`),
  };
  const extratos = {
    liberarLinhas: async (_t: string, onde: object, emExclusao?: ReadonlySet<string>) =>
      void chamadas.push(`liberar:${JSON.stringify(onde)}:${[...(emExclusao ?? [])].join(",")}`),
    esquecerAssociacoesDaSessao: async (_t: string, id: string) => void chamadas.push(`esquecer:${id}`),
  };
  const metas = {
    excluir: async (_t: string, id: string) => {
      chamadas.push(`excluirMeta:${id}`);
      return { id, name: "Casamento", sessionId: opcoes.sessaoDaMetaApagada ?? null };
    },
    metaDasSessoes: async (_t: string, ids: string[]) =>
      opcoes.metaDaSessao && ids.includes(opcoes.metaDaSessao) ? { name: "Viagem" } : null,
  };
  const caixinhas = {
    daSessao: async (_t: string, ids: string[]) =>
      opcoes.caixinhaDaSessao && ids.includes(opcoes.caixinhaDaSessao) ? { name: "Reserva" } : null,
  };
  const servico = new ExclusoesService(financas as never, grupos as never, extratos as never, metas as never, caixinhas as never);
  return { servico, chamadas };
}

describe("apagar leva em conta o estado do resto", () => {
  it("o lançamento solta as linhas do extrato antes de sair, sem reabrir o que vai ser apagado", async () => {
    const { servico, chamadas } = montar();
    await servico.lancamento(TENANT, "e1");
    expect(chamadas).toEqual(['liberar:{"entryIds":["e1"]}:e1', "excluir:e1"]);
  });

  it("a sessão solta as linhas, encerra e esquece as associações", async () => {
    const { servico, chamadas } = montar();
    await servico.sessao(TENANT, "s1");
    expect(chamadas).toEqual(['liberar:{"sessionId":"s1"}:', "removerSessao:s1", "esquecer:s1"]);
  });

  it("o grupo solta as linhas dos lançamentos dele antes de sair", async () => {
    const { servico, chamadas } = montar();
    await servico.grupo(TENANT, "g1");
    expect(chamadas).toEqual(['liberar:{"groupId":"g1"}:', "removerGrupo:g1"]);
  });

  it("apagar um lado da transferência apaga o outro; lançamento sem par sai sozinho", async () => {
    const { servico, chamadas } = montar({ par: true });
    await servico.lancamento(TENANT, "e1");
    expect(chamadas).toEqual(['liberar:{"entryIds":["e1","e2"]}:e1,e2', "excluir:e1", "excluir:e2"]);
    chamadas.length = 0;
    await servico.lancamento(TENANT, "e3");
    expect(chamadas).toEqual(['liberar:{"entryIds":["e3"]}:e3', "excluir:e3"]);
  });

  it("a meta apagada leva a sessão dela, mesmo com valor separado, soltando antes as linhas do extrato", async () => {
    const { servico, chamadas } = montar({ sessaoDaMetaApagada: "s1" });
    await servico.meta(TENANT, "m1");
    expect(chamadas).toEqual(["excluirMeta:m1", 'liberar:{"sessionId":"s1"}:', "removerSessao:s1", "esquecer:s1"]);
  });

  it("não apaga a sessão das sobras nem o grupo dela", async () => {
    const { servico, chamadas } = montar({ sessaoDasSobras: "s2" });
    await expect(servico.sessao(TENANT, "s2")).rejects.toThrow("Essa sessão guarda as sobras de cada mês");
    await expect(servico.grupo(TENANT, "g2")).rejects.toThrow("Esse grupo tem a sessão das sobras");
    expect(chamadas).toEqual([]);
  });

  it("não apaga por Grupos a sessão nem o grupo de uma caixinha", async () => {
    const { servico, chamadas } = montar({ caixinhaDaSessao: "s2" });
    await expect(servico.sessao(TENANT, "s2")).rejects.toThrow('Essa sessão é da caixinha "Reserva". Exclua a caixinha em Contas.');
    await expect(servico.grupo(TENANT, "g2")).rejects.toThrow('Esse grupo tem a sessão da caixinha "Reserva"');
    expect(chamadas).toEqual([]);
  });

  it("não apaga a sessão nem o grupo que guarda uma meta, e não solta nenhuma linha", async () => {
    const { servico, chamadas } = montar({ metaDaSessao: "s1" });
    await expect(servico.sessao(TENANT, "s1")).rejects.toThrow('Essa sessão guarda a meta "Viagem"');
    await expect(servico.grupo(TENANT, "g1")).rejects.toThrow('Esse grupo tem a sessão da meta "Viagem"');
    expect(chamadas).toEqual([]);
  });

  it("a última ocorrência de um lançamento sincronizado solta as linhas e tenta de novo", async () => {
    const { servico, chamadas } = montar({ sincronizadoNaOcorrencia: true });
    await servico.ocorrencia(TENANT, "e1", 1);
    expect(chamadas).toEqual(["ocorrencia:e1", 'liberar:{"entryIds":["e1"]}:e1', "ocorrencia:e1"]);
  });
});
