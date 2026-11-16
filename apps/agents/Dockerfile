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

WORKDIR /repo/apps/agents

RUN pnpm exec tsc -p tsconfig.json

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/agents/package.json apps/agents/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/chat/package.json packages/chat/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate \
  && pnpm install --filter agents... --prod --frozen-lockfile

COPY --from=build --chown=node:node /repo/apps/agents/dist ./apps/agents/dist
COPY --from=build --chown=node:node /repo/packages/contracts/src ./packages/contracts/src

WORKDIR /repo/apps/agents

USER node

EXPOSE 8000

CMD ["node", "dist/main.js"]
