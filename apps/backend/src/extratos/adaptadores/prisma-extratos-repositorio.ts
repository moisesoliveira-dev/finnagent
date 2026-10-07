import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Extrato, LinhaExtrato, MapeamentoExtrato, StatusExtrato } from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import type { LeituraExtrato } from "../dominio/ler-extrato.js";
import type { ExtratosRepositorio, GravacaoExtrato, LinhaImportada } from "../portas/extratos-repositorio.js";

const LIMITE_LINHAS = 100;

@Injectable()
export class PrismaExtratosRepositorio implements ExtratosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const db = this.banco();
    const [accounts, rows] = await Promise.all([
      db.account.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.statement.findMany({
        where: { tenantId },
        orderBy: { importedAt: "desc" },
        select: selecao,
      }),
    ]);
    return { accounts, statements: rows.map(extratoDe) };
  }

  async criar(tenantId: string, pedido: GravacaoExtrato) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.statement.findFirst({ where: { id: pedido.id, tenantId }, select: selecao });
      if (atual) {
        if (atual.contentHash === pedido.contentHash) return extratoDe(atual);
        return "identificador" as const;
      }
      const conta = await contaDe(tx, tenantId, pedido.accountId, pedido.accountName);
      if (conta === "ausente") return "conta-ausente" as const;
      if (await periodoRepetido(tx, tenantId, conta.id, pedido.id, pedido.leitura)) return "duplicado" as const;
      const importedAt = new Date();
      await tx.statement.create({
        data: {
          id: pedido.id,
          tenantId,
          accountId: conta.id,
          filename: pedido.filename,
          format: pedido.format,
          status: pedido.leitura.status,
          message: pedido.leitura.message,
          startDate: dataUtc(pedido.leitura.startDate),
          endDate: dataUtc(pedido.leitura.endDate),
          lineCount: pedido.leitura.lines.length,
          errorCount: pedido.leitura.lines.filter((linha) => linha.error).length,
          importedAt,
          content: new Uint8Array(pedido.bytes),
          contentHash: pedido.contentHash,
          dateColumn: pedido.mapping?.date ?? null,
          descriptionColumn: pedido.mapping?.description ?? null,
          amountColumn: pedido.mapping?.amount ?? null,
        },
      });
      await gravarLinhas(tx, tenantId, pedido.id, pedido.leitura.lines);
      await gravarOutbox(tx, tenantId, "importar-extrato", pedido.id, resumo(pedido.id, pedido.leitura), pedido.contentHash);
      const criado = await tx.statement.findFirstOrThrow({ where: { id: pedido.id, tenantId }, select: selecao });
      return extratoDe(criado);
    });
  }

  async linhas(tenantId: string, id: string, somenteErros: boolean) {
    const db = this.banco();
    const extrato = await db.statement.findFirst({ where: { id, tenantId }, select: { lineCount: true } });
    if (!extrato) return "ausente" as const;
    const where = { statementId: id, tenantId, ...(somenteErros ? { error: { not: "" } } : {}) };
    const [rows, matched] = await Promise.all([
      db.statementLine.findMany({ where, orderBy: { line: "asc" }, take: LIMITE_LINHAS }),
      db.statementLine.count({ where }),
    ]);
    return {
      total: extrato.lineCount,
      matched,
      lines: rows.map((row) => ({
        line: row.line,
        date: isoDe(row.postedOn),
        description: row.description,
        cents: row.cents,
        error: row.error,
      })),
    };
  }

  async carregar(tenantId: string, id: string) {
    const db = this.banco();
    const row = await db.statement.findFirst({
      where: { id, tenantId },
      select: {
        filename: true,
        content: true,
        dateColumn: true,
        descriptionColumn: true,
        amountColumn: true,
      },
    });
    if (!row) return "ausente" as const;
    return { filename: row.filename, bytes: Buffer.from(row.content), mapping: mapeamentoDe(row) };
  }

  async substituir(tenantId: string, id: string, leitura: LeituraExtrato, mapping: MapeamentoExtrato | null) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.statement.findFirst({ where: { id, tenantId }, select: { accountId: true } });
      if (!atual) return "ausente" as const;
      if (await periodoRepetido(tx, tenantId, atual.accountId, id, leitura)) return "duplicado" as const;
      await tx.statementLine.deleteMany({ where: { statementId: id, tenantId } });
      await gravarLinhas(tx, tenantId, id, leitura.lines);
      const payload = resumo(id, leitura);
      await tx.statement.updateMany({
        where: { id, tenantId },
        data: {
          status: leitura.status,
          message: leitura.message,
          startDate: dataUtc(leitura.startDate),
          endDate: dataUtc(leitura.endDate),
          lineCount: leitura.lines.length,
          errorCount: leitura.lines.filter((linha) => linha.error).length,
          importedAt: new Date(),
          dateColumn: mapping?.date ?? null,
          descriptionColumn: mapping?.description ?? null,
          amountColumn: mapping?.amount ?? null,
        },
      });
      await gravarOutbox(tx, tenantId, "reprocessar-extrato", id, payload, marcaDe(payload));
      const criado = await tx.statement.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      return extratoDe(criado);
    });
  }

  async listarLinhasNoMes(tenantId: string, year: number, month: number) {
    const db = this.banco();
    const inicio = new Date(Date.UTC(year, month - 1, 1));
    const fim = new Date(Date.UTC(year, month, 0));
    const rows = await db.statementLine.findMany({
      where: {
        tenantId,
        error: "",
        cents: { not: null },
        postedOn: { gte: inicio, lte: fim },
      },
      orderBy: [{ postedOn: "asc" }, { line: "asc" }],
      select: {
        statementId: true,
        line: true,
        postedOn: true,
        description: true,
        cents: true,
        entryId: true,
        statement: { select: { filename: true, account: { select: { name: true } } } },
      },
    });
    return rows.flatMap((row) => {
      if (row.cents === null || !row.postedOn) return [];
      const linha: LinhaImportada = {
        statementId: row.statementId,
        line: row.line,
        date: isoDe(row.postedOn) ?? "",
        description: row.description,
        cents: row.cents,
        accountName: row.statement.account.name,
        filename: row.statement.filename,
        entryId: row.entryId,
      };
      return [linha];
    });
  }

  async obterLinha(tenantId: string, statementId: string, line: number) {
    const db = this.banco();
    const row = await db.statementLine.findFirst({
      where: { tenantId, statementId, line, error: "", cents: { not: null } },
      select: {
        statementId: true,
        line: true,
        postedOn: true,
        description: true,
        cents: true,
        entryId: true,
        statement: { select: { filename: true, account: { select: { name: true } } } },
      },
    });
    if (!row?.postedOn || row.cents === null) return "ausente" as const;
    return {
      statementId: row.statementId,
      line: row.line,
      date: isoDe(row.postedOn) ?? "",
      description: row.description,
      cents: row.cents,
      accountName: row.statement.account.name,
      filename: row.statement.filename,
      entryId: row.entryId,
    };
  }

  async confirmarCruzamento(tenantId: string, statementId: string, line: number, entryId: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const linha = await tx.statementLine.findFirst({
        where: { statementId, line, tenantId },
        select: { entryId: true },
      });
      if (!linha) return "ausente" as const;
      const lancamento = await tx.entry.findFirst({ where: { id: entryId, tenantId }, select: { id: true } });
      if (!lancamento) return "lancamento-ausente" as const;
      if (linha.entryId === entryId) return;
      await tx.statementLine.updateMany({
        where: { statementId, line, tenantId },
        data: { entryId },
      });
      await gravarOutbox(tx, tenantId, "cruzar-linha", `${statementId}:${line}`, { statementId, line, entryId }, entryId);
    });
  }

  async excluir(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const removidos = await tx.statement.deleteMany({ where: { id, tenantId } });
      if (!removidos.count) return "ausente" as const;
      await gravarOutbox(tx, tenantId, "excluir-extrato", id, { id });
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

const selecao = {
  id: true,
  filename: true,
  format: true,
  status: true,
  message: true,
  startDate: true,
  endDate: true,
  lineCount: true,
  errorCount: true,
  importedAt: true,
  contentHash: true,
  account: { select: { id: true, name: true } },
} as const;

async function contaDe(
  tx: ParametroTransacao,
  tenantId: string,
  accountId: string | null,
  accountName: string | null,
) {
  if (accountId) {
    const conta = await tx.account.findFirst({ where: { id: accountId, tenantId }, select: { id: true } });
    return conta ?? "ausente";
  }
  const name = accountName?.trim() ?? "";
  const existente = await tx.account.findFirst({ where: { tenantId, name }, select: { id: true } });
  if (existente) return existente;
  return tx.account.create({ data: { id: randomUUID(), tenantId, name }, select: { id: true } });
}

async function periodoRepetido(
  tx: ParametroTransacao,
  tenantId: string,
  accountId: string,
  id: string,
  leitura: LeituraExtrato,
) {
  if (!leitura.startDate || !leitura.endDate) return false;
  const outro = await tx.statement.findFirst({
    where: {
      tenantId,
      accountId,
      startDate: dataUtc(leitura.startDate),
      endDate: dataUtc(leitura.endDate),
      NOT: { id },
    },
    select: { id: true },
  });
  return Boolean(outro);
}

async function gravarLinhas(tx: ParametroTransacao, tenantId: string, statementId: string, lines: LinhaExtrato[]) {
  if (!lines.length) return;
  await tx.statementLine.createMany({
    data: lines.map((linha) => ({
      statementId,
      tenantId,
      line: linha.line,
      postedOn: dataUtc(linha.date),
      description: linha.description,
      cents: linha.cents,
      error: linha.error,
    })),
  });
}

function resumo(id: string, leitura: LeituraExtrato) {
  return {
    id,
    status: leitura.status,
    lineCount: leitura.lines.length,
    errorCount: leitura.lines.filter((linha) => linha.error).length,
  };
}

function extratoDe(row: {
  id: string;
  filename: string;
  format: string;
  status: string;
  message: string;
  startDate: Date | null;
  endDate: Date | null;
  lineCount: number;
  errorCount: number;
  importedAt: Date;
  account: { id: string; name: string };
}): Extrato {
  return {
    id: row.id,
    filename: row.filename,
    format: row.format === "csv" ? "csv" : "ofx",
    accountId: row.account.id,
    accountName: row.account.name,
    startDate: isoDe(row.startDate),
    endDate: isoDe(row.endDate),
    lineCount: row.lineCount,
    errorCount: row.errorCount,
    status: statusDe(row.status),
    message: row.message,
    importedAt: row.importedAt.toISOString(),
  };
}

function statusDe(valor: string): StatusExtrato {
  if (valor === "com_erros" || valor === "processando" || valor === "falhou") return valor;
  return "importado";
}

function mapeamentoDe(row: { dateColumn: number | null; descriptionColumn: number | null; amountColumn: number | null }) {
  if (row.dateColumn === null || row.descriptionColumn === null || row.amountColumn === null) return null;
  return { date: row.dateColumn, description: row.descriptionColumn, amount: row.amountColumn };
}

function dataUtc(iso: string | null) {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

function isoDe(data: Date | null) {
  return data ? data.toISOString().slice(0, 10) : null;
}

type ParametroTransacao = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];
