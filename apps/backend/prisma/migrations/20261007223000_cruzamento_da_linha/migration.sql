ALTER TABLE "statement_lines" ADD COLUMN "entry_id" TEXT;

ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_tenant_id_entry_id_fkey" FOREIGN KEY ("tenant_id", "entry_id") REFERENCES "entries"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
