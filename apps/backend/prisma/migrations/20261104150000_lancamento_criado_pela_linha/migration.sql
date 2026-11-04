-- A linha que criou o próprio lançamento (acúmulo) e a parte que pagou um lançamento já existente.
ALTER TABLE "statement_lines" ADD COLUMN "entry_created" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "statement_line_parts" ADD COLUMN "created" BOOLEAN NOT NULL DEFAULT true;

-- As linhas já lançadas por acúmulo: o lançamento delas nasceu do extrato.
UPDATE "statement_lines" AS sl
SET "entry_created" = true
FROM "entries" AS e
WHERE e."tenant_id" = sl."tenant_id"
  AND e."id" = sl."entry_id"
  AND e."justification" = 'Lançamento do extrato.';
