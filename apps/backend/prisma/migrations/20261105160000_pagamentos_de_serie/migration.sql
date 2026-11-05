-- Parcela e empréstimo com pagamento livre: a ocorrência guarda o tipo (parcela ou multa), o número da parcela do
-- contrato e o pagamento que a resolveu. O empréstimo guarda de quem é e o total combinado.
ALTER TABLE "entries" ADD COLUMN "counterparty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "entries" ADD COLUMN "principal_cents" INTEGER;

ALTER TABLE "entry_occurrences" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'parcela';
ALTER TABLE "entry_occurrences" ADD COLUMN "parcel" INTEGER;
ALTER TABLE "entry_occurrences" ADD COLUMN "payment_id" TEXT;

-- As séries que já existem: cada ocorrência é a parcela de mesmo número.
UPDATE "entry_occurrences" o
SET "parcel" = o."number"
FROM "entries" e
WHERE e."tenant_id" = o."tenant_id" AND e."id" = o."entry_id" AND e."category" IN ('installment', 'loan');

-- O empréstimo antigo vira contrato: o total é a prestação vezes as parcelas.
UPDATE "entries"
SET "principal_cents" = ABS("cents") * GREATEST(COALESCE("installments", 1), 1)
WHERE "category" = 'loan' AND "principal_cents" IS NULL;
