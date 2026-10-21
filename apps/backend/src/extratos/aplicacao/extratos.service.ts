import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  centavosNoMes,
  propostaNoPrazo,
  type ConferenciaResposta,
  type ExtratosResposta,
  type Lancamento,
  type LinhasExtrato,
  type MapeamentoExtrato,
  type PreviaExtrato,
  type VinculoCruzado,
} from "@finnagent/contracts";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { sugerirCruzamento } from "../dominio/cruzar.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { ehOcr, tipoDaMidia } from "../dominio/formato-ocr.js";
import { leituraDasLinhas } from "../dominio/leitura-ocr.js";
import { chaveDoNome } from "../dominio/nome-extrato.js";
import { bytesDoConteudo, lerArquivo, nomeDoArquivo } from "../dominio/ler-extrato.js";
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
  ) {}

  listar(tenantId: string): Promise<ExtratosResposta> {
    return this.extratos.listar(tenantId);
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
    await this.aplicarAssociacoes(tenantId);
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
        return;
      }
      if (resultado !== "ausente") await this.aplicarAssociacoes(tenantId);
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
    await this.aplicarAssociacoes(tenantId);
    return resultado;
  }

  async conferencia(tenantId: string, year: number, month: number): Promise<ConferenciaResposta> {
    const abertas = await this.financas.listar(tenantId);
    const base = await this.financas.listar(tenantId, true);
    const doMes = lancamentosDoMes(abertas.entries, abertas.workflow, year, month);
    const linhas = await this.extratos.listarLinhasNoMes(tenantId, year, month);
    const preferencias = await this.configuracoes.obter(tenantId);
    if (preferencias.categorize === "aplicar") {
      for (const linha of linhas) {
        if (linha.entryId) continue;
        if (!propostaNoPrazo(linha.importedAt, preferencias.pendingHours)) continue;
        const suggestion = sugerirCruzamento(linha, doMes);
        if (!suggestion) continue;
        const cruzado = await this.extratos.confirmarCruzamento(
          tenantId,
          linha.statementId,
          linha.line,
          suggestion.entryId,
        );
        if (cruzado !== "ausente" && cruzado !== "lancamento-ausente") linha.entryId = suggestion.entryId;
      }
    }
    return {
      year,
      month,
      lines: linhas.map((linha) => {
        const { importedAt, ...resto } = linha;
        const link = vinculoDe(resto.entryId, base.entries);
        return {
          ...resto,
          link,
          suggestion:
            link || !propostaNoPrazo(importedAt, preferencias.pendingHours)
              ? null
              : sugerirCruzamento(resto, doMes),
        };
      }),
    };
  }

  async confirmar(tenantId: string, statementId: string, line: number) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    const [year, month] = gravada.date.split("-").map(Number);
    const conferencia = await this.conferencia(tenantId, year, month);
    const linha = conferencia.lines.find((item) => item.statementId === statementId && item.line === line);
    if (!linha) throw new NaoEncontrado("Linha não encontrada.");
    if (linha.link) return linha;
    if (!linha.suggestion) throw new PedidoInvalido("Não há uma proposta para esta linha.");
    const resultado = await this.extratos.confirmarCruzamento(tenantId, statementId, line, linha.suggestion.entryId);
    if (resultado === "ausente") throw new NaoEncontrado("Linha não encontrada.");
    if (resultado === "lancamento-ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    return { ...linha, entryId: linha.suggestion.entryId, link: linha.suggestion, suggestion: null };
  }

  async acumular(tenantId: string, statementId: string, line: number, sessionId: string) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    await this.acumularUma(tenantId, statementId, line, sessionId);
    const chave = chaveDoNome(gravada.description);
    if (chave) {
      const falha = await this.extratos.gravarAssociacao(tenantId, chave, sessionId);
      if (!falha) await this.aplicarNome(tenantId, chave, sessionId);
    }
    const [year, month] = gravada.date.split("-").map(Number);
    return this.conferencia(tenantId, year, month);
  }

  private async acumularUma(tenantId: string, statementId: string, line: number, sessionId: string) {
    const gravada = await this.extratos.obterLinha(tenantId, statementId, line);
    if (gravada === "ausente" || !gravada.date) throw new NaoEncontrado("Linha não encontrada.");
    if (gravada.entryId) throw new Conflito("Essa linha já foi sincronizada.");
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
    });
    const cruzamento = await this.extratos.confirmarCruzamento(tenantId, statementId, line, criado.id);
    if (cruzamento) {
      await this.financas.excluir(tenantId, criado.id);
      throw new NaoEncontrado("Linha não encontrada.");
    }
  }

  private async aplicarNome(tenantId: string, chave: string, sessionId: string) {
    const abertas = await this.extratos.linhasSemVinculo(tenantId);
    for (const linha of abertas) {
      if (chaveDoNome(linha.description) !== chave) continue;
      try {
        await this.acumularUma(tenantId, linha.statementId, linha.line, sessionId);
      } catch {
        continue;
      }
    }
  }

  private async aplicarAssociacoes(tenantId: string) {
    try {
      const associacoes = new Map(
        (await this.extratos.listarAssociacoes(tenantId)).map((item) => [item.name, item.sessionId]),
      );
      if (associacoes.size === 0) return;
      const abertas = await this.extratos.linhasSemVinculo(tenantId);
      for (const linha of abertas) {
        const sessionId = associacoes.get(chaveDoNome(linha.description));
        if (!sessionId) continue;
        try {
          await this.acumularUma(tenantId, linha.statementId, linha.line, sessionId);
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  async excluir(tenantId: string, id: string) {
    const resultado = await this.extratos.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
  }

  private async leituraOcr(tenantId: string, filename: string, content: string) {
    this.bytes(content);
    const mediaType = tipoDaMidia(filename);
    if (!mediaType) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    const segredos = await this.configuracoes.segredos(tenantId);
    if (!segredos?.aiModel) throw new PedidoInvalido("Cadastre um modelo de IA nas configurações.");
    const lines = await this.organizador.organizar({
      tenantId,
      filename: nomeDoArquivo(filename),
      mediaType,
      content,
      model: segredos.aiModel,
      ...(segredos?.aiApiKey ? { apiKey: segredos.aiApiKey } : {}),
    });
    return leituraDasLinhas(lines);
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

function lancamentosDoMes(entries: Lancamento[], workflow: { year: number; month: number; day: number }, year: number, month: number) {
  const monthIndex = month - 1;
  const ultimo = new Date(year, month, 0).getDate();
  const lancamentos = [];
  for (const entry of entries) {
    const cents = centavosNoMes(entry, workflow, year, monthIndex);
    if (cents === undefined) continue;
    lancamentos.push({
      id: entry.id,
      description: entry.description,
      groupName: entry.groupName,
      sessionName: entry.sessionName,
      day: Math.min(entry.day, ultimo),
      cents,
    });
  }
  return lancamentos;
}

function vinculoDe(entryId: string | null, entries: Lancamento[]): VinculoCruzado | null {
  if (!entryId) return null;
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return null;
  return {
    entryId: entry.id,
    description: entry.description,
    groupName: entry.groupName,
    sessionName: entry.sessionName,
    day: entry.day,
    cents: entry.cents,
  };
}
