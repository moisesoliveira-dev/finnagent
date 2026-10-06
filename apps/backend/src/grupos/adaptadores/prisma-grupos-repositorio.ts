import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Grupo, Sessao } from "@finnagent/contracts";
import type { Prisma } from "@prisma/client";
import { BancoIndisponivel } from "../dominio/erros.js";
import type { GruposRepositorio } from "../portas/grupos-repositorio.js";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class PrismaGruposRepositorio implements GruposRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const db = this.banco();
    const groups = await db.group.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const sessions = await db.session.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, groupId: true, name: true, cents: true },
    });
    return { groups, sessions };
  }

  async criarGrupo(tenantId: string, id: string, name: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.group.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (atual.name === name) return { id: atual.id, name: atual.name };
        return "identificador" as const;
      }
      const ocupado = await tx.group.findFirst({
        where: { tenantId, name: { equals: name, mode: "insensitive" } },
      });
      if (ocupado) return "nome" as const;
      await tx.group.create({ data: { id, tenantId, name } });
      await gravarOutbox(tx, tenantId, "criar-grupo", id, { id, name });
      return { id, name } satisfies Grupo;
    });
  }

  async removerGrupo(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const grupo = await tx.group.findFirst({ where: { id, tenantId } });
      if (!grupo) return false;
      const sessoes = await tx.session.findMany({
        where: { tenantId, groupId: id },
      });
      for (const sessao of sessoes) {
        await gravarOutbox(tx, tenantId, "remover-sessao", sessao.id, {
          id: sessao.id,
          groupId: id,
        });
        await tx.session.delete({ where: { id: sessao.id } });
      }
      await gravarOutbox(tx, tenantId, "remover-grupo", id, { id });
      await tx.group.delete({ where: { id } });
      return true;
    });
  }

  async criarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    cents: number,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (atual.groupId === groupId && atual.name === name && atual.cents === cents) {
          return sessaoDe(atual);
        }
        return "identificador" as const;
      }
      const grupo = await tx.group.findFirst({ where: { id: groupId, tenantId } });
      if (!grupo) return "grupo-ausente" as const;
      const ocupado = await tx.session.findFirst({
        where: {
          tenantId,
          groupId,
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (ocupado) return "nome" as const;
      const criada = await tx.session.create({
        data: { id, tenantId, groupId, name, cents },
      });
      await gravarOutbox(tx, tenantId, "criar-sessao", id, { id, groupId, name, cents });
      return sessaoDe(criada);
    });
  }

  async removerSessao(tenantId: string, id: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const sessao = await tx.session.findFirst({ where: { id, tenantId } });
      if (!sessao) return false;
      await gravarOutbox(tx, tenantId, "remover-sessao", id, {
        id,
        groupId: sessao.groupId,
      });
      await tx.session.delete({ where: { id } });
      return true;
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function sessaoDe(row: {
  id: string;
  groupId: string;
  name: string;
  cents: number;
}): Sessao {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    cents: row.cents,
  };
}

async function gravarOutbox(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operation: string,
  entityId: string,
  payload: unknown,
) {
  await tx.outbox.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId,
        operation,
        idempotencyKey: `${tenantId}:${operation}:${entityId}`,
        payload: JSON.stringify(payload),
      },
    ],
    skipDuplicates: true,
  });
}
