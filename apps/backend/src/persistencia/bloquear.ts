import type { Prisma } from "@prisma/client";

/**
 * Trava, até o fim da transação, quem pede a mesma chave. Quem chega depois espera, lê o que o primeiro gravou e
 * decide de novo. Vale entre réplicas, porque a trava é do Postgres.
 */
export async function bloquear(tx: Prisma.TransactionClient, chave: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chave}))`;
}
