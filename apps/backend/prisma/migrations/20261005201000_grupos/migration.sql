-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumed_events" (
    "idempotency_key" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumed_events_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE INDEX "groups_tenant_id_idx" ON "groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_tenant_id_name_key" ON "groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_idx" ON "sessions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tenant_id_group_id_name_key" ON "sessions"("tenant_id", "group_id", "name");

-- CreateIndex
CREATE INDEX "outbox_tenant_id_published_at_idx" ON "outbox"("tenant_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_tenant_id_idempotency_key_key" ON "outbox"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
