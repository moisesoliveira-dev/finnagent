ALTER TABLE "entries" ADD COLUMN "recurrence" TEXT;
ALTER TABLE "entries" ADD COLUMN "recurrence_interval" INTEGER;

UPDATE "entries"
SET
  "recurrence" = 'monthly',
  "recurrence_interval" = 1
WHERE "category" = 'fixed';

ALTER TABLE "entries" ALTER COLUMN "description" SET DEFAULT '';
