-- A pessoa pode ignorar uma linha do extrato sem apagá-la. Ela sai da conferência e da contagem de pendentes.
ALTER TABLE "statement_lines" ADD COLUMN "ignored_at" TIMESTAMP(3);
