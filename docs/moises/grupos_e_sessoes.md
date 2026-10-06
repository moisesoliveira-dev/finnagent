# Grupos e sessões

## Aba Grupos

O que foi feito: aba Grupos em `/grupos`, no menu ao lado de Finanças. Dá para criar e remover grupos e sessões. Cada sessão pertence a um grupo. O valor da sessão e a soma do grupo aparecem com o componente Money, começando em zero, para a transação acumular ali depois. Os dados ficam no localStorage do navegador, chave `prumo-grupos`.

Motivo: a pessoa precisa de um lugar para criar os grupos e as sessões onde cada transação será acumulada.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/components/ui/app-shell.tsx`
- `apps/frontend/components/ui/list-row.tsx`

## Persistência no backend

O que foi feito: a aba Grupos deixou de gravar no navegador. O browser chama o Next em `/api/grupos` e `/api/sessoes`. O Next chama o Nest. O Nest grava grupos, sessões e o outbox no Postgres, filtrando por tenant. Sem `DIRECT_URL` (ou `DATABASE_URL`) o Nest responde 503 e a tela mostra essa mensagem.

Motivo: o pedido de funcionalidade inclui o backend no mesmo fluxo.

Arquivos:

- `apps/backend/src/grupos/`
- `apps/backend/src/app.module.ts`
- `apps/backend/package.json`
- `apps/frontend/app/api/grupos/`
- `apps/frontend/app/api/sessoes/`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/next.config.ts`
- `packages/contracts/src/index.ts`
- `pnpm-lock.yaml`

## Alinhamento às revisões

O que foi feito: a aba Grupos deixou o grid com valor arbitrário e passou a usar flex, com `min-w-0` nos blocos de texto. O backend passou a carregar o `.env` da raiz do monorepo, subindo pastas até achar `pnpm-workspace.yaml`. O acesso aos grupos ficou no Prisma 6 (schema e migration em `apps/backend/prisma`), atrás da porta `GruposRepositorio`; o comando não executa SQL. Remover um grupo grava um evento de outbox para cada sessão antes de apagá-la, e a foreign key é `RESTRICT`. O BullMQ publica o outbox na fila `outbox` quando `REDIS_URL` existe, e o consumidor grava o consumo de forma idempotente em `consumed_events`.

Motivo: alinhar a branch às revisões de interface, Docker e arquitetura.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/`
- `apps/backend/Dockerfile`
- `apps/backend/package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

## Assistente fora da aba Grupos

O que foi feito: o assistente saiu da aba Grupos. Nas outras abas ele continua.

Motivo: essa aba não registra gasto nem compromisso.

Arquivos:

- `apps/frontend/components/ui/app-shell.tsx`

## Formulário de criar sessão

O que foi feito: o formulário de criar sessão ficou visível na aba Grupos mesmo quando ainda não há grupo. Nome, grupo e o botão Criar sessão aparecem junto com a lista. Sem grupo, a tela pede para criar o grupo antes.

Motivo: a seção Sessões ficava só com o título, e é nessa aba que a sessão é criada.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`

## Sessão como custo

O que foi feito: a sessão passou a ser um custo com valor, positivo ou negativo. Na aba Grupos o formulário pede o valor em reais (menos para saída, como aluguel e conta de água; sem menos para entrada, como salário e hora extra) e mostra o valor com o componente Money. O Nest grava esse valor em centavos na sessão e no evento de outbox. Sem valor, a API responde 400.

Motivo: a sessão representa um custo do sistema, negativo ou positivo.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/backend/src/grupos/`
