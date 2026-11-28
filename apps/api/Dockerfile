# syntax=docker/dockerfile:1
# AutoMate API image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t automate-api .
# Targets:
#   runtime (default)  the API, as a non-root user, with production dependencies only
#   migrate            one-off job: applies Prisma migrations and the reference data, then exits

FROM node:24-bookworm-slim AS base
# HUSKY=0: no Git hooks in the image. CI=true: pnpm never prompts.
ENV HUSKY=0 CI=true
# OpenSSL: the Prisma CLI's migration engine needs it to pick the right build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app
# Every workspace manifest, so the frozen lockfile matches.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# ---- build: all dependencies, compiled shared package, Prisma client and API
FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@automate/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @automate/api build

# ---- migrate: uses the Prisma CLI and tsx from the build stage (dev dependencies)
# Runs on the internal network (no internet): the CLI is called directly, never through pnpm.
FROM build AS migrate
ENV PATH=/app/apps/api/node_modules/.bin:$PATH \
    CHECKPOINT_DISABLE=1
RUN chown -R node:node /app/apps/api
USER node
WORKDIR /app/apps/api
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed"]

# ---- production dependencies only
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@automate/api..."

# ---- runtime
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_LOCAL_DIR=/data/storage
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Local file storage lives here; mount a persistent volume on it.
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
