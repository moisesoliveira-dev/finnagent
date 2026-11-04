import type { Prisma } from "@prisma/client";
import { gravarOutbox, marcaDe } from "./gravar-outbox.js";

/**
 * Solta os compromissos da agenda dos lançamentos que vão ser apagados. O compromisso ficava concluído por causa do
 * pagamento; sem o lançamento, volta a pendente, como se nunca tivesse sido pago.
 */
export async function desligarCompromissos(tx: Prisma.TransactionClient, tenantId: string, entryIds: string[]) {
  if (!entryIds.length) return;
  const concluidos = await tx.appointment.findMany({
    where: { tenantId, entryId: { in: entryIds }, status: "done" },
    select: { id: true },
  });
  await tx.appointment.updateMany({
    where: { tenantId, entryId: { in: entryIds } },
    data: { entryId: null, status: "undone" },
  });
  for (const { id } of concluidos) {
    const payload = { id, status: "undone" };
    await gravarOutbox(tx, tenantId, "atualizar-status-compromisso", id, payload, marcaDe({ ...payload, em: Date.now() }));
  }
}
