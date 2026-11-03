import type { Sessao, TipoSessao } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { Conflito } from "../dominio/erros.js";
import { MENSAGEM_DA_TROCA_DE_TIPO } from "../dominio/sessao.js";
import type { DadosDaSessao, GruposRepositorio } from "../portas/grupos-repositorio.js";
import { GruposService } from "./grupos.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-0000000000aa";
const dados: DadosDaSessao = { groupId: "g1", name: "Moradia", description: "", justification: "" };
const sessao = { id: ID, kind: "valor" } as unknown as Sessao;

function servicoCom(resposta: Sessao | "tipo" | "ausente") {
  const chamadas: Array<TipoSessao | undefined> = [];
  const repositorio = {
    atualizarSessao: async (_tenant: string, _id: string, _dados: DadosDaSessao, kind?: TipoSessao) => {
      chamadas.push(kind);
      return resposta;
    },
  } as unknown as GruposRepositorio;
  return { servico: new GruposService(repositorio), chamadas };
}

describe("atualizar a sessão", () => {
  it("repassa o tipo escolhido ao repositório", async () => {
    const { servico, chamadas } = servicoCom(sessao);
    expect(await servico.atualizarSessao(TENANT, ID, dados, "valor")).toBe(sessao);
    await servico.atualizarSessao(TENANT, ID, dados);
    expect(chamadas).toEqual(["valor", undefined]);
  });

  it("devolve conflito, com a explicação, quando a sessão tem lançamentos que o Fixo não aceita", async () => {
    const { servico } = servicoCom("tipo");
    const erro = await servico.atualizarSessao(TENANT, ID, dados, "valor").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Conflito);
    expect((erro as Error).message).toBe(MENSAGEM_DA_TROCA_DE_TIPO);
  });

  it("sessão ausente continua não encontrada", async () => {
    const { servico } = servicoCom("ausente");
    await expect(servico.atualizarSessao(TENANT, ID, dados, "acumulo")).rejects.toThrow("Sessão não encontrada.");
  });
});
