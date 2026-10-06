FROM node:22-bookworm-slim

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate \
  && pnpm install --frozen-lockfile

COPY . .

WORKDIR /repo/apps/backend

RUN pnpm exec prisma generate && pnpm exec nest build

EXPOSE 3000

CMD ["pnpm", "start:prod"]