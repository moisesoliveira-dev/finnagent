CREATE TABLE "entry_occurrences" (
    "tenant_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "due_on" DATE NOT NULL,
    "planned_cents" INTEGER NOT NULL,
    "paid_cents" INTEGER,
    "paid_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "entry_occurrences_pkey" PRIMARY KEY ("tenant_id","entry_id","number")
);

CREATE INDEX "entry_occurrences_tenant_id_idx" ON "entry_occurrences"("tenant_id");

ALTER TABLE "entry_occurrences" ADD CONSTRAINT "entry_occurrences_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
