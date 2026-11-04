-- Uma linha do extrato pode virar vários lançamentos. A linha aponta para a primeira parte; esta tabela guarda todas.
CREATE TABLE "statement_line_parts" (
    "tenant_id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "entry_id" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "statement_line_parts_pkey" PRIMARY KEY ("statement_id","line","entry_id")
);

CREATE INDEX "statement_line_parts_tenant_id_idx" ON "statement_line_parts"("tenant_id");

ALTER TABLE "statement_line_parts" ADD CONSTRAINT "statement_line_parts_statement_id_line_fkey" FOREIGN KEY ("statement_id", "line") REFERENCES "statement_lines"("statement_id", "line") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "statement_line_parts" ADD CONSTRAINT "statement_line_parts_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Os nomes dados às linhas com a mesma descrição, para oferecer de novo.
CREATE TABLE "statement_names" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_names_pkey" PRIMARY KEY ("tenant_id","key","name")
);

CREATE INDEX "statement_names_tenant_id_key_idx" ON "statement_names"("tenant_id", "key");
