import { Injectable } from "@nestjs/common";
import type { Grupo, Sessao } from "@finnagent/contracts";
import { Prisma } from "@prisma/client";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel, Conflito, NaoEncontrado } from "../dominio/erros.js";
import type { DadosDaSessao, GruposRepositorio } from "../portas/grupos-repositorio.js";

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
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        justification: true,
        startedAt: true,
        endedAt: true,
        cents: true,
      },
    });
    return { groups, sessions: sessions.map(sessaoDe) };
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
        await apagarSessao(tx, sessao.id, tenantId, id);
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
    dados: DadosDaSessao,
    cents: number,
    startedAt: string,
  ) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (atual) {
        if (sessaoIgual(atual, dados, cents)) return sessaoDe(atual);
        return "identificador" as const;
      }
      if (!(await grupoDoTenant(tx, tenantId, dados.groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, dados.groupId, dados.name)) {
        return "nome" as const;
      }
      const criada = await tx.session.create({
        data: {
          id,
          tenantId,
          cents,
          startedAt: dataPrisma(startedAt),
          endedAt: null,
          ...gravacao(dados),
        },
      });
      await gravarOutbox(tx, tenantId, "criar-sessao", id, {
        id,
        cents,
        startedAt,
        endedAt: null,
        ...dados,
      });
      return sessaoDe(criada);
    });
  }

  async atualizarSessao(tenantId: string, id: string, dados: DadosDaSessao) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.session.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      if (!(await grupoDoTenant(tx, tenantId, dados.groupId))) {
        return "grupo-ausente" as const;
      }
      if (await nomeDeSessaoOcupado(tx, tenantId, dados.groupId, dados.name, id)) {
        return "nome" as const;
      }
      const gravadas = await tx.session.updateMany({
        where: { id, tenantId },
        data: gravacao(dados),
      });
      if (gravadas.count !== 1) return "ausente" as const;
      const salva = await tx.session.findFirst({ where: { id, tenantId } });
      if (!salva) return "ausente" as const;
      const payload = { id, ...dados };
      await gravarOutbox(tx, tenantId, "atualizar-sessao", id, payload, marcaDe(payload));
      return sessaoDe(salva);
    });
  }

  async removerSessao(tenantId: string, id: string, endedAt: string) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const sessao = await tx.session.findFirst({ where: { id, tenantId } });
      if (!sessao) return false;
      if (sessao.endedAt) return true;
      const encerradas = await tx.session.updateMany({
        where: { id, tenantId, endedAt: null },
        data: { endedAt: dataPrisma(endedAt) },
      });
      if (encerradas.count !== 1) {
        const atual = await tx.session.findFirst({ where: { id, tenantId } });
        return Boolean(atual?.endedAt);
      }
      await gravarOutbox(tx, tenantId, "encerrar-sessao", id, {
        id,
        groupId: sessao.groupId,
        endedAt,
      });
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
  justification: string;
  startedAt: Date | null;
  endedAt: Date | null;
  cents: number;
}): Sessao {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    description: row.description,
    justification: row.justification,
    startedAt: dataIso(row.startedAt),
    endedAt: dataIso(row.endedAt),
    cents: row.cents,
  };
}

function gravacao(dados: DadosDaSessao) {
  return {
    groupId: dados.groupId,
    name: dados.name,
    description: dados.description,
    justification: dados.justification,
  };
}

function sessaoIgual(
  atual: {
    groupId: string;
    name: string;
    description: string;
    justification: string;
    cents: number;
  },
  dados: DadosDaSessao,
  cents: number,
) {
  return (
    atual.groupId === dados.groupId &&
    atual.name === dados.name &&
    atual.description === dados.description &&
    atual.justification === dados.justification &&
    atual.cents === cents
  );
}

function dataIso(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function dataPrisma(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function apagarSessao(
  tx: Prisma.TransactionClient,
  id: string,
  tenantId: string,
  groupId?: string,
) {
  try {
    const apagadas = await tx.session.deleteMany({
      where: { id, tenantId, ...(groupId ? { groupId } : {}) },
    });
    if (apagadas.count !== 1) throw new NaoEncontrado("Sessão não encontrada.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      throw new Conflito("Essa sessão tem lançamentos.");
    }
    throw error;
  }
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
      endedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
    },
  });
}
