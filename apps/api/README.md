# AutoMate API (`apps/api`)

NestJS 11 REST API for AutoMate. Phase 0 provides infrastructure only: config, logging, error and response conventions, database access, auth plumbing, health checks and Swagger. No product endpoints exist yet.

Architecture and conventions:

- [Backend architecture](../../docs/architecture/backend.md): structure, request pipeline, how to add a module, jobs, file storage
- [Database](../../docs/architecture/database.md): Prisma, schema conventions, migrations
- [API conventions](../../docs/architecture/api-conventions.md): URLs, envelope, errors, validation, Swagger
- [Security](../../docs/architecture/security.md)

## Prerequisites

- Node 24 (`.nvmrc`), pnpm 12 (`corepack enable` picks the version from `package.json`)
- Docker (Docker Desktop or Engine) for local PostgreSQL

## Quick start

From the repository root:

```bash
pnpm install
docker compose up -d                          # PostgreSQL 17 on 127.0.0.1:5432
cp apps/api/.env.example apps/api/.env
# set JWT_ACCESS_SECRET in apps/api/.env, e.g. to the output of: openssl rand -base64 48
pnpm --filter api dev                         # http://localhost:3000/api/v1
```

- Health: <http://localhost:3000/api/v1/health>
- Swagger UI: <http://localhost:3000/api/docs> (OpenAPI JSON at `/api/docs/json`)

`dev`, `build`, `lint`, `typecheck` and `test` first run `codegen`, which builds `@automate/shared` and regenerates the Prisma client, so they work on a fresh clone. While editing `packages/shared`, also run `pnpm --filter @automate/shared dev` so the API sees your changes.

Optional Redis: `docker compose --profile redis up -d`, then set `REDIS_ENABLED=true`. If another Redis already uses port 6379, either point `REDIS_HOST`/`REDIS_PORT` at it, or start the container on a free port with `REDIS_PORT=6380 docker compose --profile redis up -d` and set `REDIS_PORT=6380` in `.env`.

Stop the database with `docker compose stop`. `docker compose down -v` also **deletes** the local data volume.

## Scripts

Run them with `pnpm --filter api <script>` from the root, or `pnpm <script>` inside `apps/api`.

| Script                           | What it does                                                            |
| -------------------------------- | ----------------------------------------------------------------------- |
| `dev`                            | Start in watch mode (pretty logs)                                       |
| `build` / `start`                | Compile to `dist/` / run the compiled app                               |
| `lint` / `format` / `typecheck`  | ESLint (type-aware) / Prettier / `tsc --noEmit`                         |
| `test`                           | Unit tests (`src/**/*.spec.ts`, Vitest)                                 |
| `test:e2e`                       | End-to-end tests (`test/`). Needs the database running                  |
| `prisma:migrate --name <change>` | Create and apply a migration in development, then regenerate the client |
| `prisma:deploy`                  | Apply pending migrations (CI/production)                                |
| `prisma:generate`                | Regenerate the Prisma client (`src/generated/prisma`, gitignored)       |
| `prisma:seed`                    | Run `prisma/seed.ts` (reference data only)                              |
| `prisma:studio`                  | Browse the database                                                     |

From the root, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` run across all workspace packages.

## Environment variables

Validated once at startup by `src/config/env.validation.ts`. Invalid or missing values stop the app with a message naming the variable, never its value. Blank values (`KEY=`) count as unset.

| Variable                                                                       | Required      | Default                                       | Notes                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                     | no            | `development`                                 | `development`, `test` or `production`                                                                                                                          |
| `PORT`                                                                         | no            | `3000`                                        |                                                                                                                                                                |
| `API_PREFIX`                                                                   | no            | `api`                                         | URL prefix: `/api/...`                                                                                                                                         |
| `API_VERSION`                                                                  | no            | `v1`                                          | Default URI version: `/api/v1/...`                                                                                                                             |
| `DATABASE_URL`                                                                 | **yes**       |                                               | `postgresql://...`. On Neon, use the pooled URL with `sslmode=require`                                                                                         |
| `FRONTEND_URL`                                                                 | no            | `http://localhost:5173`                       | Comma-separated CORS origins. `*` is rejected in production                                                                                                    |
| `TRUST_PROXY`                                                                  | no            | `0`                                           | Proxy hops in front of the API (Render: `1`)                                                                                                                   |
| `SWAGGER_ENABLED`                                                              | no            | on unless production                          |                                                                                                                                                                |
| `JWT_ACCESS_SECRET`                                                            | **yes**       |                                               | At least 32 characters                                                                                                                                         |
| `REFRESH_COOKIE_SAMESITE`                                                      |               | `lax`                                         | `lax`, `strict` or `none`. `none` (forces Secure) only when web and API are on different sites; see docs/architecture/security.md                              |
| `LOG_LEVEL`                                                                    | no            | `debug` (dev), `info` (prod)                  | pino level, or `silent`                                                                                                                                        |
| `REDIS_ENABLED`                                                                | no            | `false`                                       | When `true`, `/health` also checks Redis                                                                                                                       |
| `REDIS_HOST` / `REDIS_PORT`                                                    | no            | `localhost` / `6379`                          |                                                                                                                                                                |
| `GEOCODER_URL`                                                                 | no            | `https://nominatim.openstreetmap.org/reverse` | Nominatim-compatible reverse geocoder for the fuel form's location. The public server allows 1 request/s: use a keyed provider (e.g. LocationIQ) in production |
| `GEOCODER_API_KEY`                                                             | no            |                                               | Sent as `key` when set                                                                                                                                         |
| `STORAGE_PROVIDER`                                                             | no            |                                               | `r2` or `s3`. Setting it makes the four `STORAGE_*` below required                                                                                             |
| `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | with provider |                                               |                                                                                                                                                                |

## Folder structure

```
apps/api/
├── prisma/                 schema.prisma, migrations/ (created with the first model), seed.ts
├── prisma.config.ts        Prisma 7 CLI config (schema path, migrations, seed, datasource URL)
├── src/
│   ├── main.ts             bootstrap: create app, configureApp(), listen
│   ├── app.module.ts       root module + global pipe, interceptor, filter, guards
│   ├── app.setup.ts        HTTP setup shared with e2e tests (helmet, CORS, prefix, Swagger...)
│   ├── config/             env validation, logger config
│   ├── common/             cross-cutting: constants, decorators, filters, interceptors, middleware
│   ├── database/           PrismaService (the only Prisma client) + global DatabaseModule
│   ├── health/             GET /api/v1/health (Terminus)
│   ├── modules/            feature modules; currently auth (infrastructure only)
│   ├── storage/            StorageProvider contract (no implementation yet)
│   └── generated/prisma/   Prisma client output (gitignored)
└── test/                   e2e tests + Vitest env setup
```

## Deploying (Render + Neon)

Not exercised yet; verify these steps on the first deploy.

- Build: `pnpm install --frozen-lockfile --prod=false && pnpm --filter api build`
- Pre-deploy: `pnpm --filter api prisma:deploy`
- Start: `pnpm --filter api start`
- Health check path: `/api/v1/health`
- Env: `NODE_ENV=production`, `TRUST_PROXY=1`, `DATABASE_URL` (Neon), `FRONTEND_URL` (the Cloudflare Pages origin), `JWT_ACCESS_SECRET`
