UPDATE "entries"
SET
  "mode" = 'outflows',
  "cents" = -ABS("cents")
WHERE "category" IN ('installment', 'additional');

UPDATE "entry_amounts" AS valor
SET "cents" = -ABS(valor."cents")
FROM "entries" AS lancamento
WHERE valor."entry_id" = lancamento."id"
  AND valor."tenant_id" = lancamento."tenant_id"
  AND lancamento."category" IN ('installment', 'additional');

UPDATE "entries"
SET "priority" = 'nopriority'
WHERE "mode" = 'inflows'
   OR "category" IN ('installment', 'additional');

UPDATE "entries"
SET "transaction_type" = 'appointment'
WHERE "category" IN ('fixed', 'installment', 'loan');

ALTER TABLE "entries" ALTER COLUMN "priority" SET DEFAULT 'nopriority';
