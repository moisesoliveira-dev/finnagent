-- Acúmulo: o teto de saídas por mês da sessão. Sem valor, sem limite.
ALTER TABLE "sessions" ADD COLUMN "limit_cents" INTEGER;
