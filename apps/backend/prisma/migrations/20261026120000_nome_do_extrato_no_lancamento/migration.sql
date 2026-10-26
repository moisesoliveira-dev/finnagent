ALTER TABLE "statement_aliases" ADD COLUMN "entry_id" TEXT;

ALTER TABLE "statement_aliases" ADD CONSTRAINT "statement_aliases_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
