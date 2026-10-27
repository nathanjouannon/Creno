# syntax=docker/dockerfile:1
# Three targets built from one file: `migrate` (applies database migrations once) and `app` (the web server).
# Base images are pinned (environments.md, section 5): never `latest`.
FROM node:20.19-slim AS base
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Dependencies: only the manifests and the Prisma schema (needed by the `prisma generate` postinstall) are copied,
# so this layer is reused until a dependency changes.
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/web/prisma apps/web/prisma
COPY packages/tokens/package.json packages/tokens/
COPY packages/validation/package.json packages/validation/
RUN corepack enable && corepack prepare --activate \
 && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

# Runs `pnpm db:migrate` against DATABASE_URL, then exits. Keeps the dev dependencies (Prisma CLI, tsx) the app image lacks.
FROM build AS migrate
USER node
CMD ["pnpm", "db:migrate"]

FROM node:20.19-slim AS app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/web/server.js"]
