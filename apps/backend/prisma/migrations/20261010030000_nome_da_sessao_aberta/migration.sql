DROP INDEX "sessions_tenant_id_group_id_name_key";

CREATE UNIQUE INDEX "sessions_abertas_nome_key" ON "sessions" ("tenant_id", "group_id", "name") WHERE "ended_at" IS NULL;
