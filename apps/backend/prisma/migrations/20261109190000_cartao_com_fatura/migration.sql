-- Cartão com fechamento, vencimento e limite; e o par de lançamentos de uma transferência.
ALTER TABLE "accounts" ADD COLUMN "closing_day" INTEGER;
ALTER TABLE "accounts" ADD COLUMN "due_day" INTEGER;
ALTER TABLE "accounts" ADD COLUMN "limit_cents" INTEGER;
ALTER TABLE "entries" ADD COLUMN "pair_id" TEXT;
CREATE INDEX "entries_pair_id_idx" ON "entries"("pair_id");
