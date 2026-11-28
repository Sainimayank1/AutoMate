# Database

AutoMate stores everything in **PostgreSQL 17**, accessed through **Prisma 7** from the API only.
The schema lives in [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma), and
every change ships as a migration in `apps/api/prisma/migrations/`. Design rules (IDs, money,
ownership, offline-sync readiness) are in [`docs/architecture/database.md`](../architecture/database.md).

## Local database

`docker-compose.yml` runs PostgreSQL for development, bound to `127.0.0.1:5432` only, with its data
in the `postgres-data` volume. The default credentials (`postgres` / `postgres`, database
`automate`) are for local use; override them with `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` and `POSTGRES_PORT`.

```bash
pnpm db:up      # start (docker compose up -d postgres)
pnpm db:down    # stop; the data stays in the volume
```

## Everyday commands

| Command             | What it does                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm codegen`      | Builds `packages/shared` and generates the Prisma client (`apps/api/src/generated`, git-ignored).        |
| `pnpm db:deploy`    | Applies pending migrations (`prisma migrate deploy`). Non-interactive; the same command production runs. |
| `pnpm db:migrate`   | Development only: applies migrations and creates a new one from schema changes (`prisma migrate dev`).   |
| `pnpm db:seed`      | Reference data the app needs: the system expense categories. Idempotent; safe to re-run.                 |
| `pnpm db:seed:demo` | A demo account with synthetic data (below). Needs the API running.                                       |
| `pnpm db:studio`    | Prisma Studio, a browser UI for the local database.                                                      |

## Changing the schema

1. Edit `apps/api/prisma/schema.prisma`.
2. Create the migration: `pnpm --filter @automate/api prisma:migrate --name short_description`.
   It writes `prisma/migrations/<timestamp>_short_description/migration.sql`, applies it and
   regenerates the client.
3. Review the SQL, then commit the migration folder with the code that uses it.

Rules: one migration per change; never edit or delete a migration that is already on `main`; never
use `prisma db push` or `prisma migrate dev` against a shared or production database. Production
applies migrations with `prisma migrate deploy` when the API starts.

## Seeding

- **`pnpm db:seed`** adds reference data only (system expense categories) through idempotent
  upserts. It never creates users or business records, so it is safe in every environment.
- **`pnpm db:seed:demo`** creates a demo account so you can explore every module:

  ```bash
  pnpm dev:api        # the API must be running
  pnpm db:seed:demo   # prints the demo sign-in
  ```

  It signs up `demo@automate.example` (password `AutoMate-demo-2026`; local only, not a secret) and
  adds two vehicles, about a year of fill-ups, service history, schedules (one overdue, one planned
  job with an estimate), a tracked battery, expenses, a loan with EMIs, a recurring payment, a
  budget, documents (one about to expire), trips and reminders. Every record is synthetic and goes
  through the API's own validation. Re-running replaces the demo account.

  It refuses any API that isn't on your machine (`DEMO_ALLOW_REMOTE=true` overrides that; never use
  it against production).

## Resetting

To start over with an empty database:

```bash
docker compose down -v   # deletes the postgres-data volume: all local data is gone
pnpm db:up
pnpm db:deploy
pnpm db:seed
```

Uploaded files in `apps/api/.storage/` (local storage) are separate; delete that folder too for a
completely clean slate.

## Backups

- **In the app:** Backup & Export downloads a ZIP with every record and file for the account, and
  restores it into any account (rules in [`docs/architecture/backup.md`](../architecture/backup.md)).
- **The whole database** (local example):

  ```bash
  docker compose exec -T postgres pg_dump -U postgres -d automate --format=custom > automate.dump
  docker compose exec -T postgres pg_restore -U postgres -d automate --clean --if-exists < automate.dump
  ```

  Dumps contain personal data: keep them out of the repository (`*.dump` and `*.sql` outside
  `prisma/migrations` should never be committed) and store them encrypted.

Production backups, restores and upgrades are covered in the deployment docs.
