import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Extrato, LinhaExtrato, MapeamentoExtrato, StatusExtrato } from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import type { LeituraExtrato } from "../dominio/ler-extrato.js";
import { avisoDeRepetidas, descartarRepetidas } from "../dominio/repetidas.js";
import type { ExtratosRepositorio, GravacaoExtrato, ReservaExtrato, LinhaImportada } from "../portas/extratos-repositorio.js";

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
      if (await arquivoRepetido(tx, tenantId, conta.id, pedido.id, pedido.contentHash)) return "duplicado" as const;
      const leitura = await semRepetidas(tx, tenantId, conta.id, pedido.id, pedido.leitura);
      const importedAt = new Date();
      await tx.statement.create({
        data: {
          id: pedido.id,
          tenantId,
          accountId: conta.id,
          filename: pedido.filename,
          format: pedido.format,
          status: leitura.status,
          message: leitura.message,
          startDate: dataUtc(leitura.startDate),
          endDate: dataUtc(leitura.endDate),
          lineCount: leitura.lines.length,
          errorCount: leitura.lines.filter((linha) => linha.error).length,
          importedAt,
          content: new Uint8Array(pedido.bytes),
          contentHash: pedido.contentHash,
          dateColumn: pedido.mapping?.date ?? null,
          descriptionColumn: pedido.mapping?.description ?? null,
          amountColumn: pedido.mapping?.amount ?? null,
        },
      });
      await gravarLinhas(tx, tenantId, pedido.id, leitura.lines);
      await gravarOutbox(tx, tenantId, "importar-extrato", pedido.id, resumo(pedido.id, leitura), pedido.contentHash);
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

  async substituir(
    tenantId: string,
    id: string,
    bruta: LeituraExtrato,
    mapping: MapeamentoExtrato | null,
    operacao: "importar-extrato" | "reprocessar-extrato" = "reprocessar-extrato",
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.statement.findFirst({ where: { id, tenantId }, select: { accountId: true } });
      if (!atual) return "ausente" as const;
      if (await periodoRepetido(tx, tenantId, atual.accountId, id, bruta)) return "duplicado" as const;
      const leitura = await semRepetidas(tx, tenantId, atual.accountId, id, bruta);
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
      await gravarOutbox(tx, tenantId, operacao, id, payload, marcaDe(payload));
      const criado = await tx.statement.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      return extratoDe(criado);
    });
  }

  async contarLinhasDoLancamento(tenantId: string, entryId: string, year: number, month: number) {
    const inicio = new Date(Date.UTC(year, month - 1, 1));
    const fim = new Date(Date.UTC(year, month, 1));
    return this.banco().statementLine.count({
      where: { tenantId, entryId, postedOn: { gte: inicio, lt: fim } },
    });
  }

  async listarLinhasNoMes(tenantId: string, year: number, month: number) {
    const db = this.banco();
    const inicio = new Date(Date.UTC(year, month - 1, 1));
    const fim = new Date(Date.UTC(year, month, 1));
    const rows = await db.statementLine.findMany({
      where: {
        tenantId,
        error: "",
        cents: { not: null },
        postedOn: { gte: inicio, lt: fim },
      },
      orderBy: [{ postedOn: "asc" }, { line: "asc" }],
      select: {
        statementId: true,
        line: true,
        postedOn: true,
        description: true,
        cents: true,
        entryId: true,
        statement: { select: { filename: true, importedAt: true, account: { select: { name: true } } } },
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
        importedAt: row.statement.importedAt.toISOString(),
      };
      return [linha];
    });
  }

  async ultimoMesPendente(tenantId: string) {
    const db = this.banco();
    const row = await db.statementLine.findFirst({
      where: { tenantId, entryId: null, error: "", cents: { not: null }, postedOn: { not: null } },
      orderBy: { postedOn: "desc" },
      select: { postedOn: true },
    });
    if (!row?.postedOn) return null;
    return { year: row.postedOn.getUTCFullYear(), month: row.postedOn.getUTCMonth() + 1 };
  }

  async contarSemLancamento(tenantId: string, year: number, month: number | null) {
    const db = this.banco();
    const inicio = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
    const fim = month === null ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1));
    return db.statementLine.count({
      where: {
        tenantId,
        entryId: null,
        error: "",
        cents: { not: null },
        postedOn: { gte: inicio, lt: fim },
      },
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
        statement: { select: { filename: true, importedAt: true, account: { select: { name: true } } } },
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
      importedAt: row.statement.importedAt.toISOString(),
    };
  }

  async confirmarCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    name: string | null,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const linha = await tx.statementLine.findFirst({
        where: { statementId, line, tenantId },
        select: { entryId: true },
      });
      if (!linha) return "ausente" as const;
      const lancamento = await tx.entry.findFirst({
        where: { id: entryId, tenantId },
        select: { id: true, sessionId: true },
      });
      if (!lancamento) return "lancamento-ausente" as const;
      if (linha.entryId === entryId) return;
      if (linha.entryId) return "cruzada" as const;
      await tx.statementLine.updateMany({
        where: { statementId, line, tenantId },
        data: { entryId },
      });
      await gravarOutbox(tx, tenantId, "cruzar-linha", `${statementId}:${line}`, { statementId, line, entryId }, `${entryId}:${Date.now()}`);
      if (!name) return;
      const sessionId = lancamento.sessionId;
      await tx.statementAlias.upsert({
        where: { tenantId_name: { tenantId, name } },
        create: { tenantId, name, sessionId, entryId },
        update: { sessionId, entryId },
      });
      const payload = { name, sessionId, entryId };
      await gravarOutbox(tx, tenantId, "associar-nome-extrato", name, payload, marcaDe(payload));
    });
  }

  async desfazerCruzamento(tenantId: string, statementId: string, line: number) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const linha = await tx.statementLine.findFirst({
        where: { statementId, line, tenantId },
        select: { entryId: true },
      });
      if (!linha) return "ausente" as const;
      if (!linha.entryId) return "livre" as const;
      await tx.statementLine.updateMany({ where: { statementId, line, tenantId }, data: { entryId: null } });
      const payload = { statementId, line, entryId: linha.entryId };
      await gravarOutbox(tx, tenantId, "desfazer-cruzamento", `${statementId}:${line}`, payload, `${linha.entryId}:${Date.now()}`);
      return { entryId: linha.entryId };
    });
  }

  async contarCruzadas(tenantId: string, id: string) {
    const db = this.banco();
    return db.statementLine.count({ where: { tenantId, statementId: id, entryId: { not: null } } });
  }

  async listarAssociacoes(tenantId: string) {
    const db = this.banco();
    return db.statementAlias.findMany({
      where: { tenantId, session: { tenantId, endedAt: null } },
      select: { name: true, sessionId: true, entryId: true },
    });
  }

  async reservar(tenantId: string, pedido: ReservaExtrato) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.statement.findFirst({ where: { id: pedido.id, tenantId }, select: selecao });
      if (atual) {
        if (atual.contentHash === pedido.contentHash) return { extrato: extratoDe(atual), novo: false };
        return "identificador" as const;
      }
      const conta = await contaDe(tx, tenantId, pedido.accountId, pedido.accountName);
      if (conta === "ausente") return "conta-ausente" as const;
      if (await arquivoRepetido(tx, tenantId, conta.id, pedido.id, pedido.contentHash)) return "duplicado" as const;
      const importedAt = new Date();
      await tx.statement.create({
        data: {
          id: pedido.id,
          tenantId,
          accountId: conta.id,
          filename: pedido.filename,
          format: "ocr",
          status: "processando",
          message: "",
          lineCount: 0,
          errorCount: 0,
          importedAt,
          content: new Uint8Array(pedido.bytes),
          contentHash: pedido.contentHash,
        },
      });
      const payload = { id: pedido.id, status: "processando" };
      await gravarOutbox(tx, tenantId, "importar-extrato", pedido.id, payload, pedido.contentHash);
      const criado = await tx.statement.findFirstOrThrow({ where: { id: pedido.id, tenantId }, select: selecao });
      return { extrato: extratoDe(criado), novo: true };
    });
  }

  async marcarProcessando(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.statement.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!atual) return "ausente" as const;
      await tx.statementLine.deleteMany({ where: { statementId: id, tenantId } });
      await tx.statement.updateMany({
        where: { id, tenantId },
        data: {
          status: "processando",
          message: "",
          startDate: null,
          endDate: null,
          lineCount: 0,
          errorCount: 0,
        },
      });
      const payload = { id, status: "processando" };
      await gravarOutbox(tx, tenantId, "reprocessar-extrato", id, payload, marcaDe(payload));
      const criado = await tx.statement.findFirstOrThrow({ where: { id, tenantId }, select: selecao });
      return extratoDe(criado);
    });
  }

  async falhar(tenantId: string, id: string, message: string) {
    const db = this.banco();
    const texto = message.replace(/sk-[A-Za-z0-9_-]+/g, "").trim().slice(0, 300);
    await db.$transaction(async (tx) => {
      const atualizado = await tx.statement.updateMany({
        where: { id, tenantId, status: "processando" },
        data: { status: "falhou", message: texto || "Não foi possível ler o extrato." },
      });
      if (!atualizado.count) return;
      const payload = { id, status: "falhou", message: texto };
      await gravarOutbox(tx, tenantId, "importar-extrato", id, payload, marcaDe(payload));
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

async function arquivoRepetido(
  tx: ParametroTransacao,
  tenantId: string,
  accountId: string,
  id: string,
  contentHash: string,
) {
  const outro = await tx.statement.findFirst({
    where: { tenantId, accountId, contentHash, NOT: { id } },
    select: { id: true },
  });
  return Boolean(outro);
}

// O mesmo extrato pode chegar com outro período ou em outro arquivo. Linha já gravada em outro extrato da conta
// não entra de novo, para não ser cruzada e paga duas vezes.
async function semRepetidas(
  tx: ParametroTransacao,
  tenantId: string,
  accountId: string,
  id: string,
  leitura: LeituraExtrato,
): Promise<LeituraExtrato> {
  const datas = leitura.lines.flatMap((linha) => (linha.date ? [linha.date] : [])).sort();
  const inicio = dataUtc(datas[0] ?? null);
  const fim = dataUtc(datas.at(-1) ?? null);
  if (!inicio || !fim) return leitura;
  const gravadas = await tx.statementLine.findMany({
    where: {
      tenantId,
      error: "",
      cents: { not: null },
      postedOn: { gte: inicio, lte: fim },
      statement: { accountId, NOT: { id } },
    },
    select: { postedOn: true, description: true, cents: true },
  });
  const { lines, ignoradas } = descartarRepetidas(
    leitura.lines,
    gravadas.flatMap((row) =>
      row.postedOn && row.cents !== null
        ? [{ date: isoDe(row.postedOn) ?? "", cents: row.cents, description: row.description }]
        : [],
    ),
  );
  if (ignoradas === 0) return leitura;
  return {
    ...leitura,
    lines,
    message: [leitura.message, avisoDeRepetidas(ignoradas)].filter(Boolean).join(" "),
  };
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
    format: row.format === "csv" || row.format === "ocr" ? row.format : "ofx",
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
