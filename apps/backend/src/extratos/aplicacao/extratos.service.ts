import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  centavosNoMes,
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
import { sugerirCruzamento } from "../dominio/cruzar.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { ehOcr, tipoDaMidia } from "../dominio/formato-ocr.js";
import { leituraDasLinhas } from "../dominio/leitura-ocr.js";
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
      const leitura = await this.leituraOcr(tenantId, filename, content);
      return { format: "ocr", columns: [], mapping: null, lines: leitura.lines.slice(0, 3) };
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
    const lido = ehOcr(pedido.filename)
      ? {
          format: "ocr" as const,
          mapping: null,
          leitura: await this.leituraOcr(tenantId, pedido.filename, pedido.content),
        }
      : this.ler(pedido.filename, pedido.content, pedido.mapping);
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

  async linhas(tenantId: string, id: string, somenteErros: boolean): Promise<LinhasExtrato> {
    const resultado = await this.extratos.linhas(tenantId, id, somenteErros);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    return resultado;
  }

  async reprocessar(tenantId: string, id: string) {
    const atual = await this.extratos.carregar(tenantId, id);
    if (atual === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    if (ehOcr(atual.filename)) {
      const leitura = await this.leituraOcr(tenantId, atual.filename, atual.bytes.toString("base64"));
      const resultado = await this.extratos.substituir(tenantId, id, leitura, null);
      if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
      if (resultado === "duplicado") throw new Conflito("Já existe um extrato desta conta neste período.");
      return resultado;
    }
    const lido = lerArquivo(atual.bytes, atual.filename, atual.mapping);
    if (!("leitura" in lido)) throw new PedidoInvalido(lido.message);
    const resultado = await this.extratos.substituir(tenantId, id, lido.leitura, lido.mapping);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
    if (resultado === "duplicado") throw new Conflito("Já existe um extrato desta conta neste período.");
    return resultado;
  }

  async conferencia(tenantId: string, year: number, month: number): Promise<ConferenciaResposta> {
    const base = await this.financas.listar(tenantId);
    const doMes = lancamentosDoMes(base.entries, base.workflow, year, month);
    const linhas = await this.extratos.listarLinhasNoMes(tenantId, year, month);
    return {
      year,
      month,
      lines: linhas.map((linha) => {
        const link = vinculoDe(linha.entryId, base.entries);
        return {
          ...linha,
          link,
          suggestion: link ? null : sugerirCruzamento(linha, doMes),
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

  async excluir(tenantId: string, id: string) {
    const resultado = await this.extratos.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Extrato não encontrado.");
  }

  private async leituraOcr(tenantId: string, filename: string, content: string) {
    this.bytes(content);
    const mediaType = tipoDaMidia(filename);
    if (!mediaType) throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    const lines = await this.organizador.organizar({
      tenantId,
      filename: nomeDoArquivo(filename),
      mediaType,
      content,
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
