-- A pessoa escolhe a ordem de prioridade das metas; as que já existem seguem a ordem dos nomes.
ALTER TABLE "goals" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "goals" g SET "position" = o.n FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY name) AS n FROM "goals"
) o WHERE g.id = o.id;
