-- Um compromisso pode ter checklist: as tarefas dele, no dia da ocorrência.
ALTER TABLE "tasks" ADD COLUMN "appointment_id" TEXT;
CREATE INDEX "tasks_tenant_id_appointment_id_date_idx" ON "tasks"("tenant_id", "appointment_id", "date");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
