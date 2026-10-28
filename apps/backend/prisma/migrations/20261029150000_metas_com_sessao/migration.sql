-- A meta passa a ter uma sessão no grupo "Metas", onde fica o valor separado.
ALTER TABLE "goals" ADD COLUMN "session_id" TEXT;
