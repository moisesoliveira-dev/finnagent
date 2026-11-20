-- O compromisso que repete passa a ser marcado como feito por ocorrência. Antes, o status era da série inteira:
-- marcar uma semana como feita marcava todas.
CREATE TABLE "appointment_done_days" (
    "tenant_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "appointment_done_days_pkey" PRIMARY KEY ("appointment_id","date")
);

CREATE INDEX "appointment_done_days_tenant_id_date_idx" ON "appointment_done_days"("tenant_id", "date");

ALTER TABLE "appointment_done_days" ADD CONSTRAINT "appointment_done_days_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O "feito" da série inteira não diz quais ocorrências foram feitas: volta a pendente.
UPDATE "appointments" SET "status" = 'undone' WHERE "category" <> 'fixed';
