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

## Atributos da transação

O que foi feito: o lançamento passou a guardar nome, data, movimento, status, tipo, categoria, prioridade e os dados de parcela, empréstimo e valor fixo. A categoria continua alimentando o tipo que a visão do ano já calcula. Cancelada, estornada, mês cancelado e mês suspenso saem do total. A Base mostra a transação mesmo assim e abre as ações: atualizar status, associar compromisso, adiantar ou cancelar parcelas e empréstimo, cancelar ou suspender um mês fixo e atualizar o valor de uma ou mais transações fixas. Cada comando filtra o tenant e grava o outbox na mesma transação. A migration é `20261010140000_atributos_da_transacao`.

Entrada fica sem prioridade. Parcela e extra são sempre saída e também ficam sem prioridade (`nopriority`). Fixa, parcela e empréstimo são sempre compromisso. A migration `20261010153000_prioridade_e_compromisso` ajusta as transações que já existiam.

A descrição do lançamento é opcional. O movimento define o sinal do valor: entrada positivo, saída negativo. A transação fixa tem recorrência semanal, mensal, trimestral, semestral, anual ou personalizada, com um inteiro de intervalo. A migration é `20261010160000_recorrencia_da_fixa`.

Extra é só entrada e fica sem prioridade. Parcela continua saída e tem prioridade. O lápis abre a edição com os dados já gravados. A migration é `20261010170000_extra_entrada_parcela_prioridade`.

Motivo: a aba Finanças precisava tratar a transação com esses atributos, status e variações.

Arquivos:

- `packages/contracts/src/index.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261010140000_atributos_da_transacao/migration.sql`
- `apps/backend/prisma/migrations/20261010153000_prioridade_e_compromisso/migration.sql`
- `apps/backend/prisma/migrations/20261010160000_recorrencia_da_fixa/migration.sql`
- `apps/backend/prisma/migrations/20261010170000_extra_entrada_parcela_prioridade/migration.sql`
- `apps/backend/src/financas/`
- `apps/frontend/app/financas/`
- `apps/frontend/app/api/lancamentos/`

## Tokens da tela

O que foi feito: o seletor Base/Geral passou a usar `text-brand!` e `text-ink-2!`, porque o CSS base do botão cobria a cor do token. O ícone de editar foi de `size-5` para `size-4`. O checkbox de aplicar valor em outras fixas ganhou `size-4`, `accent-brand` e foco.

Motivo: alinhar a tela aos tokens do Prumo.

Arquivos:

- `apps/frontend/app/financas/page.tsx`
- `apps/frontend/app/financas/tabela.tsx`
- `apps/frontend/app/financas/acoes.tsx`

## Transação do repositório

O que foi feito: `atualizarValorFixo` conferia o lote no meio da gravação. Um retorno de falha no Prisma confirmava o que já tinha sido alterado e o outbox ficava de fora. Agora a conferência de todos os itens acontece antes de qualquer gravação. Se a linha sumir depois de gravar, a transação é desfeita. O mesmo descarte depois da gravação vale em atualizar, associar compromisso e alterar.

Motivo: mudança de estado e outbox na mesma transação.

Arquivos:

- `apps/backend/src/financas/adaptadores/prisma-financas-repositorio.ts`
