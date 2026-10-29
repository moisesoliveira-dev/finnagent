import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { REGRA_SEM_AJUSTE } from "@finnagent/contracts";
import {
  LINHAS_DA_CONFERENCIA_POR_PAGINA,
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
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { candidatosDaLinha, cruzaveisDoMes, propostaDaLinha, valorDoMes, vinculoDoCruzavel } from "../dominio/cruzar.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { ehOcr, tipoDaMidia } from "../dominio/formato-ocr.js";
import { leituraDasLinhas } from "../dominio/leitura-ocr.js";
import { chaveDoNome } from "../dominio/nome-extrato.js";
import { bytesDoConteudo, lerArquivo, nomeDoArquivo } from "../dominio/ler-extrato.js";
import { sessaoDoCompromisso } from "../dominio/sessao-do-compromisso.js";
import {
  EXTRATOS_REPOSITORIO,
  type ExtratosRepositorio,
  type GravacaoExtrato,
} from "../portas/extratos-repositorio.js";
import {
  ORGANIZADOR_DE_EXTRATO,
  type OrganizadorDeExtrato,
} from "../portas/organizador-de-extrato.js";

type Pedido = {
  id: string;
  filename: string;
  content: string;
  accountId: string | null;
  accountName: string | null;
  mapping: MapeamentoExtrato | null;
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
      mapping: lido.format === "csv" ? lido.mapping : null,
      leitura: lido.leitura,
    };
    const resultado = await this.extratos.criar(tenantId, gravacao);
    if (resultado === "duplicado") throw new Conflito("Já existe um extrato desta conta neste período.");
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outro extrato.");
    if (resultado === "conta-ausente") throw new NaoEncontrado("Conta não encontrada.");
    return resultado;
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
      const leitura = await this.leituraOcr(tenantId, atual.filename, atual.bytes.toString("base64"));
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
    await this.semCruzadas(tenantId, id, "reprocessar");
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

  async conferencia(tenantId: string, year: number, month: number, pagina?: number): Promise<ConferenciaResposta> {
    const abertas = await this.financas.listar(tenantId);
    const base = await this.financas.listar(tenantId, true);
    const linhas = await this.extratos.listarLinhasNoMes(tenantId, year, month);
    const lembrados = new Map(
      (await this.extratos.listarAssociacoes(tenantId)).map((item) => [item.name, item]),
    );
    const compromissos = await this.agenda.ocorrencias(tenantId, year, month);
    const cruzaveis = cruzaveisDoMes(
      abertas.entries,
      linhas.map((linha) => linha.entryId),
      year,
      month,
    );
    const lines = linhas.map(({ importedAt: _importedAt, ...linha }): LinhaConferencia => {
      const link = vinculoDe(linha.entryId, base.entries);
      if (linha.entryId) {
        return {
          ...linha,
          link,
          suggestion: null,
          suggestionSource: null,
          candidates: [],
          sessionId: null,
          sessionSource: null,
          appointmentTitle: null,
        };
      }
      const candidatos = candidatosDaLinha(linha, cruzaveis);
      const lembrado = lembrados.get(chaveDoNome(linha.description));
      const proposta = propostaDaLinha(linha, candidatos, lembrado);
      // O nome já lançado antes vale mais; sem ele, vale a sessão do compromisso que cai no dia da linha.
      const doCompromisso = lembrado?.sessionId ? null : sessaoDoCompromisso(linha.date, compromissos);
      return {
        ...linha,
        link: null,
        suggestion: proposta ? vinculoDoCruzavel(proposta.suggestion) : null,
        suggestionSource: proposta?.source ?? null,
        candidates: candidatos.map(vinculoDoCruzavel),
        sessionId: lembrado?.sessionId ?? doCompromisso?.sessionId ?? null,
        sessionSource: lembrado?.sessionId ? "nome" : doCompromisso ? "compromisso" : null,
        appointmentTitle: doCompromisso?.title ?? null,
      };
    });
    const pending = lines.filter((linha) => !linha.entryId).length;
    const resposta = { year, month, pending, checked: lines.length > 0 && pending === 0, lines };
    if (!pagina) return resposta;
    const semLancamento = lines.filter((linha) => !linha.entryId);
    const inicio = (pagina - 1) * LINHAS_DA_CONFERENCIA_POR_PAGINA;
    return {
      ...resposta,
      lines: semLancamento.slice(inicio, inicio + LINHAS_DA_CONFERENCIA_POR_PAGINA),
      page: { number: pagina, size: LINHAS_DA_CONFERENCIA_POR_PAGINA, total: semLancamento.length },
    };
  }

  async confirmar(tenantId: string, statementId: string, line: number, entryId: string, valor?: ValorDoMes) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    const [year, month] = gravada.date.split("-").map(Number);
    const atual = await this.conferencia(tenantId, year, month);
    const linha = atual.lines.find((item) => item.statementId === statementId && item.line === line);
    if (!linha) throw new NaoEncontrado("Linha não encontrada.");
    if (linha.entryId === entryId) return atual;
    if (linha.entryId) throw new Conflito("Essa linha já foi cruzada.");
    const candidato = linha.candidates.find((item) => item.entryId === entryId);
    if (!candidato) throw new PedidoInvalido("Esse lançamento não está livre para esta linha no mês.");
    const centavos = valorDoMes(candidato.category, candidato.cents, gravada.cents, valor);
    if (centavos === "extra") throw new PedidoInvalido("Adicional só cruza com entrada.");
    if (centavos === "escolha") {
      throw new PedidoInvalido("Escolha o valor deste mês: o do extrato ou o do lançamento.");
    }
    await this.cruzar(tenantId, statementId, line, entryId, gravada.description);
    try {
      await this.financas.pagarPeloExtrato(tenantId, entryId, gravada.date, centavos);
    } catch (error) {
      await this.extratos.desfazerCruzamento(tenantId, statementId, line).catch(() => undefined);
      throw error;
    }
    return this.conferencia(tenantId, year, month);
  }

  // Devolve a linha para "sem lançamento" e a ocorrência para pendente. O nome lembrado continua valendo.
  async desfazer(tenantId: string, statementId: string, line: number) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    if (!gravada.entryId) throw new Conflito("Essa linha não está cruzada.");
    const [year, month] = gravada.date.split("-").map(Number);
    const entryId = gravada.entryId;
    await this.extratos.desfazerCruzamento(tenantId, statementId, line);
    try {
      await this.financas.reabrirPeloExtrato(tenantId, entryId, gravada.date, gravada.cents);
    } catch (error) {
      await this.cruzar(tenantId, statementId, line, entryId, gravada.description).catch(() => undefined);
      throw error;
    }
    return this.conferencia(tenantId, year, month);
  }

  async acumular(tenantId: string, statementId: string, line: number, sessionId: string) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    if (gravada.entryId) throw new Conflito("Essa linha já foi cruzada.");
    if (!gravada.cents) throw new PedidoInvalido("A linha não tem valor para acumular.");
    const [year, month, day] = gravada.date.split("-").map(Number);
    const nome = (gravada.description.trim() || "Extrato").slice(0, 160);
    const criado = await this.financas.criar(tenantId, {
      id: randomUUID(),
      sessionId,
      type: "variável",
      description: nome,
      justification: "Lançamento do extrato.",
      day,
      cents: gravada.cents,
      startYear: year,
      startMonth: month,
      installments: null,
      name: nome,
      date: gravada.date,
      mode: gravada.cents < 0 ? "outflows" : "inflows",
      status: "completed",
      transactionType: "unusual",
      category: "unique",
      priority: "nopriority",
      installmentNumber: null,
      dueDate: null,
      interestRate: null,
      nextDueDate: null,
      recurrence: null,
      recurrenceInterval: null,
      dueRule: REGRA_SEM_AJUSTE,
    });
    try {
      await this.cruzar(tenantId, statementId, line, criado.id, gravada.description);
    } catch (error) {
      await this.financas.excluir(tenantId, criado.id);
      throw error;
    }
    try {
      await this.financas.pagarPeloExtrato(tenantId, criado.id, gravada.date, gravada.cents);
    } catch (error) {
      await this.extratos.desfazerCruzamento(tenantId, statementId, line).catch(() => undefined);
      await this.financas.excluir(tenantId, criado.id).catch(() => undefined);
      throw error;
    }
    return this.conferencia(tenantId, year, month);
  }

  async acumularVarias(
    tenantId: string,
    itens: { statementId: string; line: number; sessionId: string }[],
  ) {
    const failed: { statementId: string; line: number; message: string }[] = [];
    let launched = 0;
    for (const item of itens) {
      try {
        await this.acumular(tenantId, item.statementId, item.line, item.sessionId);
        launched += 1;
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "Não foi possível lançar a linha.";
        failed.push({ statementId: item.statementId, line: item.line, message });
      }
    }
    return { launched, failed };
  }

  private async cruzar(tenantId: string, statementId: string, line: number, entryId: string, description: string) {
    const resultado = await this.extratos.confirmarCruzamento(
      tenantId,
      statementId,
      line,
      entryId,
      chaveDoNome(description) || null,
    );
    if (resultado === "ausente") throw new NaoEncontrado("Linha não encontrada.");
    if (resultado === "lancamento-ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (resultado === "cruzada") throw new Conflito("Essa linha já foi cruzada.");
  }

  // Reprocessar ou excluir apaga as linhas e o vínculo delas. Com linha cruzada, a ocorrência ficaria paga sem origem.
  private async semCruzadas(tenantId: string, id: string, acao: "reprocessar" | "excluir") {
    const cruzadas = await this.extratos.contarCruzadas(tenantId, id);
    if (cruzadas === 0) return;
    const quantas = cruzadas === 1 ? "1 linha cruzada" : `${cruzadas} linhas cruzadas`;
    throw new Conflito(`Este extrato tem ${quantas}. Desfaça os cruzamentos na Conferência antes de ${acao}.`);
  }

  async excluir(tenantId: string, id: string) {
    await this.semCruzadas(tenantId, id, "excluir");
    const resultado = await this.extratos.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
  }

  private async leituraOcr(tenantId: string, filename: string, content: string) {
    this.bytes(content);
    const mediaType = tipoDaMidia(filename);
    if (!mediaType) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    const modelo = await this.modeloDaLeitura(tenantId);
    const lines = await this.organizador.organizar({
      tenantId,
      filename: nomeDoArquivo(filename),
      mediaType,
      content,
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
