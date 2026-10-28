-- A pessoa divide a sobra de cada mês entre as metas, em porcentagem, e aprova antes de separar.
CREATE TABLE "goal_allocations" (
    "goal_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "approved_cents" INTEGER,
    CONSTRAINT "goal_allocations_pkey" PRIMARY KEY ("goal_id","year","month"),
    CONSTRAINT "goal_allocations_percent_check" CHECK ("percent" BETWEEN 0 AND 100)
);
CREATE INDEX "goal_allocations_tenant_id_year_month_idx" ON "goal_allocations"("tenant_id", "year", "month");
