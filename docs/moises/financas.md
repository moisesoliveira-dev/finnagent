# Finanças

## Tenant, porta de grupos e visual

O que foi feito: `entry_amounts` ganhou `tenant_id`. A foreign key passou a amarrar (`tenant_id`, `entry_id`) em `entries` (`tenant_id`, `id`). A migration é `20261006203000_valor_do_lancamento_por_tenant`. Leituras de valores filtram o tenant. O semeio de finanças deixou de gravar grupo e sessão direto no Prisma. O serviço de finanças usa a porta `GruposRepositorio`. O repositório de finanças só grava workflow e lançamento. `PrismaService`, o publicador do outbox e `gravarOutbox` saíram da slice de grupos e foram para `apps/backend/src/persistencia`. `GruposModule` exporta a porta de grupos. O controller de finanças usa `TIPOS_LANCAMENTO` de `@finnagent/contracts`, sem a lista duplicada. Money usa peso 500 na linha e na faixa, e 600 na linha de grupo e no rodapé. A tabela Base tem largura mínima de 880 px e rola no contêiner.

Motivo: alinhar tenant, a porta de grupos, o contrato e o visual do Prumo.

Arquivos:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006203000_valor_do_lancamento_por_tenant/migration.sql`
- `apps/backend/src/persistencia/`
- `apps/backend/src/financas/`
- `apps/backend/src/grupos/`
- `apps/backend/src/app.module.ts`
- `apps/frontend/components/ui/money.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`

## Lançamentos na aba Finanças

O que foi feito: a aba Finanças passou a ler e gravar lançamentos do tenant. O browser chama o Next em `/api/financas` e `/api/lancamentos`, e o Next chama o Nest. O Nest guarda um workflow por tenant e os lançamentos, com valor em centavos, filtrando pelo tenant. Os tipos são adicional, parcela, empréstimo, fixo e variável. Criar o workflow e o lançamento grava o outbox na mesma transação. Sem grupo, o serviço semeia o exemplo. A tela tem a visão Geral, com os meses a partir do workflow, grupos que abrem e fecham e os totais, e a visão Base, com o mês, filtros e busca. Novo lançamento abre um diálogo e exige sessão. O contrato compartilhado calcula as colunas do ano, o valor de cada mês e os totais. A migration inicial é `20261006180000_lancamentos`.

Motivo: a aba Finanças precisava mostrar e registrar os lançamentos ligados às sessões.

Arquivos:

- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/visao-geral.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/reais.ts`
- `apps/frontend/app/api/financas/`
- `apps/frontend/app/api/lancamentos/`
- `apps/backend/src/financas/`
- `apps/backend/src/app.module.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006180000_lancamentos/migration.sql`
- `packages/contracts/src/index.ts`
