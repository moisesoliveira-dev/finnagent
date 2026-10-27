-- Os usuários que já existem eram, cada um, o único da própria conta: viram master.
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'master';

-- Daqui em diante, quem não declara o papel é membro (o menor privilégio).
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'membro';
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('master', 'membro'));

-- Uma conta passa a ter vários usuários, mas só um master.
DROP INDEX "users_tenant_id_key";
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE UNIQUE INDEX "users_tenant_id_master_key" ON "users"("tenant_id") WHERE "role" = 'master';
