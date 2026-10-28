import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FiltroDeEventos, LinhaOutbox } from "@finnagent/contracts";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { Contagem, ContagemNoDia } from "../dominio/pagina.js";
import type { EventosRepositorio, ResumoDeEventos } from "../portas/eventos-repositorio.js";
import { condicoes, eventosDoTenant, linhaDe, type LinhaDoBanco, ondeNoHistorico } from "./sql-dos-eventos.js";

@Injectable()
export class PrismaEventosRepositorio implements EventosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async resumir(tenantId: string, filtro: FiltroDeEventos, fuso: string, desde: string): Promise<ResumoDeEventos> {
    const banco = this.banco();
    const base = (consulta: Prisma.Sql) => eventosDoTenant(tenantId, fuso, consulta);
    const [total, porCategoria, porStatus, porDia] = await Promise.all([
      banco.$queryRaw<Array<{ total: number }>>(base(Prisma.sql`SELECT count(*)::int AS total FROM base ${condicoes(filtro)}`)),
      banco.$queryRaw<Contagem[]>(
        base(
          Prisma.sql`SELECT categoria AS chave, count(*)::int AS total FROM base ${condicoes(filtro, { ignorar: "categoria" })} GROUP BY categoria`,
        ),
      ),
      banco.$queryRaw<Contagem[]>(
        base(
          Prisma.sql`SELECT status AS chave, count(*)::int AS total FROM base ${condicoes(filtro, { ignorar: "status" })} GROUP BY status`,
        ),
      ),
      banco.$queryRaw<ContagemNoDia[]>(
        base(
          Prisma.sql`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, status, count(*)::int AS total FROM base ${condicoes(filtro, { ignorar: "dia", desde })} GROUP BY dia, status`,
        ),
      ),
    ]);
    return { total: total[0]?.total ?? 0, porCategoria, porStatus, porDia };
  }

  async listar(tenantId: string, filtro: FiltroDeEventos, fuso: string, deslocamento: number, tamanho: number) {
    const linhas = await this.banco().$queryRaw<LinhaDoBanco[]>(
      eventosDoTenant(
        tenantId,
        fuso,
        Prisma.sql`SELECT id, operation, idempotency_key, payload, occurred_at, published_at, consumed_at FROM base ${condicoes(filtro)} ORDER BY occurred_at DESC, id DESC LIMIT ${tamanho} OFFSET ${deslocamento}`,
      ),
    );
    return linhas.map(linhaDe);
  }

  async contarConsumidos(tenantId: string, busca: string, desde: Date | null) {
    const [linha] = await this.banco().$queryRaw<Array<{ total: number }>>(
      Prisma.sql`SELECT count(*)::int AS total
        FROM consumed_events c
        JOIN outbox o ON o.tenant_id = c.tenant_id AND o.idempotency_key = c.idempotency_key
        ${ondeNoHistorico(tenantId, busca, desde)}`,
    );
    return linha?.total ?? 0;
  }

  async listarConsumidos(tenantId: string, busca: string, desde: Date | null, deslocamento: number, tamanho: number) {
    const linhas = await this.banco().$queryRaw<LinhaDoBanco[]>(
      Prisma.sql`SELECT o.id, o.operation, o.idempotency_key, o.payload, o.occurred_at, o.published_at, c.consumed_at
        FROM consumed_events c
        JOIN outbox o ON o.tenant_id = c.tenant_id AND o.idempotency_key = c.idempotency_key
        ${ondeNoHistorico(tenantId, busca, desde)}
        ORDER BY c.consumed_at DESC, o.id DESC
        LIMIT ${tamanho} OFFSET ${deslocamento}`,
    );
    return linhas.map(linhaDe);
  }

  async buscar(tenantId: string, id: string): Promise<LinhaOutbox | null> {
    const banco = this.banco();
    const evento = await banco.outbox.findFirst({ where: { tenantId, id } });
    if (!evento) return null;
    const consumo = await banco.consumedEvent.findFirst({
      where: { tenantId, idempotencyKey: evento.idempotencyKey },
    });
    return linhaDe({
      id: evento.id,
      operation: evento.operation,
      idempotency_key: evento.idempotencyKey,
      payload: evento.payload,
      occurred_at: evento.occurredAt,
      published_at: evento.publishedAt,
      consumed_at: consumo?.consumedAt ?? null,
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}
