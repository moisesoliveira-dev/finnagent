-- Um lançamento pode apontar para outro que já conta o mesmo valor. Este deixa de entrar na sobra.
ALTER TABLE "entries" ADD COLUMN "covered_by_id" TEXT;

CREATE INDEX "entries_covered_by_id_idx" ON "entries"("covered_by_id");

ALTER TABLE "entries" ADD CONSTRAINT "entries_covered_by_id_fkey" FOREIGN KEY ("covered_by_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
