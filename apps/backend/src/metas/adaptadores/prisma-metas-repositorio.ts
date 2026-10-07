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
      orderBy: { name: "asc" },
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
      const criada = await tx.goal.create({
        data: {
          id: pedido.id,
          tenantId,
          name: pedido.name,
          targetCents: pedido.targetCents,
          savedCents: pedido.savedCents,
          dueYear: pedido.dueYear,
          dueMonth: pedido.dueMonth,
        },
      });
      await gravarOutbox(tx, tenantId, "criar-meta", pedido.id, pedido, marcaDe(pedido));
      return metaDe(criada);
    });
  }

  async excluir(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagadas = await tx.goal.deleteMany({ where: { id, tenantId } });
      if (apagadas.count === 0) return false;
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
}): Meta {
  return {
    id: row.id,
    name: row.name,
    targetCents: row.targetCents,
    savedCents: row.savedCents,
    dueYear: row.dueYear,
    dueMonth: row.dueMonth,
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
