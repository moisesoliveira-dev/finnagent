CREATE TABLE "statement_aliases" (
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,

    CONSTRAINT "statement_aliases_pkey" PRIMARY KEY ("tenant_id","name")
);

CREATE INDEX "statement_aliases_tenant_id_idx" ON "statement_aliases"("tenant_id");

ALTER TABLE "statement_aliases" ADD CONSTRAINT "statement_aliases_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
