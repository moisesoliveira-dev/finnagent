-- A conversa fixada fica no alto da lista e não é apagada pela retenção.
ALTER TABLE "ai_conversations" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
