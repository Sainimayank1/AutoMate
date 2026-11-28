# AutoMate API (`apps/api`)

The NestJS 11 REST API behind AutoMate: every module's endpoints (vehicles, fuel, expenses,
maintenance, documents, trips, notifications, settings, backup and transfers), PostgreSQL through
Prisma 7, JWT authentication, file storage, Web Push and Swagger docs.

Setup for the whole repository is in the root [README](../../README.md#quick-start) and
[CONTRIBUTING.md](../../CONTRIBUTING.md). Architecture and conventions:

- [Backend architecture](../../docs/architecture/backend.md): structure, request pipeline, adding a module, file storage
- [Database](../../docs/architecture/database.md) and the [database guide](../../docs/development/database.md): schema rules, migrations, seeding, backups
- [API conventions](../../docs/architecture/api-conventions.md): URLs, envelope, errors, validation, pagination, Swagger
- [Security](../../docs/architecture/security.md)
- [Environment variables](../../docs/development/environment-variables.md): every variable this API reads

## Running it

From the repository root, with `apps/api/.env` in place and the database up (`pnpm db:up`):

```bash
pnpm dev:api          # watch mode on http://localhost:3000/api/v1
```

- Health: <http://localhost:3000/api/v1/health>
- Swagger UI: <http://localhost:3000/api/docs> (OpenAPI JSON at `/api/docs/json`)

`dev`, `build`, `lint`, `typecheck` and the tests first run `codegen`, which builds
`@automate/shared` and regenerates the Prisma client, so they work on a fresh clone. While editing
`packages/shared`, also run `pnpm --filter @automate/shared dev` so the API sees your changes.

Optional Redis (only the health check uses it today): `docker compose --profile redis up -d`, then
set `REDIS_ENABLED=true`.

## Scripts

Run them with `pnpm --filter @automate/api <script>` from the root, or `pnpm <script>` here.

| Script                           | What it does                                                            |
| -------------------------------- | ----------------------------------------------------------------------- |
| `dev`                            | Watch mode with pretty logs                                             |
| `build` / `start`                | Compile to `dist/` / run the compiled app                               |
| `lint` / `format` / `typecheck`  | ESLint (type-aware) / Prettier / `tsc --noEmit`                         |
| `test`                           | Unit tests (`src/**/*.spec.ts`, Vitest)                                 |
| `test:e2e`                       | End-to-end tests (`test/`) against the database in `.env`               |
| `prisma:migrate --name <change>` | Create and apply a migration in development, then regenerate the client |
| `prisma:deploy`                  | Apply pending migrations (CI and production)                            |
| `prisma:generate`                | Regenerate the Prisma client (`src/generated/prisma`, git-ignored)      |
| `prisma:seed`                    | Reference data only (system expense categories); safe anywhere          |
| `prisma:seed:demo`               | Synthetic demo account through the running API (local only)             |
| `prisma:studio`                  | Browse the database                                                     |

The root has shortcuts for the common ones: `pnpm db:deploy`, `pnpm db:seed`, `pnpm db:seed:demo`,
`pnpm test:e2e:api`.

## Folder structure

```
apps/api/
├── prisma/                 schema.prisma, migrations/, seed.ts, seed-demo.ts
├── prisma.config.ts        Prisma 7 CLI config (schema, migrations, seed, datasource URL)
├── src/
│   ├── main.ts             bootstrap: create the app, configureApp(), listen
│   ├── app.module.ts       root module, global pipe, interceptor, filter and guards
│   ├── app.setup.ts        HTTP setup shared with e2e tests (Helmet, CORS, prefix, Swagger)
│   ├── config/             environment validation, logger config
│   ├── common/             cross-cutting: constants, decorators, filters, interceptors, pagination
│   ├── database/           PrismaService (the only Prisma client)
│   ├── health/             GET /api/v1/health
│   ├── modules/            one folder per feature (auth, vehicles, fuel, expenses, maintenance, …)
│   ├── storage/            local and S3/R2 storage providers, thumbnails, the storage sweep
│   └── generated/prisma/   Prisma client output (git-ignored)
└── test/                   end-to-end tests and the Vitest environment setup
```

## Deploying

See [docs/architecture/deployment.md](../../docs/architecture/deployment.md). Production applies
migrations with `prisma:deploy` before starting.
