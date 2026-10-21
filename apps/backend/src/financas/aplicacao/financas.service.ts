import { Inject, Injectable } from "@nestjs/common";
import type {
  EfeitoTransacao,
  FinancasResposta,
  Lancamento,
  StatusTransacao,
} from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  FINANCAS_REPOSITORIO,
  type FinancasRepositorio,
  type NovoLancamento,
  type ValorFixo,
} from "../portas/financas-repositorio.js";

@Injectable()
export class FinancasService {
  constructor(@Inject(FINANCAS_REPOSITORIO) private readonly financas: FinancasRepositorio) {}

  async listar(tenantId: string, incluirEncerradas = false): Promise<FinancasResposta> {
    await this.financas.garantirWorkflow(tenantId);
    return this.financas.listar(tenantId, incluirEncerradas);
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
    if (resultado === "base") {
      throw new Conflito("Movimento e categoria não podem ser alterados.");
    }
    if (resultado === "ocorrencia") {
      throw new Conflito(
        "Data, valor e os termos ficam travados quando alguma ocorrência já saiu de pendente ou o lançamento foi cruzado com o extrato.",
      );
    }
    if (typeof resultado === "string") throw new Conflito("Não foi possível salvar o lançamento.");
    return resultado;
  }

  atualizarStatus(tenantId: string, id: string, status: StatusTransacao) {
    return this.um(this.financas.atualizarStatus(tenantId, id, status));
  }

  atualizarOcorrencia(
    tenantId: string,
    id: string,
    number: number,
    pedido: { status?: StatusTransacao; dueDate?: string; plannedCents?: number },
  ) {
    return this.um(this.financas.atualizarOcorrencia(tenantId, id, number, pedido));
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

  async excluir(tenantId: string, id: string) {
    const resultado = await this.financas.excluir(tenantId, id);
    if (resultado) this.falha(resultado);
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
    if (codigo === "sincronizado") {
      throw new Conflito("Esse lançamento foi sincronizado com o extrato e não pode ser apagado.");
    }
    if (codigo === "bloqueada") throw new Conflito("Essa ocorrência não pode receber essa alteração.");
    if (codigo === "ocorrencia") {
      throw new Conflito(
        "Data, valor e os termos ficam travados quando alguma ocorrência já saiu de pendente ou o lançamento foi cruzado com o extrato.",
      );
    }
    throw new Conflito("Não foi possível atualizar a transação.");
  }
}
