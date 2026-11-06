-- Uma atividade pode ter subatividades (um nível). Apagar a atividade apaga as filhas.
ALTER TABLE "tasks" ADD COLUMN "parent_id" TEXT;
CREATE INDEX "tasks_tenant_id_parent_id_idx" ON "tasks"("tenant_id", "parent_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
