import { Inject, Injectable } from "@nestjs/common";
import { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import {
  ajustarTransacao,
  regraPadrao,
  ocorrenciasDoLancamento,
  termosTravados,
  type BaseResposta,
  type EfeitoTransacao,
  type FinancasResposta,
  type FinancasVista,
  type GeralResposta,
  type Lancamento,
  type StatusTransacao,
} from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { mensagemDaCategoria } from "../../grupos/dominio/sessao.js";
import { PedidoInvalido } from "../dominio/erros.js";
import {
  erroDoPedido,
  normalizarPedido,
  novoLancamento,
  pedidoDaEdicao,
  type PedidoLancamento,
} from "../dominio/pedido.js";
import {
  diaNoFuso,
  montarBase,
  montarGeral,
  montarVista,
  type FiltroBase,
} from "../dominio/vista.js";
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
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
    private readonly feriados: FeriadosService,
  ) {}

  async listar(tenantId: string, incluirEncerradas = false): Promise<FinancasResposta> {
    await this.financas.garantirWorkflow(tenantId);
    return this.financas.listar(tenantId, incluirEncerradas);
  }

  async hoje(tenantId: string) {
    const preferencias = await this.configuracoes.obter(tenantId);
    return diaNoFuso(preferencias.timezone);
  }

  async vista(tenantId: string): Promise<FinancasVista> {
    const base = await this.listar(tenantId);
    return montarVista(base, await this.hoje(tenantId));
  }

  async base(tenantId: string, filtro: FiltroBase): Promise<BaseResposta> {
    const base = await this.listar(tenantId);
    return montarBase(base, await this.hoje(tenantId), filtro);
  }

  async geral(tenantId: string, year: number): Promise<GeralResposta> {
    return montarGeral(await this.listar(tenantId), year);
  }

  async registrar(tenantId: string, pedido: PedidoLancamento) {
    if (pedido.dueRule) return this.criar(tenantId, this.validado(pedido));
    // Sem regra escolhida, vale o padrão da categoria nas configurações.
    const { vencimentos } = await this.configuracoes.obter(tenantId);
    const modo = ajustarTransacao(pedido).mode;
    return this.criar(tenantId, this.validado({ ...pedido, dueRule: regraPadrao(vencimentos, pedido.category, modo) }));
  }

  /** Depois de mudar os feriados locais: as pendentes de quem tem regra ganham as datas novas. */
  async redatarVencimentos(tenantId: string) {
    return this.financas.redatar(tenantId, await this.feriados.calendario(tenantId));
  }

  async editar(tenantId: string, pedido: PedidoLancamento) {
    const atual = await this.financas.obter(tenantId, pedido.id);
    if (!atual) throw new NaoEncontrado("Lançamento não encontrado.");
    const travado = termosTravados(ocorrenciasDoLancamento(atual), atual.synced);
    return this.atualizar(tenantId, this.validado(pedidoDaEdicao(atual, pedido, travado)));
  }

  async excluirOcorrencia(tenantId: string, id: string, number: number) {
    const resultado = await this.financas.excluirOcorrencia(tenantId, id, number);
    if (resultado !== "entry" && resultado !== "occurrence") this.falha(resultado);
    return { removed: resultado };
  }

  private validado(pedido: PedidoLancamento) {
    const normal = normalizarPedido(pedido);
    const erro = erroDoPedido(normal);
    if (erro) throw new PedidoInvalido(erro);
    return novoLancamento(normal);
  }

  async criar(tenantId: string, pedido: NovoLancamento): Promise<Lancamento> {
    const resultado = await this.financas.criar(tenantId, pedido, await this.feriados.calendario(tenantId));
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro lançamento.");
    }
    if (resultado === "sessao-ausente") {
      throw new NaoEncontrado("Sessão não encontrada.");
    }
    if (resultado === "sessao-encerrada") {
      throw new Conflito("Essa sessão já foi encerrada.");
    }
    if (resultado === "tipo-valor" || resultado === "tipo-acumulo") {
      throw new PedidoInvalido(mensagemDaCategoria(resultado === "tipo-valor" ? "valor" : "acumulo"));
    }
    if (resultado === "valor-lancada") {
      throw new PedidoInvalido("Esta sessão de valor único já foi lançada.");
    }
    if (typeof resultado === "string") {
      throw new Conflito("Não foi possível salvar o lançamento.");
    }
    return resultado;
  }

  async atualizar(tenantId: string, pedido: NovoLancamento): Promise<Lancamento> {
    const resultado = await this.financas.atualizar(tenantId, pedido, await this.feriados.calendario(tenantId));
    if (resultado === "ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (resultado === "sessao-ausente") throw new NaoEncontrado("Sessão não encontrada.");
    if (resultado === "sessao-encerrada") throw new Conflito("Essa sessão já foi encerrada.");
    if (resultado === "tipo-valor" || resultado === "tipo-acumulo") {
      throw new PedidoInvalido(mensagemDaCategoria(resultado === "tipo-valor" ? "valor" : "acumulo"));
    }
    if (resultado === "valor-base") {
      throw new PedidoInvalido("O acréscimo não altera o valor base.");
    }
    if (resultado === "valor-lancada") {
      throw new PedidoInvalido("Esta sessão de valor único já foi lançada.");
    }
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

  pagarPeloExtrato(tenantId: string, id: string, date: string, cents: number) {
    return this.um(this.financas.pagarPeloExtrato(tenantId, id, date, cents));
  }

  reabrirPeloExtrato(tenantId: string, id: string, date: string, cents: number) {
    return this.um(this.financas.reabrirPeloExtrato(tenantId, id, date, cents));
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
