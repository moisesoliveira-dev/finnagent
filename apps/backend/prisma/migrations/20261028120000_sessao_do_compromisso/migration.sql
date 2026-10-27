ALTER TABLE "appointments" ADD COLUMN "session_id" TEXT;

CREATE INDEX "appointments_session_id_idx" ON "appointments"("session_id");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
