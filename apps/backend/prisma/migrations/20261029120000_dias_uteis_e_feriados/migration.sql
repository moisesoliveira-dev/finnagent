-- Regra de vencimento do lançamento. Os que já existem ficam no dia como está, sem ajuste.
ALTER TABLE "entries" ADD COLUMN "due_rule" TEXT NOT NULL DEFAULT 'dia';
ALTER TABLE "entries" ADD COLUMN "due_order" INTEGER;
ALTER TABLE "entries" ADD COLUMN "due_shift" TEXT NOT NULL DEFAULT 'manter';
ALTER TABLE "entries" ADD COLUMN "due_count" TEXT NOT NULL DEFAULT 'bancaria';
ALTER TABLE "entries" ADD CONSTRAINT "entries_due_rule_check" CHECK ("due_rule" IN ('dia', 'dia_util', 'ultimo_dia_util'));
ALTER TABLE "entries" ADD CONSTRAINT "entries_due_shift_check" CHECK ("due_shift" IN ('manter', 'antecipar', 'adiar', 'adiar_no_mes'));
ALTER TABLE "entries" ADD CONSTRAINT "entries_due_count_check" CHECK ("due_count" IN ('bancaria', 'clt'));
ALTER TABLE "entries" ADD CONSTRAINT "entries_due_order_check" CHECK ("due_order" IS NULL OR "due_order" BETWEEN 1 AND 23);

-- Padrões por categoria (vazio usa os iniciais do sistema) e o que a agenda mostra.
ALTER TABLE "preferences" ADD COLUMN "due_defaults" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "preferences" ADD COLUMN "show_holidays" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "preferences" ADD COLUMN "show_optional_holidays" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "holidays_date_check" CHECK ("month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31)
);

CREATE UNIQUE INDEX "holidays_tenant_id_month_day_key" ON "holidays"("tenant_id", "month", "day");
CREATE INDEX "holidays_tenant_id_idx" ON "holidays"("tenant_id");
