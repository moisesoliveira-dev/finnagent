ALTER TABLE "appointments" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'unico';
ALTER TABLE "appointments" ADD COLUMN "end_year" INTEGER;
ALTER TABLE "appointments" ADD COLUMN "end_month" INTEGER;
ALTER TABLE "appointments" ADD COLUMN "end_day" INTEGER;
