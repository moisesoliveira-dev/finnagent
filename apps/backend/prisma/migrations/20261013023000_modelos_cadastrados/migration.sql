ALTER TABLE "preferences" ADD COLUMN "ai_models" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "preferences" ALTER COLUMN "ai_model" SET DEFAULT '';
UPDATE "preferences" SET "ai_model" = '' WHERE cardinality("ai_models") = 0;
