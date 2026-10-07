CREATE TABLE "workflows" (
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT NOT NULL DEFAULT '',
    "day" INTEGER NOT NULL,
    "cents" INTEGER NOT NULL,
    "start_year" INTEGER NOT NULL,
    "start_month" INTEGER NOT NULL,
    "installments" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entry_amounts" (
    "entry_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "cents" INTEGER NOT NULL,

    CONSTRAINT "entry_amounts_pkey" PRIMARY KEY ("entry_id","year","month")
);

CREATE INDEX "entries_tenant_id_idx" ON "entries"("tenant_id");

ALTER TABLE "entries" ADD CONSTRAINT "entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entry_amounts" ADD CONSTRAINT "entry_amounts_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
