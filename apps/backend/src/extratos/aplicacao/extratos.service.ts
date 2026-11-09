import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { REGRA_SEM_AJUSTE, ehSerie, erroDoTipoDaLinha } from "@finnagent/contracts";
import {
  LINHAS_DA_CONFERENCIA_DE_UMA_VEZ,
  LINHAS_DA_CONFERENCIA_POR_PAGINA,
  type DiferencaDoPagamento,
  type TipoDaLinha,
  type ConferenciaDesfeita,
  type ConferenciaResposta,
  type ExtratosResposta,
  type Lancamento,
  type LinhaConferencia,
  type LinhasExtrato,
  type MapeamentoExtrato,
  type PreviaExtrato,
  type ValorDoMes,
  type VinculoCruzado,
} from "@finnagent/contracts";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import { IaService } from "../../assistente/aplicacao/ia.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import type { PedidoLancamento } from "../../financas/dominio/pedido.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { cabeNaLinha, candidatosDaLinha, cruzaveisDoMes, propostaDaLinha, valorContado, valorDaSessaoFixa, valorDoMes, vinculoDoCruzavel } from "../dominio/cruzar.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { ehOcr, tipoDaMidia } from "../dominio/formato-ocr.js";
import { AnexosService } from "../../assistente/aplicacao/anexos.service.js";
import { leituraDasLinhas } from "../dominio/leitura-ocr.js";
import { casaComABusca, termosDaBusca } from "../dominio/busca.js";
import { chaveDoNome, ehTransferenciaDePessoa } from "../dominio/nome-extrato.js";
import { erroDaDivisao, JUSTIFICATIVA_DO_EXTRATO, nomeDaLinha } from "../dominio/divisao.js";
import { idDoPagamentoDaLinha } from "../dominio/pagamento-da-linha.js";
import { bytesDoConteudo, lerArquivo, nomeDoArquivo } from "../dominio/ler-extrato.js";
import { sessaoDoCompromisso } from "../dominio/sessao-do-compromisso.js";
import {
  EXTRATOS_REPOSITORIO,
  type ExtratosRepositorio,
  type GravacaoExtrato,
  type OndeEstaoOsLancamentos,
  type ParteGravada,
} from "../portas/extratos-repositorio.js";
import {
  ORGANIZADOR_DE_EXTRATO,
  type OrganizadorDeExtrato,
} from "../portas/organizador-de-extrato.js";

type LinhaGravada = Exclude<Awaited<ReturnType<ExtratosRepositorio["obterLinha"]>>, "ausente"> & { date: string };

/**
 * Como o lançamento da linha trata a sessão: `valor` decide a divergência na Fixo, `emPartes` libera mais uma.
 * `tipo` é o tipo do lançamento que nasce (sem ele, única).
 */
export type OpcoesDoLancamento = { valor?: ValorDoMes; emPartes?: boolean; nome?: string; tipo?: TipoDaLinha };

/** Uma parte da linha dividida: o valor, a sessão, o nome (se a pessoa deu) e o tipo do lançamento. */
export type ParteDaLinha = { cents: number; sessionId: string; nome?: string; tipo?: TipoDaLinha };

const MENSAGEM_DA_LINHA_IGNORADA = "Essa linha está ignorada. Reative-a para lançar.";

const MENSAGEM_DA_SESSAO_FIXA_LANCADA =
  'Esta sessão fixa já tem a transação deste mês e ela não cabe nesta linha (outro sinal ou já conciliada). Se o pagamento veio em partes, marque "Paga em partes" nesta linha.';

type Pedido = {
  id: string;
  filename: string;
  content: string;
  accountId: string | null;
  accountName: string | null;
  mapping: MapeamentoExtrato | null;
  /** O que a pessoa escreveu junto com o extrato. */
  note?: string;
};

@Injectable()
export class ExtratosService {
  constructor(
    @Inject(EXTRATOS_REPOSITORIO) private readonly extratos: ExtratosRepositorio,
    @Inject(ORGANIZADOR_DE_EXTRATO) private readonly organizador: OrganizadorDeExtrato,
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
    private readonly financas: FinancasService,
    private readonly agenda: AgendaService,
    private readonly ia: IaService,
    private readonly anexos: AnexosService,
  ) {}

  listar(tenantId: string): Promise<ExtratosResposta> {
    return this.extratos.listar(tenantId);
  }

  // Quantas linhas do período ainda não viraram lançamento. `month` vazio conta o ano inteiro.
  semConferir(tenantId: string, year: number, month: number | null) {
    return this.extratos.contarSemLancamento(tenantId, year, month);
  }

  async previa(
    tenantId: string,
    filename: string,
    content: string,
    mapping: MapeamentoExtrato | null,
  ): Promise<PreviaExtrato> {
    if (ehOcr(filename)) {
      this.bytes(content);
      if (!tipoDaMidia(filename)) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
      return { format: "ocr", columns: [], mapping: null, lines: [] };
    }
    const lido = this.ler(filename, content, mapping);
    return {
      format: lido.format,
      columns: lido.columns,
      mapping: lido.mapping,
      lines: lido.leitura.lines.slice(0, 3),
    };
  }

  async criar(tenantId: string, pedido: Pedido) {
    if (ehOcr(pedido.filename)) return this.receberOcr(tenantId, pedido);
    const lido = this.ler(pedido.filename, pedido.content, pedido.mapping);
    const bytes = this.bytes(pedido.content);
    const gravacao: GravacaoExtrato = {
      id: pedido.id,
      filename: nomeDoArquivo(pedido.filename),
      format: lido.format,
      bytes,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      accountId: pedido.accountId,
      accountName: pedido.accountName?.trim() || null,
      note: pedido.note?.trim() ?? "",
      mapping: lido.format === "csv" ? lido.mapping : null,
      leitura: lido.leitura,
    };
    const resultado = await this.extratos.criar(tenantId, gravacao);
    if (resultado === "duplicado") throw new Conflito("Já existe um extrato desta conta neste período.");
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outro extrato.");
    if (resultado === "conta-ausente") throw new NaoEncontrado("Conta não encontrada.");
    return resultado;
  }

  /** Importa o arquivo que a pessoa anexou no chat, com o que ela escreveu sobre ele. */
  async criarDeAnexo(
    tenantId: string,
    pedido: { id: string; anexoId: string; accountName: string; observacao: string; mapping: MapeamentoExtrato | null },
  ) {
    const anexo = await this.anexos.obter(tenantId, pedido.anexoId);
    if (!anexo) throw new NaoEncontrado("Anexo não encontrado. Peça para a pessoa anexar o arquivo de novo.");
    return this.criar(tenantId, {
      id: pedido.id,
      filename: anexo.name,
      content: anexo.content.toString("base64"),
      accountId: null,
      accountName: pedido.accountName,
      mapping: pedido.mapping,
      note: pedido.observacao,
    });
  }

  private async receberOcr(tenantId: string, pedido: Pedido) {
    const bytes = this.bytes(pedido.content);
    if (!tipoDaMidia(pedido.filename)) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    const resultado = await this.extratos.reservar(tenantId, {
      id: pedido.id,
      filename: nomeDoArquivo(pedido.filename),
      bytes,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      accountId: pedido.accountId,
      accountName: pedido.accountName?.trim() || null,
      note: pedido.note?.trim() ?? "",
    });
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outro extrato.");
    if (resultado === "conta-ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "duplicado") throw new Conflito("Esse arquivo já foi importado nesta conta.");
    if (resultado.novo) void this.concluirOcr(tenantId, resultado.extrato.id);
    return resultado.extrato;
  }

  private async concluirOcr(tenantId: string, id: string) {
    try {
      const atual = await this.extratos.carregar(tenantId, id);
      if (atual === "ausente") return;
      const leitura = await this.leituraOcr(tenantId, atual.filename, atual.bytes.toString("base64"), atual.note);
      const resultado = await this.extratos.substituir(tenantId, id, leitura, null, "importar-extrato");
      if (resultado === "duplicado") {
        await this.extratos.falhar(tenantId, id, "Já existe um extrato desta conta neste período.");
      }
    } catch (error) {
      const mensagem = error instanceof Error && error.message ? error.message : "Não foi possível ler o extrato.";
      await this.extratos.falhar(tenantId, id, mensagem);
    }
  }

  async linhas(tenantId: string, id: string, somenteErros: boolean): Promise<LinhasExtrato> {
    const resultado = await this.extratos.linhas(tenantId, id, somenteErros);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    return resultado;
  }

  async reprocessar(tenantId: string, id: string) {
    const atual = await this.extratos.carregar(tenantId, id);
    if (atual === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    await this.desfazerCruzadas(tenantId, id);
    if (ehOcr(atual.filename)) {
      const marcado = await this.extratos.marcarProcessando(tenantId, id);
      if (marcado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
      void this.concluirOcr(tenantId, id);
      return marcado;
    }
    const lido = lerArquivo(atual.bytes, atual.filename, atual.mapping);
    if (!("leitura" in lido)) throw new PedidoInvalido(lido.message);
    const resultado = await this.extratos.substituir(tenantId, id, lido.leitura, lido.mapping);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    if (resultado === "duplicado") throw new Conflito("Já existe um extrato desta conta neste período.");
    return resultado;
  }

  async abrirConferencia(tenantId: string, year: number, month: number) {
    const pendente = await this.extratos.ultimoMesPendente(tenantId);
    return this.conferencia(tenantId, pendente?.year ?? year, pendente?.month ?? month);
  }

  async conferencia(tenantId: string, year: number, month: number, pagina?: number, busca?: string): Promise<ConferenciaResposta> {
    const [pacote, linhas, associacoes, compromissos, nomes] = await Promise.all([
      this.financas.listarNoMes(tenantId, year, month),
      this.extratos.listarLinhasNoMes(tenantId, year, month),
      this.extratos.listarAssociacoes(tenantId),
      this.agenda.ocorrencias(tenantId, year, month),
      this.extratos.listarNomes(tenantId),
    ]);
    // Os nomes já dados, por descrição, do mais recente ao mais antigo.
    const nomesPorChave = new Map<string, string[]>();
    for (const item of nomes) {
      const lista = nomesPorChave.get(item.key) ?? [];
      if (lista.length < 8) nomesPorChave.set(item.key, [...lista, item.name]);
    }
    const abertas = { entries: pacote.abertas };
    const base = { entries: pacote.todas };
    const lembrados = new Map(associacoes.map((item) => [item.name, item]));
    const cruzaveis = cruzaveisDoMes(
      abertas.entries,
      linhas.map((linha) => linha.entryId),
      year,
      month,
    );
    const lines = linhas.map(({ importedAt: _importedAt, parts: partes, ...linha }): LinhaConferencia => {
      const link = vinculoDe(linha.entryId, base.entries);
      const names = nomesPorChave.get(chaveDoNome(linha.description)) ?? [];
      if (linha.entryId || linha.ignored) {
        const parts = partes.length > 1
          ? partes.flatMap((parte) => {
              const vinculo = vinculoDe(parte.entryId, base.entries);
              return vinculo ? [{ ...vinculo, cents: parte.cents }] : [];
            })
          : [];
        return {
          ...linha,
          link,
          parts,
          names,
          suggestion: null,
          suggestionSource: null,
          candidates: [],
          sessionId: null,
          sessionSource: null,
          appointmentTitle: null,
        };
      }
      const candidatos = candidatosDaLinha(linha, cruzaveis);
      // Transferência para pessoa não tem memória: o motivo muda a cada uma.
      const lembrado = ehTransferenciaDePessoa(linha.description) ? undefined : lembrados.get(chaveDoNome(linha.description));
      const proposta = propostaDaLinha(linha, candidatos, lembrado);
      // O nome já lançado antes vale mais; sem ele, vale a sessão do compromisso que cai no dia da linha.
      const doCompromisso = lembrado?.sessionId ? null : sessaoDoCompromisso(linha.date, compromissos);
      return {
        ...linha,
        link: null,
        parts: [],
        names,
        suggestion: proposta ? vinculoDoCruzavel(proposta.suggestion) : null,
        suggestionSource: proposta?.source ?? null,
        candidates: candidatos.map(vinculoDoCruzavel),
        sessionId: lembrado?.sessionId ?? doCompromisso?.sessionId ?? null,
        sessionSource: lembrado?.sessionId ? "nome" : doCompromisso ? "compromisso" : null,
        appointmentTitle: doCompromisso?.title ?? null,
      };
    });
    const pending = lines.filter((linha) => !linha.entryId && !linha.ignored).length;
    const resposta = { year, month, pending, checked: lines.length > 0 && pending === 0, lines };
    if (pagina === undefined) return resposta;
    // Com busca, só as linhas desses nomes; `pending` continua sendo o total sem lançamento do mês.
    const termos = termosDaBusca(busca);
    const semLancamento = lines.filter((linha) => !linha.entryId && !linha.ignored && casaComABusca(linha.description, termos));
    // Página 0: tudo de uma vez, para quem lê o mês inteiro (o assistente) não precisar de uma chamada por página.
    if (pagina === 0) {
      return {
        ...resposta,
        lines: semLancamento.slice(0, LINHAS_DA_CONFERENCIA_DE_UMA_VEZ),
        page: { number: 1, size: LINHAS_DA_CONFERENCIA_DE_UMA_VEZ, total: semLancamento.length },
      };
    }
    const inicio = (pagina - 1) * LINHAS_DA_CONFERENCIA_POR_PAGINA;
    return {
      ...resposta,
      lines: semLancamento.slice(inicio, inicio + LINHAS_DA_CONFERENCIA_POR_PAGINA),
      page: { number: pagina, size: LINHAS_DA_CONFERENCIA_POR_PAGINA, total: semLancamento.length },
    };
  }

  async confirmar(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    valor?: ValorDoMes,
    diferenca?: DiferencaDoPagamento,
  ) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    const [year, month] = gravada.date.split("-").map(Number);
    if (gravada.entryId === entryId) return this.conferencia(tenantId, year, month);
    await this.cruzarELiquidar(tenantId, statementId, line, { ...gravada, date: gravada.date }, entryId, valor, false, diferenca);
    return this.conferencia(tenantId, year, month);
  }

  /** O lançamento aberto e o valor dele no mês da linha, se ele ainda tem vaga para mais uma linha nesse mês. */
  private async livreNoMes(tenantId: string, date: string, cents: number, entryId: string, daSessaoFixa: boolean) {
    const [year, month] = date.split("-").map(Number);
    const entry = await this.financas.obterAberto(tenantId, entryId);
    const planejado = entry ? valorContado(entry, date) : null;
    const mes = `${year}-${String(month).padStart(2, "0")}`;
    const doMes = (entry?.occurrences ?? []).filter(
      (item) => item.dueDate.startsWith(mes) && (item.status === "pending" || item.status === "completed"),
    );
    const usadas = entry ? await this.extratos.contarLinhasDoLancamento(tenantId, entryId, year, month) : 0;
    const pendentesDaSerie = (entry?.occurrences ?? []).filter((item) => item.status === "pending").length;
    const livre =
      entry && planejado !== null
        ? cabeNaLinha(
            { date, cents },
            {
              entryId: entry.id,
              description: entry.name,
              groupName: entry.groupName,
              sessionName: entry.sessionName,
              sessionId: entry.sessionId,
              day: Number(date.slice(8, 10)),
              cents: planejado,
              category: entry.category,
              vagas: ehSerie(entry.category) ? pendentesDaSerie : doMes.length - usadas,
            },
          )
        : false;
    if (!entry || planejado === null || !livre) {
      throw new PedidoInvalido(
        daSessaoFixa ? MENSAGEM_DA_SESSAO_FIXA_LANCADA : "Esse lançamento não está livre para esta linha no mês.",
      );
    }
    return { entry, planejado };
  }

  /**
   * Liga a linha ao lançamento e paga a ocorrência do mês. `daSessaoFixa` é a transação de uma sessão Fixo: ela
   * cruza como compromisso, então valores diferentes pedem a escolha da pessoa, e a recusa fala da sessão.
   */
  private async cruzarELiquidar(
    tenantId: string,
    statementId: string,
    line: number,
    gravada: LinhaGravada,
    entryId: string,
    valor?: ValorDoMes,
    daSessaoFixa = false,
    diferenca?: DiferencaDoPagamento,
  ) {
    if (gravada.entryId) throw new Conflito("Essa linha já foi cruzada.");
    if (gravada.ignored) throw new Conflito(MENSAGEM_DA_LINHA_IGNORADA);
    const { entry, planejado } = await this.livreNoMes(tenantId, gravada.date, gravada.cents, entryId, daSessaoFixa);
    // Parcela e empréstimo: a linha paga o que falta, no valor dela; a sobra é multa ou parte da próxima.
    const centavos = ehSerie(entry.category)
      ? gravada.cents
      : daSessaoFixa
        ? valorDaSessaoFixa(planejado, gravada.cents, valor)
        : valorDoMes(entry.category, planejado, gravada.cents, valor);
    if (centavos === "extra") throw new PedidoInvalido("Adicional só cruza com entrada.");
    if (centavos === "escolha") {
      throw new PedidoInvalido("Escolha o valor deste mês: o do extrato ou o do lançamento.");
    }
    await this.cruzar(tenantId, statementId, line, entryId, gravada.description);
    try {
      await this.financas.pagarPeloExtrato(tenantId, entryId, gravada.date, centavos, {
        paymentId: idDoPagamentoDaLinha(statementId, line),
        ...(diferenca ? { diferenca } : {}),
      });
    } catch (error) {
      await this.extratos.desfazerCruzamento(tenantId, statementId, line).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Volta a linha para antes do lançamento, como se ela nunca tivesse sido lançada: o lançamento que nasceu dela é
   * apagado (com o nome e a associação que ele deixou), e o que já existia volta a pendente.
   */
  async desfazer(tenantId: string, statementId: string, line: number) {
    const { year, month } = await this.desfazerLinha(tenantId, statementId, line);
    return this.conferencia(tenantId, year, month);
  }

  /**
   * Desfaz o que a linha fez, como se ela nunca tivesse sido lançada. `emExclusao` são os lançamentos que quem
   * chamou vai apagar em seguida: esses não são reabertos nem apagados aqui. `tolerante` segue adiante quando um
   * lançamento não pode mais ser reaberto ou apagado (a linha fica solta do mesmo jeito).
   */
  private async desfazerLinha(
    tenantId: string,
    statementId: string,
    line: number,
    emExclusao: ReadonlySet<string> = new Set(),
    tolerante = false,
  ) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    if (!gravada.entryId) throw new Conflito("Essa linha não está cruzada.");
    const [year, month] = gravada.date.split("-").map(Number);
    const data = gravada.date;
    const key = chaveDoNome(gravada.description);
    const tentar = async (acao: () => Promise<unknown>) => {
      try {
        await acao();
      } catch (error) {
        if (!tolerante) throw error;
      }
    };
    if ((gravada.parts ?? []).length > 1) {
      const partes = await this.extratos.desfazerDivisao(tenantId, statementId, line, key);
      for (const parte of partes) {
        if (emExclusao.has(parte.entryId)) continue;
        if (parte.created || (await this.extratos.lancamentoSoltoDoExtrato(tenantId, parte.entryId))) {
          await tentar(() => this.financas.excluir(tenantId, parte.entryId));
        } else {
          const indice = partes.indexOf(parte);
          await tentar(() => this.financas.reabrirPeloExtrato(tenantId, parte.entryId, data, parte.cents, idDoPagamentoDaLinha(statementId, line, indice)));
        }
      }
      return { year, month };
    }
    const entryId = gravada.entryId;
    const solta = await this.extratos.desfazerCruzamento(tenantId, statementId, line, key);
    if (emExclusao.has(entryId)) return { year, month };
    // Também o lançamento que nasceu de outra linha do extrato, já desfeita: sem esta, ele não tem por que existir.
    const apagar =
      (typeof solta === "object" && solta.created) || (await this.extratos.lancamentoSoltoDoExtrato(tenantId, entryId));
    if (apagar) {
      try {
        await this.financas.excluir(tenantId, entryId);
      } catch (error) {
        if (tolerante) return { year, month };
        await this.cruzar(tenantId, statementId, line, entryId, gravada.description, undefined, true).catch(() => undefined);
        throw error;
      }
      return { year, month };
    }
    try {
      await this.financas.reabrirPeloExtrato(tenantId, entryId, data, gravada.cents, idDoPagamentoDaLinha(statementId, line));
    } catch (error) {
      if (tolerante) return { year, month };
      await this.cruzar(tenantId, statementId, line, entryId, gravada.description).catch(() => undefined);
      throw error;
    }
    return { year, month };
  }

  /**
   * Solta as linhas ligadas aos lançamentos (ou aos de uma sessão ou de um grupo) antes de quem chamou apagá-los ou
   * encerrar a sessão. O que a linha criou some, o que ela pagou volta a pendente, e o nome e a associação dela
   * somem. É o mesmo desfazer da Conferência, feito pelo lado do lançamento.
   */
  async liberarLinhas(tenantId: string, onde: OndeEstaoOsLancamentos, emExclusao: ReadonlySet<string> = new Set()) {
    for (const { statementId, line } of await this.extratos.linhasDosLancamentos(tenantId, onde)) {
      await this.desfazerLinha(tenantId, statementId, line, emExclusao, true);
    }
  }

  /**
   * Desfaz toda a conferência, como se os extratos tivessem acabado de ser importados: cada linha cruzada ou
   * dividida volta a pendente (o lançamento que nasceu dela some, o que ela pagou reabre), as ignoradas voltam, e
   * os nomes lembrados e as associações de descrição são esquecidos. Os extratos e as linhas ficam.
   */
  async desfazerConferencia(tenantId: string): Promise<ConferenciaDesfeita> {
    const linhas = await this.extratos.linhasCruzadas(tenantId);
    for (const { statementId, line } of linhas) {
      await this.desfazerLinha(tenantId, statementId, line, new Set(), true);
    }
    // O que o extrato criou e já não tem linha (de fluxos antigos) também sai: nada da conferência fica.
    let orphans = 0;
    for (const entryId of await this.extratos.lancamentosSoltosDoExtrato(tenantId)) {
      await this.financas.excluir(tenantId, entryId).then(() => { orphans += 1; }, () => undefined);
    }
    const reactivated = await this.extratos.reativarTodas(tenantId);
    const names = await this.extratos.esquecerTudo(tenantId);
    return { lines: linhas.length, reactivated, names, orphans };
  }

  esquecerAssociacoesDaSessao(tenantId: string, sessionId: string) {
    return this.extratos.esquecerAssociacoesDaSessao(tenantId, sessionId);
  }

  async acumular(tenantId: string, statementId: string, line: number, sessionId: string, opcoes: OpcoesDoLancamento = {}) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    const [year, month] = gravada.date.split("-").map(Number);
    await this.lancarLinha(tenantId, statementId, line, sessionId, opcoes, { ...gravada, date: gravada.date });
    return this.conferencia(tenantId, year, month);
  }

  /**
   * Acúmulo: a linha vira um lançamento único e pago na sessão. Fixo com a transação já lançada: a linha cruza com
   * ela (e valores diferentes pedem a escolha da pessoa), e a sessão não recebe outra linha, a menos que a pessoa
   * marque `emPartes`.
   */
  private async lancarLinha(
    tenantId: string,
    statementId: string,
    line: number,
    sessionId: string,
    opcoes: OpcoesDoLancamento = {},
    ja?: LinhaGravada,
  ) {
    const lida = ja ?? (await this.extratos.obterLinha(tenantId, statementId, line));
    if (lida === "ausente" || !lida.date) throw new NaoEncontrado("Linha não encontrada.");
    const gravada = { ...lida, date: lida.date };
    if (gravada.entryId) throw new Conflito("Essa linha já foi cruzada.");
    if (gravada.ignored) throw new Conflito(MENSAGEM_DA_LINHA_IGNORADA);
    if (!gravada.cents) throw new PedidoInvalido("A linha não tem valor para acumular.");
    if (!opcoes.emPartes) {
      const [ano, mes] = gravada.date.split("-").map(Number);
      const fixa = await this.financas.lancamentoDaSessaoFixa(tenantId, sessionId, ano, mes);
      if (fixa) {
        await this.cruzarELiquidar(tenantId, statementId, line, gravada, fixa.entryId, opcoes.valor, true);
        return;
      }
    }
    const nome = nomeDaLinha(opcoes.nome, gravada.description);
    const criado = await this.criarDaLinha(tenantId, gravada, sessionId, gravada.cents, nome, opcoes.emPartes === true, opcoes.tipo);
    try {
      await this.cruzar(tenantId, statementId, line, criado.id, gravada.description, nome, true);
    } catch (error) {
      await this.financas.excluir(tenantId, criado.id);
      throw error;
    }
    try {
      await this.financas.pagarPeloExtrato(tenantId, criado.id, gravada.date, gravada.cents, { paymentId: idDoPagamentoDaLinha(statementId, line) });
    } catch (error) {
      await this.extratos.desfazerCruzamento(tenantId, statementId, line).catch(() => undefined);
      await this.financas.excluir(tenantId, criado.id).catch(() => undefined);
      throw error;
    }
  }

  /**
   * O lançamento que nasce de uma linha (ou de uma parte dela), na data do extrato, do tipo que a pessoa escolheu.
   * Única e extra nascem pagas: só têm esta ocorrência. Parcela, empréstimo e recorrente nascem pendentes, com as
   * mesmas regras das Finanças (prioridade, compromisso, regra de vencimento), e a ocorrência desta linha é paga em
   * seguida. A única fica na data exata do extrato; as outras seguem o padrão de vencimento das configurações.
   */
  private criarDaLinha(
    tenantId: string,
    gravada: LinhaGravada,
    sessionId: string,
    cents: number,
    nome: string,
    emPartes: boolean,
    pedidoDoTipo: TipoDaLinha = { category: "unique" },
  ) {
    // Os padrões entram antes da conferência: recorrente é mensal e a parcela atual é a primeira, se não disserem.
    const tipo: TipoDaLinha = {
      ...pedidoDoTipo,
      installmentNumber: pedidoDoTipo.installmentNumber ?? 1,
      recurrence: pedidoDoTipo.recurrence ?? "monthly",
      recurrenceInterval: pedidoDoTipo.recurrenceInterval ?? 1,
    };
    const erro = erroDoTipoDaLinha(tipo, cents);
    if (erro) throw new PedidoInvalido(erro);
    const category = tipo.category;
    const unica = category === "unique" || category === "additional";
    const parcelada = category === "installment" || category === "loan";
    const pedido: PedidoLancamento = {
      id: randomUUID(),
      sessionId,
      accountId: gravada.accountId,
      name: nome,
      description: nome,
      justification: JUSTIFICATIVA_DO_EXTRATO,
      date: gravada.date,
      mode: cents < 0 ? "outflows" : "inflows",
      status: unica ? "completed" : "pending",
      transactionType: "unusual",
      category,
      priority: "nopriority",
      cents: Math.abs(cents),
      installments: parcelada ? (tipo.installments ?? (category === "loan" ? 1 : null)) : null,
      installmentNumber: parcelada ? (tipo.installmentNumber ?? null) : null,
      dueDate: null,
      interestRate: null,
      counterparty: category === "loan" ? (tipo.counterparty ?? "") : "",
      principalCents: category === "loan" ? (tipo.principalCents ?? null) : null,
      nextDueDate: category === "fixed" ? gravada.date : null,
      recurrence: category === "fixed" ? (tipo.recurrence ?? null) : null,
      recurrenceInterval: category === "fixed" ? (tipo.recurrenceInterval ?? null) : null,
      dueRule: unica ? REGRA_SEM_AJUSTE : null,
    };
    return this.financas.registrar(tenantId, pedido, emPartes);
  }

  /**
   * Divide a linha em vários lançamentos pagos, cada um na sua sessão e com o seu nome. A soma das partes é o valor
   * da linha. A parte que vai para uma sessão Fixo já lançada paga a transação dela com o valor da parte, em vez de
   * criar outra. Se uma parte falhar, o que já foi feito é desfeito e a linha fica como estava.
   */
  async dividir(tenantId: string, statementId: string, line: number, partes: ParteDaLinha[]) {
    const lida = await this.extratos.obterLinha(tenantId, statementId, line);
    if (lida === "ausente" || !lida.date) throw new NaoEncontrado("Linha não encontrada.");
    const gravada = { ...lida, date: lida.date };
    if (gravada.entryId) throw new Conflito("Essa linha já foi cruzada.");
    if (gravada.ignored) throw new Conflito(MENSAGEM_DA_LINHA_IGNORADA);
    const erro = erroDaDivisao(gravada.cents, partes.map((parte) => parte.cents));
    if (erro) throw new PedidoInvalido(erro);
    const [year, month] = gravada.date.split("-").map(Number);
    const fixas = await Promise.all(partes.map((parte) => this.financas.lancamentoDaSessaoFixa(tenantId, parte.sessionId, year, month)));
    const pagas = fixas.flatMap((fixa) => (fixa ? [fixa.entryId] : []));
    if (new Set(pagas).size !== pagas.length) throw new PedidoInvalido("Duas partes não podem ir para a mesma sessão fixa.");
    const feitas: ParteGravada[] = [];
    try {
      for (const [indice, parte] of partes.entries()) {
        const fixa = fixas[indice];
        if (fixa) {
          await this.livreNoMes(tenantId, gravada.date, parte.cents, fixa.entryId, true).catch((error: unknown) => {
            if (!(error instanceof PedidoInvalido)) throw error;
            throw new PedidoInvalido(
              `A sessão fixa da parte ${indice + 1} já foi paga neste mês ou não cabe nesta linha. Escolha outra sessão para ela.`,
            );
          });
          await this.financas.pagarPeloExtrato(tenantId, fixa.entryId, gravada.date, parte.cents, { paymentId: idDoPagamentoDaLinha(statementId, line, indice) });
          feitas.push({ entryId: fixa.entryId, cents: parte.cents, created: false });
          continue;
        }
        const nome = nomeDaLinha(parte.nome, gravada.description);
        const criado = await this.criarDaLinha(tenantId, gravada, parte.sessionId, parte.cents, nome, false, parte.tipo);
        feitas.push({ entryId: criado.id, cents: parte.cents, created: true });
        await this.financas.pagarPeloExtrato(tenantId, criado.id, gravada.date, parte.cents, { paymentId: idDoPagamentoDaLinha(statementId, line, indice) });
      }
      // A parte que pagou a fixa fica com o nome da transação dela: só as criadas deixam nome lembrado.
      const nomes = this.nomesParaLembrar(gravada.description, partes.filter((_, indice) => !fixas[indice]));
      const resultado = await this.extratos.dividirLinha(tenantId, statementId, line, feitas, nomes);
      if (resultado === "ausente") throw new NaoEncontrado("Linha não encontrada.");
      if (resultado === "cruzada") throw new Conflito("Essa linha já foi cruzada.");
      if (resultado === "ignorada") throw new Conflito(MENSAGEM_DA_LINHA_IGNORADA);
    } catch (error) {
      for (const parte of feitas) {
        const volta = parte.created
          ? this.financas.excluir(tenantId, parte.entryId)
          : this.financas.reabrirPeloExtrato(tenantId, parte.entryId, gravada.date, parte.cents);
        await volta.catch(() => undefined);
      }
      throw error;
    }
    return this.conferencia(tenantId, year, month);
  }

  /** Só vale lembrar o nome diferente da descrição: a descrição a Conferência já oferece sempre. */
  private nomesParaLembrar(descricao: string, partes: { nome?: string }[]) {
    const key = chaveDoNome(descricao);
    if (!key) return [];
    const nomes = new Set(
      partes.map((parte) => nomeDaLinha(parte.nome, descricao)).filter((nome) => chaveDoNome(nome) !== key),
    );
    return [...nomes].map((name) => ({ key, name }));
  }

  async acumularVarias(
    tenantId: string,
    itens: ({ statementId: string; line: number; sessionId: string } & OpcoesDoLancamento)[],
  ) {
    const failed: { statementId: string; line: number; message: string }[] = [];
    const meses = new Map<string, { year: number; month: number }>();
    let launched = 0;
    for (const item of itens) {
      // O mês da linha, para dizer no fim o que ainda sobra nele. Não pode virar falha do lançamento.
      const gravada = await this.extratos.obterLinha(tenantId, item.statementId, item.line).catch(() => "ausente" as const);
      if (gravada !== "ausente" && gravada.date) {
        const [year, month] = gravada.date.split("-").map(Number);
        meses.set(`${year}-${month}`, { year, month });
      }
      try {
        await this.lancarLinha(tenantId, item.statementId, item.line, item.sessionId, {
          ...(item.valor ? { valor: item.valor } : {}),
          ...(item.emPartes ? { emPartes: true } : {}),
          ...(item.nome ? { nome: item.nome } : {}),
          ...(item.tipo ? { tipo: item.tipo } : {}),
        });
        launched += 1;
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "Não foi possível lançar a linha.";
        failed.push({ statementId: item.statementId, line: item.line, message });
      }
    }
    // Quem pediu o lote (o assistente, por exemplo) vê quantas linhas ainda ficaram sem lançamento, em vez de supor
    // que terminou. É o mesmo número da conferência.
    const remaining = await Promise.all(
      [...meses.values()].map(async ({ year, month }) => ({
        year,
        month,
        lines: await this.extratos.contarSemLancamento(tenantId, year, month),
      })),
    );
    return { launched, failed, remaining };
  }

  /** Ignora ou reativa linhas do extrato. Ignorada não é apagada: sai da conferência e volta quando reativada. */
  async ignorar(tenantId: string, itens: { statementId: string; line: number }[], ignorar: boolean) {
    const changed = await this.extratos.ignorarLinhas(tenantId, itens, ignorar);
    return { changed };
  }

  /** Liga a linha ao lançamento. `criado` diz que o lançamento nasceu da linha: desfazer apaga ele. */
  private async cruzar(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    description: string,
    nome?: string,
    criado = false,
  ) {
    const [lembrar] = nome ? this.nomesParaLembrar(description, [{ nome }]) : [];
    const resultado = await this.extratos.confirmarCruzamento(
      tenantId,
      statementId,
      line,
      entryId,
      ehTransferenciaDePessoa(description) ? null : chaveDoNome(description) || null,
      lembrar ?? null,
      criado,
    );
    if (resultado === "ausente") throw new NaoEncontrado("Linha não encontrada.");
    if (resultado === "lancamento-ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (resultado === "cruzada") throw new Conflito("Essa linha já foi cruzada.");
  }

  // Reprocessar ou excluir apaga as linhas e o vínculo delas. Antes, cada linha cruzada é desfeita: o que ela criou
  // some e o que ela pagou volta a pendente, como se a linha nunca tivesse sido lançada.
  private async desfazerCruzadas(tenantId: string, id: string) {
    for (const { statementId, line } of await this.extratos.linhasCruzadasDoExtrato(tenantId, id)) {
      await this.desfazerLinha(tenantId, statementId, line, new Set(), true);
    }
  }

  async excluir(tenantId: string, id: string) {
    await this.desfazerCruzadas(tenantId, id);
    const resultado = await this.extratos.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
  }

  private async leituraOcr(tenantId: string, filename: string, content: string, observacao = "") {
    this.bytes(content);
    const mediaType = tipoDaMidia(filename);
    if (!mediaType) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    const modelo = await this.modeloDaLeitura(tenantId);
    const lines = await this.organizador.organizar({
      tenantId,
      filename: nomeDoArquivo(filename),
      mediaType,
      content,
      ...(observacao ? { observacao } : {}),
      ...modelo,
    });
    return leituraDasLinhas(lines);
  }

  /** O modelo da função "Leitura de extratos" da IA; sem ela, a chave e o modelo antigos das preferências. */
  private async modeloDaLeitura(tenantId: string) {
    const leitura = await this.ia.modeloDaLeitura(tenantId);
    if (leitura) {
      return {
        model: leitura.model,
        ...(leitura.apiKey ? { apiKey: leitura.apiKey } : {}),
        ...(leitura.kind !== "openai" && leitura.baseUrl ? { baseUrl: leitura.baseUrl } : {}),
      };
    }
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.aiModel) {
      throw new PedidoInvalido("Escolha um modelo para a leitura de extratos em Configurações, Inteligência artificial.");
    }
    return { model: segredos.aiModel, ...(segredos.aiApiKey ? { apiKey: segredos.aiApiKey } : {}) };
  }

  private ler(filename: string, content: string, mapping: MapeamentoExtrato | null) {
    const bytes = this.bytes(content);
    const lido = lerArquivo(bytes, nomeDoArquivo(filename), mapping);
    if (!("leitura" in lido)) throw new PedidoInvalido(lido.message);
    return lido;
  }

  private bytes(content: string) {
    const bytes = bytesDoConteudo(content);
    if (bytes === "grande") throw new PedidoInvalido("O arquivo passa de 5 MB.");
    if (bytes === "invalido") throw new PedidoInvalido("Não foi possível ler o arquivo.");
    return bytes;
  }
}

function vinculoDe(entryId: string | null, entries: Lancamento[]): VinculoCruzado | null {
  if (!entryId) return null;
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return null;
  return {
    entryId: entry.id,
    description: entry.name || entry.description,
    groupName: entry.groupName,
    sessionName: entry.sessionName,
    day: entry.day,
    cents: entry.cents,
    category: entry.category,
  };
}
