# syntax=docker/dockerfile:1
# AutoMate web app served by Caddy, which also proxies /api to the API and handles HTTPS.
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t automate-web .

FROM node:24-bookworm-slim AS build
ENV HUSKY=0 CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@automate/web..."
COPY packages/shared packages/shared
COPY apps/web apps/web
# Public build-time settings (they end up in the browser bundle; never secrets).
# The API is reached on the same site through Caddy, so a path is enough.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_MAP_TILE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_MAP_TILE_URL=${VITE_MAP_TILE_URL}
RUN pnpm --filter @automate/shared build && pnpm --filter @automate/web build

FROM caddy:2.11-alpine AS runtime
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
