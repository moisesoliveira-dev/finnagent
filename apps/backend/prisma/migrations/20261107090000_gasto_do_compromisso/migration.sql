-- Depois do fim, o compromisso pergunta se teve gasto; a resposta fica guardada por compromisso e dia.
ALTER TABLE "appointments" ADD COLUMN "ask_spending" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "appointment_spendings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "answer" TEXT NOT NULL,
    "entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_spendings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_spendings_tenant_id_appointment_id_date_key" ON "appointment_spendings"("tenant_id", "appointment_id", "date");
CREATE INDEX "appointment_spendings_tenant_id_date_idx" ON "appointment_spendings"("tenant_id", "date");

ALTER TABLE "appointment_spendings" ADD CONSTRAINT "appointment_spendings_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
