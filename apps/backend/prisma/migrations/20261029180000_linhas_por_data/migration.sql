-- A conferência busca as linhas do mês pela data. O índice antigo só cobria o tenant.
CREATE INDEX "statement_lines_tenant_id_posted_on_idx" ON "statement_lines"("tenant_id", "posted_on");
