# Prumo

Controle de finanças pessoais: lançamentos, grupos e sessões, metas, agenda, relatórios e importação de extratos. A interface se chama Prumo. O repositório se chama `finnagent`.

## O que tem aqui

Monorepo em pnpm.

| Pasta | Papel |
| --- | --- |
| `apps/frontend` | Interface em Next.js. Dashboard, agenda, finanças, grupos, metas, relatórios, eventos, extratos e configurações. |
| `apps/backend` | API em NestJS. Persistência com Prisma e PostgreSQL. Filas com Redis e BullMQ. |
| `apps/agents` | Serviço que organiza extratos com LangChain e LangGraph. Não grava no banco. |
| `packages/contracts` | Tipos e contratos compartilhados (`@finnagent/contracts`). |

No Compose, o frontend fica em `http://localhost:3000` e os agents em `http://localhost:8000`. O backend só é alcançado pela rede interna, em `http://backend:3000`.

## Subir com Docker

É preciso o Docker e um arquivo `.env` na raiz. Copie o exemplo e preencha o que for usar:

```bash
cp .env.example .env
docker compose up --build
```

Postgres e Redis sobem junto. A senha local do banco está no `compose.yaml` (`finnagent` / `finnagent`). Fora do Compose, `DATABASE_URL` e `DIRECT_URL` vêm do `.env`.

`OPENAI_API_KEY` só entra na leitura de extrato. Telemetria (OpenTelemetry, Sentry, Langfuse) fica vazia se as variáveis não forem preenchidas.

## Desenvolvimento local

Node 22 e pnpm 11.21.0. Postgres e Redis precisam estar no ar, com `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `API_URL`, `AGENTS_URL` e `PORT` no `.env`.

```bash
pnpm install
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend start:dev
pnpm --filter frontend dev
pnpm --filter agents start
```

Cada processo lê a própria `PORT`. No Compose o frontend e o backend usam `3000` em containers diferentes; no host, use portas distintas.

## Testes

```bash
pnpm --filter backend test
pnpm --filter backend lint
pnpm --filter agents test
pnpm --filter frontend lint
```
