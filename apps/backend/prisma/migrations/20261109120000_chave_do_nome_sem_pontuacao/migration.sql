-- A chave que lembra o nome e a sessão de uma linha do extrato passa a ignorar acento e pontuação (chaveDoNome em
-- apps/backend/src/extratos/dominio/nome-extrato.ts). O mesmo banco escrevia "nupay - uber" num mês e "nupay — uber"
-- no outro, e a lembrança não passava de um mês para o outro. As chaves gravadas já estão em minúsculas; aqui elas
-- perdem o acento e trocam o que não é letra ou número por espaço. Chaves que viram a mesma se juntam.

CREATE OR REPLACE FUNCTION pg_temp.chave_do_nome(texto text) RETURNS text AS $$
  SELECT btrim(left(btrim(regexp_replace(
    translate(lower(texto), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy'),
    '[^a-z0-9]+', ' ', 'g'
  )), 160));
$$ LANGUAGE sql IMMUTABLE;

-- Nomes lembrados: a mesma chave e o mesmo nome somam os usos e ficam com o uso mais recente.
CREATE TEMP TABLE nomes_novos AS
SELECT tenant_id, pg_temp.chave_do_nome(key) AS key, name, SUM(uses)::int AS uses, MAX(last_used_at) AS last_used_at
FROM statement_names
GROUP BY tenant_id, pg_temp.chave_do_nome(key), name;

DELETE FROM statement_names;

INSERT INTO statement_names (tenant_id, key, name, uses, last_used_at)
SELECT tenant_id, key, name, uses, last_used_at FROM nomes_novos WHERE key <> '';

-- Associações de descrição: uma por chave. Quando duas viram a mesma, fica a que aponta para um lançamento.
CREATE TEMP TABLE associacoes_novas AS
SELECT DISTINCT ON (tenant_id, pg_temp.chave_do_nome(name))
  tenant_id, pg_temp.chave_do_nome(name) AS name, session_id, entry_id
FROM statement_aliases
ORDER BY tenant_id, pg_temp.chave_do_nome(name), (entry_id IS NULL), name;

DELETE FROM statement_aliases;

INSERT INTO statement_aliases (tenant_id, name, session_id, entry_id)
SELECT tenant_id, name, session_id, entry_id FROM associacoes_novas WHERE name <> '';
