import { Injectable } from "@nestjs/common";
import type { Meta } from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import type { MetasRepositorio, NovaMeta } from "../portas/metas-repositorio.js";

@Injectable()
export class PrismaMetasRepositorio implements MetasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const rows = await this.banco().goal.findMany({
      where: { tenantId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    return rows.map(metaDe);
  }

  async criar(tenantId: string, pedido: NovaMeta) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.goal.findFirst({ where: { id: pedido.id, tenantId } });
      if (atual) {
        if (mesmaMeta(atual, pedido)) return metaDe(atual);
        return "identificador" as const;
      }
      // A meta nova entra no fim da fila de prioridade.
      const ultima = await tx.goal.aggregate({ where: { tenantId }, _max: { position: true } });
      const criada = await tx.goal.create({
        data: {
          position: (ultima._max.position ?? 0) + 1,
          id: pedido.id,
          tenantId,
          name: pedido.name,
          targetCents: pedido.targetCents,
          savedCents: pedido.savedCents,
          dueYear: pedido.dueYear,
          dueMonth: pedido.dueMonth,
          sessionId: pedido.sessionId,
        },
      });
      await gravarOutbox(tx, tenantId, "criar-meta", pedido.id, pedido, marcaDe(pedido));
      return metaDe(criada);
    });
  }

  async divisoes(tenantId: string, year: number, month: number) {
    const rows = await this.banco().goalAllocation.findMany({ where: { tenantId, year, month } });
    return rows.map((row) => ({ goalId: row.goalId, percent: row.percent, approvedCents: row.approvedCents }));
  }

  async dividir(tenantId: string, year: number, month: number, percentuais: Record<string, number>) {
    return this.banco().$transaction(async (tx) => {
      const metas = await tx.goal.findMany({ where: { tenantId }, select: { id: true } });
      const existentes = new Set(metas.map((meta) => meta.id));
      if (Object.keys(percentuais).some((id) => !existentes.has(id))) return "meta-ausente" as const;
      const atuais = await tx.goalAllocation.findMany({ where: { tenantId, year, month } });
      const aprovadas = new Set(atuais.filter((linha) => linha.approvedCents !== null).map((linha) => linha.goalId));
      await tx.goalAllocation.deleteMany({
        where: { tenantId, year, month, approvedCents: null },
      });
      const novas = Object.entries(percentuais).filter(([id, percent]) => percent > 0 && !aprovadas.has(id));
      if (novas.length) {
        await tx.goalAllocation.createMany({
          data: novas.map(([goalId, percent]) => ({ goalId, tenantId, year, month, percent })),
        });
      }
      const payload = { year, month, percentuais };
      await gravarOutbox(tx, tenantId, "dividir-sobra-das-metas", `${year}-${month}`, payload, marcaDe(payload));
      return "ok" as const;
    });
  }

  async aprovar(tenantId: string, goalId: string, year: number, month: number, cents: number) {
    return this.banco().$transaction(async (tx) => {
      const linha = await tx.goalAllocation.findFirst({ where: { tenantId, goalId, year, month } });
      if (!linha) return "sem-divisao" as const;
      if (linha.approvedCents !== null) return "ja-aprovada" as const;
      await tx.goalAllocation.updateMany({ where: { tenantId, goalId, year, month }, data: { approvedCents: cents } });
      await gravarOutbox(tx, tenantId, "aprovar-sobra-da-meta", `${goalId}:${year}-${month}`, { goalId, year, month, cents });
      return "ok" as const;
    });
  }

  async reabrir(tenantId: string, goalId: string, year: number, month: number) {
    await this.banco().goalAllocation.updateMany({ where: { tenantId, goalId, year, month }, data: { approvedCents: null } });
  }

  async reordenar(tenantId: string, ids: string[]) {
    return this.banco().$transaction(async (tx) => {
      const atuais = await tx.goal.findMany({ where: { tenantId }, select: { id: true } });
      const mesmas = atuais.length === ids.length && atuais.every((meta) => ids.includes(meta.id));
      if (!mesmas) return "diferente" as const;
      for (const [indice, id] of ids.entries()) {
        await tx.goal.updateMany({ where: { id, tenantId }, data: { position: indice + 1 } });
      }
      await gravarOutbox(tx, tenantId, "reordenar-metas", "ordem", { ids }, marcaDe(ids));
      return "ok" as const;
    });
  }

  async excluir(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.goal.deleteMany({ where: { id, tenantId } });
      if (apagadas.count === 0) return false;
      await tx.goalAllocation.deleteMany({ where: { goalId: id, tenantId } });
      await gravarOutbox(tx, tenantId, "excluir-meta", id, { id });
      return true;
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function metaDe(row: {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  dueYear: number | null;
  dueMonth: number | null;
  sessionId: string | null;
  position: number;
}): Meta {
  return {
    id: row.id,
    name: row.name,
    targetCents: row.targetCents,
    savedCents: row.savedCents,
    dueYear: row.dueYear,
    dueMonth: row.dueMonth,
    sessionId: row.sessionId,
    position: row.position,
  };
}

function mesmaMeta(
  atual: {
    name: string;
    targetCents: number;
    savedCents: number;
    dueYear: number | null;
    dueMonth: number | null;
  },
  pedido: NovaMeta,
) {
  return (
    atual.name === pedido.name &&
    atual.targetCents === pedido.targetCents &&
    atual.savedCents === pedido.savedCents &&
    atual.dueYear === pedido.dueYear &&
    atual.dueMonth === pedido.dueMonth
  );
}
