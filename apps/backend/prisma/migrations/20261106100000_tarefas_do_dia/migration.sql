-- A aba Hoje: as tarefas que a pessoa escreve, por dia. O que não foi feito segue para o dia seguinte.
CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "done_on" DATE,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tasks_tenant_id_id_key" ON "tasks"("tenant_id", "id");
CREATE INDEX "tasks_tenant_id_date_idx" ON "tasks"("tenant_id", "date");
