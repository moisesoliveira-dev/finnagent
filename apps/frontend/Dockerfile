FROM node:22-bookworm-slim AS build

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/agents/package.json apps/agents/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/chat/package.json packages/chat/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate \
  && pnpm install --frozen-lockfile

COPY . .

WORKDIR /repo/apps/frontend

# O DSN do navegador entra no bundle no build: o Railway passa a variável do serviço como argumento.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

RUN pnpm exec next build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /repo

COPY --from=build --chown=node:node /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=node:node /repo/apps/frontend/public ./apps/frontend/public

WORKDIR /repo/apps/frontend

USER node

EXPOSE 3000

CMD ["node", "server.js"]
