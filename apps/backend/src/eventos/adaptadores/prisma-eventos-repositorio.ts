import { Injectable } from "@nestjs/common";
import { montarEventos, type LinhaConsumo, type LinhaOutbox } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { EventosRepositorio } from "../portas/eventos-repositorio.js";

@Injectable()
export class PrismaEventosRepositorio implements EventosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const banco = this.banco();
    const [eventos, consumos] = await Promise.all([
      banco.outbox.findMany({ where: { tenantId } }),
      banco.consumedEvent.findMany({ where: { tenantId } }),
    ]);
    return montarEventos(eventos.map(linhaDe), consumos.map(consumoDe));
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function linhaDe(row: {
  id: string;
  operation: string;
  idempotencyKey: string;
  payload: string;
  occurredAt: Date;
  publishedAt: Date | null;
}): LinhaOutbox {
  return {
    id: row.id,
    operation: row.operation,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function consumoDe(row: { idempotencyKey: string; consumedAt: Date }): LinhaConsumo {
  return {
    idempotencyKey: row.idempotencyKey,
    consumedAt: row.consumedAt.toISOString(),
  };
}
