-- A conta ganha tipo e saldo inicial; o lançamento ganha conta e a marca de transferência entre contas próprias.
ALTER TABLE "accounts" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'conta';
ALTER TABLE "accounts" ADD COLUMN "opening_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "entries" ADD COLUMN "account_id" TEXT;
ALTER TABLE "entries" ADD COLUMN "transfer" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "entries_account_id_idx" ON "entries"("account_id");

ALTER TABLE "entries" ADD CONSTRAINT "entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
