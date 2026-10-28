CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "api_key" TEXT NOT NULL DEFAULT '',
    "base_url" TEXT NOT NULL DEFAULT '',
    "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_providers_kind_check" CHECK ("kind" IN ('openai', 'anthropic', 'google', 'openai_compativel', 'ollama'))
);

CREATE INDEX "ai_providers_tenant_id_idx" ON "ai_providers"("tenant_id");

CREATE TABLE "ai_settings" (
    "tenant_id" TEXT NOT NULL,
    "default_provider_id" TEXT,
    "default_model" TEXT NOT NULL DEFAULT '',
    "roles" JSONB NOT NULL DEFAULT '{}',
    "confirm_deletes" BOOLEAN NOT NULL DEFAULT true,
    "max_steps" INTEGER NOT NULL DEFAULT 8,
    "creativity" TEXT NOT NULL DEFAULT 'precisa',
    "instructions" TEXT NOT NULL DEFAULT '',
    "retention" TEXT NOT NULL DEFAULT '1a',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pending" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_tenant_id_user_id_updated_at_idx" ON "ai_conversations"("tenant_id", "user_id", "updated_at");

CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");
CREATE INDEX "ai_messages_tenant_id_idx" ON "ai_messages"("tenant_id");

ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já usava a leitura de extratos com a chave da OpenAI nas preferências ganha um provedor OpenAI
-- com a mesma chave e os mesmos modelos, e o modelo escolhido vira o padrão do assistente.
INSERT INTO "ai_providers" ("id", "tenant_id", "kind", "label", "api_key", "models")
SELECT gen_random_uuid()::text, "tenant_id", 'openai', 'OpenAI', "ai_api_key", "ai_models"
FROM "preferences"
WHERE "ai_api_key" <> '' OR cardinality("ai_models") > 0;

INSERT INTO "ai_settings" ("tenant_id", "default_provider_id", "default_model")
SELECT pr."tenant_id", pv."id", pr."ai_model"
FROM "preferences" pr
JOIN "ai_providers" pv ON pv."tenant_id" = pr."tenant_id"
WHERE pr."ai_model" <> '';
