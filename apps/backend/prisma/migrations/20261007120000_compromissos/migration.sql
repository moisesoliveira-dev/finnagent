CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "hour" INTEGER,
    "minute" INTEGER,
    "calendar" TEXT NOT NULL,
    "entry_id" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointments_tenant_id_year_month_idx" ON "appointments"("tenant_id", "year", "month");

CREATE INDEX "appointments_tenant_id_idx" ON "appointments"("tenant_id");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
