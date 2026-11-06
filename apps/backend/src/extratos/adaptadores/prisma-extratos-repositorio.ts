import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { TIPOS_DE_CONTA, type Extrato, type LinhaExtrato, type MapeamentoExtrato, type StatusExtrato } from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { JUSTIFICATIVA_DO_EXTRATO } from "../dominio/divisao.js";
import type { LeituraExtrato } from "../dominio/ler-extrato.js";
import { avisoDeRepetidas, descartarRepetidas } from "../dominio/repetidas.js";
import type { Prisma } from "@prisma/client";
import type {
  ExtratosRepositorio,
  GravacaoExtrato,
  LinhaImportada,
  NomeLembrado,
  OndeEstaoOsLancamentos,
  ParteGravada,
  ReservaExtrato,
} from "../portas/extratos-repositorio.js";

const LIMITE_LINHAS = 100;

@Injectable()
export class PrismaExtratosRepositorio implements ExtratosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const db = this.banco();
    const [accounts, rows] = await Promise.all([
      db.account.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true, openingCents: true } }),
      db.statement.findMany({
        where: { tenantId },
        orderBy: { importedAt: "desc" },
        select: selecao,
      }),
    ]);
    return {
      accounts: accounts.map((conta) => ({ ...conta, kind: TIPOS_DE_CONTA.find((item) => item === conta.kind) ?? "conta" })),
      statements: rows.map(extratoDe),
    };
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
          note: pedido.note,
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
        note: true,
        dateColumn: true,
        descriptionColumn: true,
        amountColumn: true,
      },
    });
    if (!row) return "ausente" as const;
    return { filename: row.filename, bytes: Buffer.from(row.content), note: row.note, mapping: mapeamentoDe(row) };
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
    // A parte de uma linha dividida também ocupa a vaga do lançamento que ela pagou.
    return this.banco().statementLine.count({
      where: {
        tenantId,
        postedOn: { gte: inicio, lt: fim },
        OR: [{ entryId }, { parts: { some: { tenantId, entryId } } }],
      },
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
        entryCreated: true,
        ignoredAt: true,
        parts: { where: { tenantId }, orderBy: { position: "asc" }, select: { entryId: true, cents: true, created: true } },
        statement: { select: { filename: true, importedAt: true, account: { select: { id: true, name: true } } } },
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
        accountId: row.statement.account.id,
        accountName: row.statement.account.name,
        filename: row.statement.filename,
        entryId: row.entryId,
        entryCreated: row.entryCreated,
        ignored: row.ignoredAt !== null,
        parts: row.parts,
        importedAt: row.statement.importedAt.toISOString(),
      };
      return [linha];
    });
  }

  async ultimoMesPendente(tenantId: string) {
    const db = this.banco();
    const row = await db.statementLine.findFirst({
      where: { tenantId, entryId: null, ignoredAt: null, error: "", cents: { not: null }, postedOn: { not: null } },
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
        ignoredAt: null,
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
        entryCreated: true,
        ignoredAt: true,
        parts: { where: { tenantId }, orderBy: { position: "asc" }, select: { entryId: true, cents: true, created: true } },
        statement: { select: { filename: true, importedAt: true, account: { select: { id: true, name: true } } } },
      },
    });
    if (!row?.postedOn || row.cents === null) return "ausente" as const;
    return {
      statementId: row.statementId,
      line: row.line,
      date: isoDe(row.postedOn) ?? "",
      description: row.description,
      cents: row.cents,
      accountId: row.statement.account.id,
        accountName: row.statement.account.name,
      filename: row.statement.filename,
      entryId: row.entryId,
        entryCreated: row.entryCreated,
      ignored: row.ignoredAt !== null,
      parts: row.parts,
      importedAt: row.statement.importedAt.toISOString(),
    };
  }

  async confirmarCruzamento(
    tenantId: string,
    statementId: string,
    line: number,
    entryId: string,
    name: string | null,
    lembrar: NomeLembrado | null = null,
    criado = false,
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
        data: { entryId, entryCreated: criado },
      });
      await gravarOutbox(tx, tenantId, "cruzar-linha", `${statementId}:${line}`, { statementId, line, entryId }, `${entryId}:${Date.now()}`);
      if (lembrar) await lembrarNome(tx, tenantId, lembrar);
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

  async desfazerCruzamento(tenantId: string, statementId: string, line: number, key?: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const linha = await tx.statementLine.findFirst({
        where: { statementId, line, tenantId },
        select: { entryId: true, entryCreated: true },
      });
      if (!linha) return "ausente" as const;
      if (!linha.entryId) return "livre" as const;
      await tx.statementLine.updateMany({
        where: { statementId, line, tenantId },
        data: { entryId: null, entryCreated: false },
      });
      const payload = { statementId, line, entryId: linha.entryId };
      await gravarOutbox(tx, tenantId, "desfazer-cruzamento", `${statementId}:${line}`, payload, `${linha.entryId}:${Date.now()}`);
      if (linha.entryCreated && key) await esquecerLancamento(tx, tenantId, key, linha.entryId);
      return { entryId: linha.entryId, created: linha.entryCreated };
    });
  }

  async ignorarLinhas(tenantId: string, itens: { statementId: string; line: number }[], ignorar: boolean) {
    const db = this.banco();
    // Uma atualização por extrato, com todas as linhas dele, em vez de uma por linha.
    const porExtrato = new Map<string, number[]>();
    for (const item of itens) porExtrato.set(item.statementId, [...(porExtrato.get(item.statementId) ?? []), item.line]);
    return db.$transaction(async (tx) => {
      let mudaram = 0;
      for (const [statementId, linhas] of porExtrato) {
        const { count } = await tx.statementLine.updateMany({
          where: {
            tenantId,
            statementId,
            line: { in: linhas },
            ...(ignorar ? { entryId: null, ignoredAt: null } : { ignoredAt: { not: null } }),
          },
          data: { ignoredAt: ignorar ? new Date() : null },
        });
        if (count === 0) continue;
        mudaram += count;
        const payload = { statementId, lines: linhas, ignored: ignorar };
        await gravarOutbox(tx, tenantId, ignorar ? "ignorar-linhas" : "reativar-linhas", statementId, payload, String(Date.now()));
      }
      return mudaram;
    });
  }

  async dividirLinha(
    tenantId: string,
    statementId: string,
    line: number,
    partes: ParteGravada[],
    lembrar: NomeLembrado[],
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const linha = await tx.statementLine.findFirst({
        where: { statementId, line, tenantId },
        select: { entryId: true, ignoredAt: true },
      });
      if (!linha) return "ausente" as const;
      if (linha.entryId) return "cruzada" as const;
      if (linha.ignoredAt) return "ignorada" as const;
      const [primeira] = partes;
      if (!primeira) return "ausente" as const;
      await tx.statementLine.updateMany({
        where: { statementId, line, tenantId },
        data: { entryId: primeira.entryId, entryCreated: primeira.created },
      });
      await tx.statementLinePart.createMany({
        data: partes.map((parte, indice) => ({
          tenantId,
          statementId,
          line,
          entryId: parte.entryId,
          cents: parte.cents,
          created: parte.created,
          position: indice + 1,
        })),
      });
      for (const nome of lembrar) await lembrarNome(tx, tenantId, nome);
      const payload = { statementId, line, parts: partes };
      await gravarOutbox(tx, tenantId, "dividir-linha", `${statementId}:${line}`, payload, String(Date.now()));
    });
  }

  async desfazerDivisao(tenantId: string, statementId: string, line: number, key: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const partes = await tx.statementLinePart.findMany({
        where: { tenantId, statementId, line },
        orderBy: { position: "asc" },
        select: { entryId: true, cents: true, created: true },
      });
      if (!partes.length) return [];
      await tx.statementLinePart.deleteMany({ where: { tenantId, statementId, line } });
      await tx.statementLine.updateMany({
        where: { statementId, line, tenantId },
        data: { entryId: null, entryCreated: false },
      });
      const entryIds = partes.map((parte) => parte.entryId);
      await gravarOutbox(tx, tenantId, "desfazer-divisao", `${statementId}:${line}`, { statementId, line, entryIds }, String(Date.now()));
      for (const parte of partes) if (parte.created) await esquecerLancamento(tx, tenantId, key, parte.entryId);
      return partes;
    });
  }

  async listarNomes(tenantId: string) {
    const db = this.banco();
    return db.statementName.findMany({
      where: { tenantId },
      orderBy: [{ lastUsedAt: "desc" }, { uses: "desc" }],
      select: { key: true, name: true },
      take: 5000,
    });
  }

  async linhasCruzadasDoExtrato(tenantId: string, id: string) {
    return this.banco().statementLine.findMany({
      where: { tenantId, statementId: id, entryId: { not: null } },
      orderBy: { line: "asc" },
      select: { statementId: true, line: true },
    });
  }

  async linhasCruzadas(tenantId: string) {
    return this.banco().statementLine.findMany({
      where: { tenantId, OR: [{ entryId: { not: null } }, { parts: { some: { tenantId } } }] },
      orderBy: [{ statementId: "asc" }, { line: "asc" }],
      select: { statementId: true, line: true },
    });
  }

  async reativarTodas(tenantId: string) {
    return this.banco().$transaction(async (tx) => {
      const { count } = await tx.statementLine.updateMany({ where: { tenantId, ignoredAt: { not: null } }, data: { ignoredAt: null } });
      if (count > 0) {
        const payload = { reactivated: count };
        await gravarOutbox(tx, tenantId, "desfazer-conferencia", `${tenantId}:reativar`, payload, String(Date.now()));
      }
      return count;
    });
  }

  async lancamentosSoltosDoExtrato(tenantId: string) {
    const rows = await this.banco().entry.findMany({
      where: {
        tenantId,
        justification: JUSTIFICATIVA_DO_EXTRATO,
        statementLines: { none: { tenantId } },
        statementLineParts: { none: { tenantId } },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async esquecerTudo(tenantId: string) {
    return this.banco().$transaction(async (tx) => {
      const nomes = await tx.statementName.deleteMany({ where: { tenantId } });
      const associacoes = await tx.statementAlias.deleteMany({ where: { tenantId } });
      const total = nomes.count + associacoes.count;
      if (total > 0) {
        const payload = { names: nomes.count, aliases: associacoes.count };
        await gravarOutbox(tx, tenantId, "desfazer-conferencia", `${tenantId}:esquecer`, payload, String(Date.now()));
      }
      return total;
    });
  }

  async linhasDosLancamentos(tenantId: string, onde: OndeEstaoOsLancamentos) {
    const lancamento: Prisma.EntryWhereInput = {
      tenantId,
      ...(onde.entryIds ? { id: { in: onde.entryIds } } : {}),
      ...(onde.sessionId ? { sessionId: onde.sessionId } : {}),
      ...(onde.groupId ? { session: { groupId: onde.groupId } } : {}),
    };
    return this.banco().statementLine.findMany({
      where: { tenantId, OR: [{ entry: lancamento }, { parts: { some: { tenantId, entry: lancamento } } }] },
      orderBy: [{ statementId: "asc" }, { line: "asc" }],
      select: { statementId: true, line: true },
    });
  }

  async esquecerAssociacoesDaSessao(tenantId: string, sessionId: string) {
    await this.banco().$transaction(async (tx) => {
      const nomes = await tx.statementAlias.findMany({ where: { tenantId, sessionId }, select: { name: true, entryId: true } });
      if (!nomes.length) return;
      await tx.statementAlias.deleteMany({ where: { tenantId, sessionId } });
      for (const { name, entryId } of nomes) {
        const payload = { name, entryId, removed: true };
        await gravarOutbox(tx, tenantId, "associar-nome-extrato", name, payload, marcaDe(payload));
      }
    });
  }

  async lancamentoSoltoDoExtrato(tenantId: string, entryId: string) {
    const solto = await this.banco().entry.count({
      where: {
        id: entryId,
        tenantId,
        justification: JUSTIFICATIVA_DO_EXTRATO,
        statementLines: { none: { tenantId } },
        statementLineParts: { none: { tenantId } },
      },
    });
    return solto > 0;
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
          note: pedido.note,
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
  note: true,
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
  note: string;
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
    note: row.note,
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

/** Guarda o nome que a pessoa deu, ou conta mais um uso dele. Vai na mesma transação da mudança da linha. */
/**
 * Desfaz o que um lançamento nascido da linha deixou: o nome dado a ele (um uso a menos, e some no último) e a
 * associação da descrição que aponta para ele. O lançamento em si quem chamou apaga.
 */
async function esquecerLancamento(tx: Prisma.TransactionClient, tenantId: string, key: string, entryId: string) {
  const lancamento = await tx.entry.findFirst({ where: { id: entryId, tenantId }, select: { description: true } });
  const name = lancamento?.description.trim();
  const lembrado = name
    ? await tx.statementName.findUnique({ where: { tenantId_key_name: { tenantId, key, name } }, select: { uses: true } })
    : null;
  if (name && lembrado) {
    const where = { tenantId_key_name: { tenantId, key, name } };
    if (lembrado.uses > 1) await tx.statementName.update({ where, data: { uses: { decrement: 1 } } });
    else await tx.statementName.delete({ where });
    await gravarOutbox(tx, tenantId, "esquecer-nome-extrato", `${key}:${name}`, { key, name }, `${entryId}:${Date.now()}`);
  }
  const { count } = await tx.statementAlias.deleteMany({ where: { tenantId, name: key, entryId } });
  if (count) {
    const payload = { name: key, entryId, removed: true };
    await gravarOutbox(tx, tenantId, "associar-nome-extrato", key, payload, marcaDe(payload));
  }
}

async function lembrarNome(tx: Prisma.TransactionClient, tenantId: string, nome: NomeLembrado) {
  const agora = new Date();
  await tx.statementName.upsert({
    where: { tenantId_key_name: { tenantId, key: nome.key, name: nome.name } },
    create: { tenantId, key: nome.key, name: nome.name, lastUsedAt: agora },
    update: { uses: { increment: 1 }, lastUsedAt: agora },
  });
  await gravarOutbox(tx, tenantId, "lembrar-nome-extrato", `${nome.key}:${nome.name}`, nome, String(agora.getTime()));
}
