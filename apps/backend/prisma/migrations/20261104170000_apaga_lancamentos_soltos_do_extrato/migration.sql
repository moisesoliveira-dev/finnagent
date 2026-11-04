-- Antes, desfazer o acúmulo de uma linha só reabria o lançamento criado por ela. Ele ficava pendente na sessão,
-- sem linha nenhuma, e a sessão Fixo continuava como "já lançada". Apaga esses lançamentos, como se a linha nunca
-- tivesse sido lançada. O lançamento do extrato nasce pago, então pendente e sem linha só sobra de um desfazer.
CREATE TEMP TABLE lancamentos_soltos ON COMMIT DROP AS
SELECT e."tenant_id", e."id"
FROM "entries" AS e
WHERE e."justification" = 'Lançamento do extrato.'
  AND e."category" = 'unique'
  AND e."status" = 'pending'
  AND NOT EXISTS (SELECT 1 FROM "statement_lines" AS sl WHERE sl."tenant_id" = e."tenant_id" AND sl."entry_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "statement_line_parts" AS p WHERE p."tenant_id" = e."tenant_id" AND p."entry_id" = e."id")
  AND NOT EXISTS (
    SELECT 1 FROM "entry_occurrences" AS o
    WHERE o."tenant_id" = e."tenant_id" AND o."entry_id" = e."id" AND o."status" = 'completed'
  );

UPDATE "appointments" AS a
SET "entry_id" = NULL
FROM lancamentos_soltos AS s
WHERE a."tenant_id" = s."tenant_id" AND a."entry_id" = s."id";

INSERT INTO "outbox" ("id", "tenant_id", "operation", "idempotency_key", "payload")
SELECT gen_random_uuid()::text, s."tenant_id", 'excluir-lancamento', s."tenant_id" || ':excluir-lancamento:' || s."id",
  json_build_object('id', s."id")::text
FROM lancamentos_soltos AS s
ON CONFLICT DO NOTHING;

DELETE FROM "entries" AS e
USING lancamentos_soltos AS s
WHERE e."tenant_id" = s."tenant_id" AND e."id" = s."id";
