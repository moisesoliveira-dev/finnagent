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

## Dependência `@next/env` no frontend

O que foi feito: `@next/env` entrou como dependência direta do frontend, na mesma versão do Next, para o `next build` achar o módulo.

Motivo: a imagem Docker falhava no typecheck com TS2307 em `next.config.ts`, que carrega o `.env` da raiz.

Arquivos:

- `apps/frontend/package.json`
- `pnpm-lock.yaml`

## Arranjo da tela de estrutura

O que foi feito: a aba Grupos passou a seguir o layout de `prumo-sessoes-grupos.html`, com os componentes e tokens já combinados. O título fica com os botões Novo grupo e Nova sessão. Cada grupo é um cartão com a descrição, a contagem e as sessões dentro. Sessão sem grupo aparece em Sem grupo. Criar e editar abrem diálogo, com nome e descrição de até 160 caracteres. O grupo da sessão é opcional. O Nest grava a descrição e aceita sessão sem grupo.

Motivo: a tela de estrutura precisava do arranjo da referência, sem sair do estilo do Prumo.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/components/ui/page-header.tsx`
- `apps/frontend/app/api/grupos/[id]/route.ts`
- `apps/frontend/app/api/sessoes/[id]/route.ts`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/`
- `packages/contracts/src/index.ts`

## Ambiente local de simulação

O que foi feito: entrou o agente teste e a regra permanente do ambiente local de simulação. A pessoa usa o sistema em http://localhost:3000, com docker compose up na raiz. O agente confere o .env de desenvolvimento, sobe frontend, backend, agents e redis, e confirma que a tela abre. Sem DIRECT_URL ou DATABASE_URL ele para e diz o nome da variável. Não é produção.

Motivo: a simulação precisa acontecer no ambiente local da pessoa.

Arquivos:

- `.cursor/agents/teste.md`
- `.cursor/rules/teste.mdc`
- `.cursor/rules/docker.mdc`

## Postgres local na simulação

O que foi feito: a simulação local passou a usar um Postgres normal no Compose, serviço `postgres` (imagem `postgres:16-alpine`, volume `postgres_data`). O Compose define `DATABASE_URL` e `DIRECT_URL` do backend e a `DATABASE_URL` do agents para esse serviço. No Railway o banco continua no Supabase. O `.env.example` explica que, no local, o Compose entrega essas URLs. As regras e os agentes docker e teste, e a nota em hospedagem, foram alinhados a isso. Com o Postgres ligado, o publicador do outbox subia e derrubava a API porque o BullMQ, em ESM, não carrega o ioredis sozinho. O backend agora depende de `ioredis` e o publicador abre o cliente e o entrega à fila. Falha ao publicar fica no log e não derruba o HTTP. Em http://localhost:3000, GET `/api/grupos` respondeu 200. Um grupo e uma sessão foram gravados no Postgres local e continuaram na tela depois de recarregar. O grupo de teste foi removido; a tela volta a “Nenhum grupo ainda.”

Motivo: o usuário pediu para testar localmente com Postgres normal, sem Supabase.

Arquivos:

- `compose.yaml`
- `.env.example`
- `apps/backend/package.json`
- `pnpm-lock.yaml`
- `apps/backend/src/grupos/adaptadores/outbox-publicador.ts`
- `.cursor/rules/docker.mdc`
- `.cursor/rules/teste.mdc`
- `.cursor/rules/hospedagem.mdc`
- `.cursor/agents/docker.md`
- `.cursor/agents/teste.md`

## Sessão exige grupo

O que foi feito: uma sessão passou a exigir grupo. Saiu o bloco Sem grupo da aba Grupos e a opção Sem grupo do diálogo. Sem grupo na tela, Nova sessão pede para criar um grupo antes. O contrato, o Prisma e o Nest recusam sessão sem `groupId`, com a mensagem Escolha um grupo. A migration `20261006160000_sessao_exige_grupo` apaga sessões soltas e torna `group_id` obrigatório. Os botões Adicionar sessão, Editar e Remover dos cartões viraram ícones com nome acessível; Mover continua escrito. No celular os ícones do grupo quebram para a linha de baixo, sem sobrepor o nome. Remover devolve 204 vazio, e o BFF deixa de transformar essa resposta em erro.

Motivo: a sessão organiza lançamentos dentro de um grupo, e as ações do cartão precisavam caber como ícones.

Arquivos:

- `apps/frontend/app/grupos/page.tsx`
- `apps/frontend/app/api/_lib/backend.ts`
- `apps/backend/src/grupos/`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20261006160000_sessao_exige_grupo/migration.sql`
- `packages/contracts/src/index.ts`
