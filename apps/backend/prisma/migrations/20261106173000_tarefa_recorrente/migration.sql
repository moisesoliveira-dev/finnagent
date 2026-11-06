-- A tarefa da raiz pode repetir: todo dia, dias úteis, toda semana ou todo mês. Ao ser feita, nasce a próxima.
ALTER TABLE "tasks" ADD COLUMN "repeat" TEXT;
