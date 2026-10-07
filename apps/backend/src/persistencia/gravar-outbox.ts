import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export function marcaDe(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export async function gravarOutbox(
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
