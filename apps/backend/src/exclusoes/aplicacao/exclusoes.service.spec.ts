import { describe, expect, it } from "vitest";
import { MENSAGEM_DE_LANCAMENTO_SINCRONIZADO } from "../../financas/aplicacao/financas.service.js";
import { Conflito } from "../../grupos/dominio/erros.js";
import { ExclusoesService } from "./exclusoes.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";

function montar(opcoes: { metaDaSessao?: string; sincronizadoNaOcorrencia?: boolean } = {}) {
  const chamadas: string[] = [];
  let tentativas = 0;
  const financas = {
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
    metaDasSessoes: async (_t: string, ids: string[]) =>
      opcoes.metaDaSessao && ids.includes(opcoes.metaDaSessao) ? { name: "Viagem" } : null,
  };
  const servico = new ExclusoesService(financas as never, grupos as never, extratos as never, metas as never);
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
