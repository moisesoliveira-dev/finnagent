import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Grupo, Sessao } from "@finnagent/contracts";
import type { Prisma } from "@prisma/client";
import { BancoIndisponivel, NaoEncontrado } from "../dominio/erros.js";
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
      select: { id: true, name: true, description: true },
    });
    const sessions = await db.session.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, groupId: true, name: true, description: true, cents: true },
    });
    return { groups, sessions };
  }

  async criarGrupo(tenantId: string, id: string, name: string, description: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.group.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (atual.name === name && atual.description === description) return grupoDe(atual);
        return "identificador" as const;
      }
      const ocupado = await nomeDeGrupoOcupado(tx, tenantId, name);
      if (ocupado) return "nome" as const;
      const criado = await tx.group.create({ data: { id, tenantId, name, description } });
      await gravarOutbox(tx, tenantId, "criar-grupo", id, { id, name, description });
      return grupoDe(criado);
    });
  }

  async atualizarGrupo(tenantId: string, id: string, name: string, description: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.group.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      const ocupado = await nomeDeGrupoOcupado(tx, tenantId, name, id);
      if (ocupado) return "nome" as const;
      const gravados = await tx.group.updateMany({
        where: { id, tenantId },
        data: { name, description },
      });
      if (gravados.count !== 1) return "ausente" as const;
      const salvo = await tx.group.findFirst({ where: { id, tenantId } });
      if (!salvo) return "ausente" as const;
      const payload = { id, name, description };
      await gravarOutbox(tx, tenantId, "atualizar-grupo", id, payload, marcaDe(payload));
      return grupoDe(salvo);
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
        const apagadas = await tx.session.deleteMany({
          where: { id: sessao.id, tenantId, groupId: id },
        });
        if (apagadas.count !== 1) throw new NaoEncontrado("Sessão não encontrada.");
      }
      await gravarOutbox(tx, tenantId, "remover-grupo", id, { id });
      const apagados = await tx.group.deleteMany({ where: { id, tenantId } });
      if (apagados.count !== 1) throw new NaoEncontrado("Grupo não encontrado.");
      return true;
    });
  }

  async criarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    description: string,
    cents: number,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (
          atual.groupId === groupId &&
          atual.name === name &&
          atual.description === description &&
          atual.cents === cents
        ) {
          return sessaoDe(atual);
        }
        return "identificador" as const;
      }
      if (!(await grupoDoTenant(tx, tenantId, groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, groupId, name)) return "nome" as const;
      const criada = await tx.session.create({
        data: { id, tenantId, groupId, name, description, cents },
      });
      await gravarOutbox(tx, tenantId, "criar-sessao", id, {
        id,
        groupId,
        name,
        description,
        cents,
      });
      return sessaoDe(criada);
    });
  }

  async atualizarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    description: string,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      if (!(await grupoDoTenant(tx, tenantId, groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, groupId, name, id)) return "nome" as const;
      const gravadas = await tx.session.updateMany({
        where: { id, tenantId },
        data: { groupId, name, description },
      });
      if (gravadas.count !== 1) return "ausente" as const;
      const salva = await tx.session.findFirst({ where: { id, tenantId } });
      if (!salva) return "ausente" as const;
      const payload = { id, groupId, name, description };
      await gravarOutbox(tx, tenantId, "atualizar-sessao", id, payload, marcaDe(payload));
      return sessaoDe(salva);
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
      const apagadas = await tx.session.deleteMany({ where: { id, tenantId } });
      if (apagadas.count !== 1) throw new NaoEncontrado("Sessão não encontrada.");
      return true;
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function grupoDe(row: { id: string; name: string; description: string }): Grupo {
  return { id: row.id, name: row.name, description: row.description };
}

function sessaoDe(row: {
  id: string;
  groupId: string;
  name: string;
  description: string;
  cents: number;
}): Sessao {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    description: row.description,
    cents: row.cents,
  };
}

function marcaDe(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

async function grupoDoTenant(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.group.findFirst({ where: { id, tenantId } });
}

async function nomeDeGrupoOcupado(
  tx: Prisma.TransactionClient,
  tenantId: string,
  name: string,
  ignorarId?: string,
) {
  return tx.group.findFirst({
    where: {
      tenantId,
      name: { equals: name, mode: "insensitive" },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
}

async function nomeDeSessaoOcupado(
  tx: Prisma.TransactionClient,
  tenantId: string,
  groupId: string,
  name: string,
  ignorarId?: string,
) {
  return tx.session.findFirst({
    where: {
      tenantId,
      groupId,
      name: { equals: name, mode: "insensitive" },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
}

async function gravarOutbox(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operation: string,
  entityId: string,
  payload: unknown,
  marca = "",
) {
  const idempotencyKey = marca
    ? `${tenantId}:${operation}:${entityId}:${marca}`
    : `${tenantId}:${operation}:${entityId}`;
  await tx.outbox.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId,
        operation,
        idempotencyKey,
        payload: JSON.stringify(payload),
      },
    ],
    skipDuplicates: true,
  });
}
