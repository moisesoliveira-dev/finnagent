ALTER TABLE "sessions" ADD COLUMN "justification" TEXT NOT NULL DEFAULT '';

ALTER TABLE "sessions" ADD COLUMN "started_at" DATE;

ALTER TABLE "sessions" ADD COLUMN "ended_at" DATE;
