ALTER TABLE "entries" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "entries" ADD COLUMN "occurred_on" DATE;
ALTER TABLE "entries" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'outflows';
ALTER TABLE "entries" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "entries" ADD COLUMN "transaction_type" TEXT NOT NULL DEFAULT 'unusual';
ALTER TABLE "entries" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE "entries" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "entries" ADD COLUMN "installment_number" INTEGER;
ALTER TABLE "entries" ADD COLUMN "due_on" DATE;
ALTER TABLE "entries" ADD COLUMN "interest_bps" INTEGER;
ALTER TABLE "entries" ADD COLUMN "next_due_on" DATE;
ALTER TABLE "entries" ADD COLUMN "suspended_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "entries" ADD COLUMN "commitment_id" TEXT;

UPDATE "entries"
SET
  "name" = "description",
  "occurred_on" = make_date("start_year", "start_month", LEAST("day", 28)),
  "mode" = CASE WHEN "cents" > 0 THEN 'inflows' ELSE 'outflows' END,
  "category" = CASE "type"
    WHEN 'adicional' THEN 'additional'
    WHEN 'parcela' THEN 'installment'
    WHEN 'empréstimo' THEN 'loan'
    WHEN 'fixo' THEN 'fixed'
    ELSE 'unique'
  END,
  "installment_number" = CASE
    WHEN "type" IN ('parcela', 'empréstimo') THEN 1
    ELSE NULL
  END;

UPDATE "entries"
SET "next_due_on" = "occurred_on"
WHERE "category" = 'fixed';

ALTER TABLE "entries" ALTER COLUMN "occurred_on" SET NOT NULL;

CREATE TABLE "entry_adjustments" (
    "entry_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,

    CONSTRAINT "entry_adjustments_pkey" PRIMARY KEY ("entry_id","year","month")
);

CREATE INDEX "entry_adjustments_tenant_id_idx" ON "entry_adjustments"("tenant_id");

ALTER TABLE "entry_adjustments" ADD CONSTRAINT "entry_adjustments_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
