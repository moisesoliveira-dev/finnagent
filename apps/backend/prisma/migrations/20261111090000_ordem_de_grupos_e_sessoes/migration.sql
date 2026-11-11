-- A pessoa arrasta grupos e sessões para a ordem que quiser; os que já existem seguem a ordem dos nomes.
ALTER TABLE "groups" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "groups" g SET "position" = o.n FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY name) AS n FROM "groups"
) o WHERE g.id = o.id;

ALTER TABLE "sessions" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "sessions" s SET "position" = o.n FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, group_id ORDER BY name) AS n FROM "sessions"
) o WHERE s.id = o.id;
