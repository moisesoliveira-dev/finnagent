ALTER TABLE "appointments" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN "all_day" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'undone';
ALTER TABLE "appointments" ADD COLUMN "start_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "end_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "google_event_id" TEXT;

UPDATE "appointments"
SET
  "category" = CASE "category"
    WHEN 'unico' THEN 'fixed'
    WHEN 'recorrente' THEN 'periodical'
    WHEN 'validade' THEN 'time'
    ELSE "category"
  END,
  "all_day" = "hour" IS NULL,
  "start_at" = (make_timestamptz("year", "month", "day", COALESCE("hour", 0), COALESCE("minute", 0), 0, 'America/Sao_Paulo') AT TIME ZONE 'UTC'),
  "end_at" = CASE
    WHEN "hour" IS NULL THEN (make_timestamptz("year", "month", "day", 23, 59, 0, 'America/Sao_Paulo') AT TIME ZONE 'UTC')
    ELSE ((make_timestamptz("year", "month", "day", "hour", COALESCE("minute", 0), 0, 'America/Sao_Paulo') + interval '1 hour') AT TIME ZONE 'UTC')
  END;

ALTER TABLE "appointments" ALTER COLUMN "start_at" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "end_at" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "category" SET DEFAULT 'fixed';

CREATE UNIQUE INDEX "appointments_tenant_id_google_event_id_key" ON "appointments"("tenant_id", "google_event_id");

CREATE TABLE "calendars" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendars_tenant_id_name_key" ON "calendars"("tenant_id", "name");
CREATE INDEX "calendars_tenant_id_idx" ON "calendars"("tenant_id");
