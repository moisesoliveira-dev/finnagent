ALTER TABLE "entry_amounts" ADD COLUMN "tenant_id" TEXT;

UPDATE "entry_amounts" AS "amount"
SET "tenant_id" = "entry"."tenant_id"
FROM "entries" AS "entry"
WHERE "amount"."entry_id" = "entry"."id";

ALTER TABLE "entry_amounts" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE UNIQUE INDEX "entries_tenant_id_id_key" ON "entries"("tenant_id", "id");

CREATE INDEX "entry_amounts_tenant_id_idx" ON "entry_amounts"("tenant_id");

ALTER TABLE "entry_amounts" DROP CONSTRAINT "entry_amounts_entry_id_fkey";

ALTER TABLE "entry_amounts" ADD CONSTRAINT "entry_amounts_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
