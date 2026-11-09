-- Caixinhas (depósitos) dentro das contas, cada uma com a sessão do rendimento.
CREATE TABLE "account_boxes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opening_cents" INTEGER NOT NULL DEFAULT 0,
    "session_id" TEXT NOT NULL,
    "goal_id" TEXT,

    CONSTRAINT "account_boxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_boxes_tenant_id_account_id_name_key" ON "account_boxes"("tenant_id", "account_id", "name");
CREATE UNIQUE INDEX "account_boxes_tenant_id_goal_id_key" ON "account_boxes"("tenant_id", "goal_id");
CREATE INDEX "account_boxes_tenant_id_idx" ON "account_boxes"("tenant_id");

ALTER TABLE "account_boxes" ADD CONSTRAINT "account_boxes_tenant_id_account_id_fkey" FOREIGN KEY ("tenant_id", "account_id") REFERENCES "accounts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
