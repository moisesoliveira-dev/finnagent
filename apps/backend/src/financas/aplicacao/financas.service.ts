import { Inject, Injectable } from "@nestjs/common";
import type {
  EfeitoTransacao,
  FinancasResposta,
  Lancamento,
  StatusTransacao,
} from "@finnagent/contracts";
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
  type ValorFixo,
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
    if (typeof resultado === "string") {
      throw new Conflito("Não foi possível salvar o lançamento.");
    }
    return resultado;
  }

  async atualizar(tenantId: string, pedido: NovoLancamento): Promise<Lancamento> {
    const resultado = await this.financas.atualizar(tenantId, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (resultado === "sessao-ausente") throw new NaoEncontrado("Sessão não encontrada.");
    if (resultado === "sessao-encerrada") throw new Conflito("Essa sessão já foi encerrada.");
    if (typeof resultado === "string") throw new Conflito("Não foi possível salvar o lançamento.");
    return resultado;
  }

  atualizarStatus(tenantId: string, id: string, status: StatusTransacao) {
    return this.um(this.financas.atualizarStatus(tenantId, id, status));
  }

  associarCompromisso(tenantId: string, id: string, commitmentId: string) {
    return this.um(this.financas.associarCompromisso(tenantId, id, commitmentId));
  }

  adiantar(tenantId: string, id: string, category: "installment" | "loan") {
    return this.um(this.financas.adiantar(tenantId, id, category));
  }

  cancelarSerie(tenantId: string, id: string, category: "installment" | "loan") {
    return this.um(this.financas.cancelarSerie(tenantId, id, category));
  }

  ajustarMes(
    tenantId: string,
    id: string,
    year: number,
    month: number,
    effect: EfeitoTransacao,
  ) {
    return this.um(this.financas.ajustarMes(tenantId, id, year, month, effect));
  }

  async atualizarValorFixo(tenantId: string, valores: ValorFixo[]) {
    const resultado = await this.financas.atualizarValorFixo(tenantId, valores);
    if (typeof resultado === "string") return this.falha(resultado);
    return resultado;
  }

  private async um(pendente: Promise<Lancamento | string>) {
    const resultado = await pendente;
    if (typeof resultado === "string") this.falha(resultado);
    return resultado;
  }

  private falha(codigo: string): never {
    if (codigo === "ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (codigo === "compromisso-ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    if (codigo === "categoria") throw new Conflito("Essa ação não vale para esta categoria.");
    if (codigo === "encerrada") throw new Conflito("Essa transação já foi encerrada.");
    if (codigo === "concluida") throw new Conflito("As parcelas já foram concluídas.");
    throw new Conflito("Não foi possível atualizar a transação.");
  }
}
