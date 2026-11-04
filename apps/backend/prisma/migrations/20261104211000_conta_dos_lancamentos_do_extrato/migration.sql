-- O lançamento que nasceu de uma linha do extrato, ou foi pago por ela, passa a apontar para a conta desse extrato.
UPDATE "entries" AS e
SET "account_id" = s."account_id"
FROM "statement_lines" AS sl
JOIN "statements" AS s ON s."tenant_id" = sl."tenant_id" AND s."id" = sl."statement_id"
WHERE sl."tenant_id" = e."tenant_id"
  AND sl."entry_id" = e."id"
  AND e."account_id" IS NULL;

UPDATE "entries" AS e
SET "account_id" = s."account_id"
FROM "statement_line_parts" AS p
JOIN "statements" AS s ON s."tenant_id" = p."tenant_id" AND s."id" = p."statement_id"
WHERE p."tenant_id" = e."tenant_id"
  AND p."entry_id" = e."id"
  AND e."account_id" IS NULL;
