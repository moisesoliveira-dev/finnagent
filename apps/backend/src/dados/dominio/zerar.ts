/** O que sai para a conta recomeçar. A ordem respeita as chaves que impedem apagar o pai antes do filho. */
export const TABELAS_QUE_ZERAM = [
  "statementAlias",
  "statementLine",
  "statement",
  "account",
  "appointment",
  "entry",
  "sessionAddition",
  "session",
  "group",
  "goalAllocation",
  "goal",
  "yearStay",
  "aiMessage",
  "aiConversation",
  "notification",
  "outbox",
  "consumedEvent",
] as const;

/** Configuração da conta. O zeramento não mexe nestas tabelas. */
export const TABELAS_QUE_FICAM = [
  "preference",
  "workflow",
  "holiday",
  "calendar",
  "user",
  "authSession",
  "aiProvider",
  "aiSettings",
  "notificationSetting",
  "pushDevice",
] as const;

type Nome = (typeof TABELAS_QUE_ZERAM)[number];

type Apaga = {
  deleteMany: (args: { where: { tenantId: string } }) => Promise<unknown>;
};

export type BancoQueZera = Record<Nome, Apaga> & {
  entry: Apaga & {
    updateMany: (args: { where: { tenantId: string }; data: { coveredById: null } }) => Promise<unknown>;
  };
};

export async function aplicarZeramento(banco: BancoQueZera, tenantId: string) {
  const onde = { where: { tenantId } };
  for (const nome of TABELAS_QUE_ZERAM) {
    if (nome === "entry") {
      await banco.entry.updateMany({ where: { tenantId }, data: { coveredById: null } });
    }
    await banco[nome].deleteMany(onde);
  }
}
