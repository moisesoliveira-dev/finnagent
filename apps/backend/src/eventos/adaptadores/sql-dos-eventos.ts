import { Prisma } from "@prisma/client";
import {
  AGREGADO_DE_OPERACAO_DESCONHECIDA,
  CAMPOS_DO_ID_DO_AGREGADO,
  CATEGORIA_DE_OPERACAO_DESCONHECIDA,
  OPERACOES_DE_EVENTO,
  ORIGEM_PADRAO_DO_EVENTO,
  STATUS_DA_LINHA,
  type FiltroDeEventos,
  type LinhaOutbox,
} from "@finnagent/contracts";

export type LinhaDoBanco = {
  id: string;
  operation: string;
  idempotency_key: string;
  payload: string;
  occurred_at: Date;
  published_at: Date | null;
  consumed_at: Date | null;
};

// A tabela das operações vem do contrato, para o banco dar a mesma categoria, agregado e origem que a tela.
const OPERACOES = Prisma.join(
  OPERACOES_DE_EVENTO.map((item) => Prisma.sql`(${item.operation}, ${item.category}, ${item.aggregate}, ${item.origin})`),
);

/**
 * Os eventos do tenant com os campos que a tela filtra: categoria, agregado, origem, status e o dia no fuso
 * da conta. `occurred_at` é guardado em UTC, sem fuso.
 */
export function eventosDoTenant(tenantId: string, fuso: string, consulta: Prisma.Sql) {
  return Prisma.sql`WITH operacoes (operation, categoria, agregado, origem) AS (VALUES ${OPERACOES}),
    base AS (
      SELECT o.id, o.operation, o.idempotency_key, o.payload, o.occurred_at, o.published_at, c.consumed_at,
        COALESCE(m.categoria, ${CATEGORIA_DE_OPERACAO_DESCONHECIDA}) AS categoria,
        COALESCE(m.agregado, ${AGREGADO_DE_OPERACAO_DESCONHECIDA}) AS agregado,
        COALESCE(m.origem, ${ORIGEM_PADRAO_DO_EVENTO}) AS origem,
        CASE
          WHEN o.published_at IS NULL THEN ${STATUS_DA_LINHA.semPublicar}
          WHEN c.idempotency_key IS NULL THEN ${STATUS_DA_LINHA.semConsumir}
          ELSE ${STATUS_DA_LINHA.consumida}
        END AS status,
        ((o.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE ${fuso})::date AS dia
      FROM outbox o
      LEFT JOIN consumed_events c ON c.tenant_id = o.tenant_id AND c.idempotency_key = o.idempotency_key
      LEFT JOIN operacoes m ON m.operation = o.operation
      WHERE o.tenant_id = ${tenantId}
    )
    ${consulta}`;
}

/**
 * O WHERE da lista. `ignorar` tira um filtro, para a contagem daquele filtro mostrar todas as opções;
 * `desde` limita o dia, para o volume.
 */
export function condicoes(
  filtro: FiltroDeEventos,
  opcoes: { ignorar?: "categoria" | "status" | "dia"; desde?: string } = {},
) {
  const partes: Prisma.Sql[] = [];
  if (filtro.categoria && opcoes.ignorar !== "categoria") partes.push(Prisma.sql`categoria = ${filtro.categoria}`);
  if (filtro.status && opcoes.ignorar !== "status") partes.push(Prisma.sql`status = ${filtro.status}`);
  if (filtro.dia && opcoes.ignorar !== "dia") partes.push(Prisma.sql`dia = ${filtro.dia}::date`);
  if (opcoes.desde) partes.push(Prisma.sql`dia >= ${opcoes.desde}::date`);
  if (filtro.q) partes.push(busca(filtro.q));
  return partes.length ? Prisma.sql`WHERE ${Prisma.join(partes, " AND ")}` : Prisma.empty;
}

// Começo de id: letras, números e hífen. Só com isso a busca entra no payload, e o padrão fica preso ao valor
// do id: com aspas ou vírgula ele seguiria para os campos seguintes e, letra a letra, revelaria o que a tela mascara.
const PARECE_ID = /^[0-9a-z-]+$/i;

// O mesmo critério da tela: o texto no tipo, no agregado ou na origem; e, se parecer id, o começo do id do
// evento ou do agregado. O resto do payload fica de fora da busca.
function busca(texto: string) {
  const noTexto = Prisma.sql`lower(operation || ' ' || agregado || ' ' || origem) LIKE ${`%${escaparLike(texto.toLowerCase())}%`}`;
  if (!PARECE_ID.test(texto)) return Prisma.sql`(${noTexto})`;
  const ids = CAMPOS_DO_ID_DO_AGREGADO.map((campo) => Prisma.sql`payload ILIKE ${`%"${campo}":"${texto}%`}`);
  return Prisma.sql`(${noTexto} OR id ILIKE ${`${texto}%`} OR ${Prisma.join(ids, " OR ")})`;
}

export function ondeNoHistorico(tenantId: string, busca: string, desde: Date | null) {
  const partes = [Prisma.sql`c.tenant_id = ${tenantId}`];
  if (desde) partes.push(Prisma.sql`c.consumed_at >= (${desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')`);
  if (busca) partes.push(Prisma.sql`lower(o.operation) LIKE ${`%${escaparLike(busca)}%`}`);
  return Prisma.sql`WHERE ${Prisma.join(partes, " AND ")}`;
}

/** Tira o sentido especial de `%`, `_` e da barra no LIKE. */
export function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

export function linhaDe(row: LinhaDoBanco): LinhaOutbox {
  return {
    id: row.id,
    operation: row.operation,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    occurredAt: row.occurred_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null,
    consumedAt: row.consumed_at?.toISOString() ?? null,
  };
}
