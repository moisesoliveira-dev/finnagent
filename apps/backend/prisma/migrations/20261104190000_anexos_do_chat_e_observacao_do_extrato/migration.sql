-- O que a pessoa escreveu junto com o extrato.
ALTER TABLE "statements" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';

-- Arquivos anexados nas mensagens do chat do assistente. Somem junto com a conversa.
CREATE TABLE "ai_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_attachments_tenant_id_conversation_id_idx" ON "ai_attachments"("tenant_id", "conversation_id");

ALTER TABLE "ai_attachments" ADD CONSTRAINT "ai_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
