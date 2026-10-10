UPDATE "entries"
SET
  "mode" = 'inflows',
  "cents" = ABS("cents"),
  "priority" = 'nopriority'
WHERE "category" = 'additional';

UPDATE "entry_amounts" AS valor
SET "cents" = ABS(valor."cents")
FROM "entries" AS lancamento
WHERE valor."entry_id" = lancamento."id"
  AND valor."tenant_id" = lancamento."tenant_id"
  AND lancamento."category" = 'additional';

UPDATE "entries"
SET "priority" = 'normal'
WHERE "category" = 'installment'
  AND "priority" = 'nopriority';
