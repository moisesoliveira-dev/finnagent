CREATE TABLE "year_stays" (
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_stays_pkey" PRIMARY KEY ("tenant_id","year")
);
