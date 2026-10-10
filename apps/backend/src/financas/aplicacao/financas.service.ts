import { Inject, Injectable } from "@nestjs/common";
import type { FinancasResposta, Lancamento } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { inicioDaSessao } from "../../grupos/dominio/sessao.js";
import {
  GRUPOS_REPOSITORIO,
  type GruposRepositorio,
} from "../../grupos/portas/grupos-repositorio.js";
import { EXEMPLO } from "../dominio/exemplo.js";
import {
  FINANCAS_REPOSITORIO,
  type FinancasRepositorio,
  type NovoLancamento,
} from "../portas/financas-repositorio.js";

@Injectable()
export class FinancasService {
  constructor(
    @Inject(FINANCAS_REPOSITORIO) private readonly financas: FinancasRepositorio,
    @Inject(GRUPOS_REPOSITORIO) private readonly grupos: GruposRepositorio,
  ) {}

  async listar(tenantId: string): Promise<FinancasResposta> {
    await this.financas.garantirWorkflow(tenantId);
    const { groups } = await this.grupos.listar(tenantId);
    if (groups.length === 0) await this.semearExemplo(tenantId);
    return this.financas.listar(tenantId);
  }

  private async semearExemplo(tenantId: string) {
    const grupos = new Map<string, { id: string; name: string }>();
    const sessoes = new Map<
      string,
      { id: string; groupId: string; name: string; description: string }
    >();
    for (const item of EXEMPLO) {
      grupos.set(item.groupId, { id: item.groupId, name: item.groupName });
      sessoes.set(item.sessionId, {
        id: item.sessionId,
        groupId: item.groupId,
        name: item.sessionName,
        description: item.justification,
      });
    }
    for (const grupo of grupos.values()) {
      const resultado = await this.grupos.criarGrupo(tenantId, grupo.id, grupo.name, "");
      if (typeof resultado === "string") {
        throw new Conflito("Não foi possível preparar o exemplo.");
      }
    }
    for (const sessao of sessoes.values()) {
      const resultado = await this.grupos.criarSessao(
        tenantId,
        sessao.id,
        {
          groupId: sessao.groupId,
          name: sessao.name,
          description: sessao.description,
          justification: "",
        },
        0,
        inicioDaSessao(),
      );
      if (typeof resultado === "string") {
        throw new Conflito("Não foi possível preparar o exemplo.");
      }
    }
    await this.financas.semearLancamentos(tenantId);
  }

  async criar(tenantId: string, pedido: NovoLancamento): Promise<Lancamento> {
    const resultado = await this.financas.criar(tenantId, pedido);
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro lançamento.");
    }
    if (resultado === "sessao-ausente") {
      throw new NaoEncontrado("Sessão não encontrada.");
    }
    if (resultado === "sessao-encerrada") {
      throw new Conflito("Essa sessão já foi encerrada.");
    }
    return resultado;
  }
}
