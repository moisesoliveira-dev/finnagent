FROM node:22-bookworm-slim

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

EXPOSE 8000

CMD ["node", "dist/main.js"]
