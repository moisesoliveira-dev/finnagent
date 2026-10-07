CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_tenant_id_id_key" ON "accounts"("tenant_id", "id");

CREATE UNIQUE INDEX "accounts_tenant_id_name_key" ON "accounts"("tenant_id", "name");

CREATE INDEX "accounts_tenant_id_idx" ON "accounts"("tenant_id");

CREATE TABLE "statements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "start_date" DATE,
    "end_date" DATE,
    "line_count" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL,
    "content" BYTEA NOT NULL,
    "content_hash" TEXT NOT NULL,
    "date_column" INTEGER,
    "description_column" INTEGER,
    "amount_column" INTEGER,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "statements_tenant_id_id_key" ON "statements"("tenant_id", "id");

CREATE INDEX "statements_tenant_id_account_id_start_date_end_date_idx" ON "statements"("tenant_id", "account_id", "start_date", "end_date");

CREATE INDEX "statements_tenant_id_idx" ON "statements"("tenant_id");

CREATE TABLE "statement_lines" (
    "statement_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "posted_on" DATE,
    "description" TEXT NOT NULL,
    "cents" INTEGER,
    "error" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "statement_lines_pkey" PRIMARY KEY ("statement_id","line")
);

CREATE INDEX "statement_lines_tenant_id_idx" ON "statement_lines"("tenant_id");

ALTER TABLE "statements" ADD CONSTRAINT "statements_tenant_id_account_id_fkey" FOREIGN KEY ("tenant_id", "account_id") REFERENCES "accounts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_tenant_id_statement_id_fkey" FOREIGN KEY ("tenant_id", "statement_id") REFERENCES "statements"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
