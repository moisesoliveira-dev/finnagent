ALTER TABLE "sessions" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'acumulo';

UPDATE "sessions" SET "kind" = 'valor' WHERE "cents" <> 0;

CREATE TABLE "session_additions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_additions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "session_additions_tenant_id_idx" ON "session_additions"("tenant_id");

ALTER TABLE "session_additions" ADD CONSTRAINT "session_additions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
