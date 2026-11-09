-- A sobra de cada mês vira um lançamento no mês seguinte, marcado com o mês de onde veio.
ALTER TABLE "entries" ADD COLUMN "carry_of" TEXT;
CREATE UNIQUE INDEX "entries_tenant_id_carry_of_key" ON "entries"("tenant_id", "carry_of");

-- As sessões das caixinhas passam do grupo "Caixinhas" para o grupo "Conta", que também guarda as sobras.
INSERT INTO "groups" ("id", "tenant_id", "name", "description")
SELECT gen_random_uuid()::text, g."tenant_id", 'Conta', 'As sobras de cada mês e uma sessão por caixinha.'
FROM "groups" g
WHERE g."name" = 'Caixinhas'
  AND NOT EXISTS (SELECT 1 FROM "groups" c WHERE c."tenant_id" = g."tenant_id" AND c."name" = 'Conta');

UPDATE "sessions" s
SET "group_id" = c."id"
FROM "groups" g, "groups" c
WHERE s."group_id" = g."id"
  AND g."name" = 'Caixinhas'
  AND c."tenant_id" = g."tenant_id"
  AND c."name" = 'Conta';

DELETE FROM "groups" g
WHERE g."name" = 'Caixinhas'
  AND NOT EXISTS (SELECT 1 FROM "sessions" s WHERE s."group_id" = g."id");
