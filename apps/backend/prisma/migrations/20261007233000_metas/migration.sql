CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_cents" INTEGER NOT NULL,
    "saved_cents" INTEGER NOT NULL DEFAULT 0,
    "due_year" INTEGER,
    "due_month" INTEGER,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goals_tenant_id_idx" ON "goals"("tenant_id");
