# Troubleshooting

Problems you may hit running AutoMate locally, and how to fix them. If yours isn't here, search the
[issues](https://github.com/Sainimayank1/AutoMate/issues) or open one (see [SUPPORT.md](../../SUPPORT.md)).

## Setup

**`pnpm: command not found`, or "Unsupported pnpm version"**: the repository pins pnpm in
`package.json` (`packageManager`). Run `corepack enable` once; Corepack then uses the pinned version.

**"Unsupported engine" or syntax errors on install**: AutoMate needs Node.js 24 or newer
(`.nvmrc`). With nvm: `nvm install && nvm use`.

**`Cannot find module '@automate/shared'` or `.../generated/prisma`**: the shared package and the
Prisma client are generated, not committed. Run `pnpm codegen`. `pnpm dev:api` does this
automatically; the web app (`pnpm dev`) doesn't, so run `codegen` first on a fresh clone.

## Database

**`connect ECONNREFUSED 127.0.0.1:5432` / `Can't reach database server`**: start the database with
`pnpm db:up` and check Docker is running (`docker compose ps`).

**Port 5432 is already in use** (another PostgreSQL on your machine): run the container on another
port and point the API at it:

```bash
POSTGRES_PORT=5433 pnpm db:up
# apps/api/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/automate
```

**`The table ... does not exist` or the app shows errors after pulling new code**: apply new
migrations with `pnpm db:deploy` (and `pnpm codegen` if the schema changed).

**A migration failed halfway (Prisma error `P3009`/`P3018`)**: locally, the quickest fix is a reset
(this deletes local data):

```bash
docker compose down -v && pnpm db:up && pnpm db:deploy && pnpm db:seed
```

On a database whose data matters, read the error, fix the cause, then mark the migration with
`pnpm --filter @automate/api exec prisma migrate resolve --rolled-back <migration_name>` and deploy
again. Back up first.

**Expense categories are missing**: run `pnpm db:seed`.

## API

**The API exits with "Invalid environment configuration"**: the message names the variable.
Usually `apps/api/.env` is missing (copy `apps/api/.env.example`) or `JWT_ACCESS_SECRET` is shorter
than 32 characters (`openssl rand -base64 48`). Every variable is in
[environment-variables.md](environment-variables.md).

**`EADDRINUSE: address already in use :::3000`**: another process has the port. Stop it, or set
`PORT` in `apps/api/.env` and update `VITE_API_BASE_URL` in `apps/web/.env` to match.

**`429 Too Many Requests` when signing in**: sign-in and sign-up allow 10 attempts a minute per
address. Wait a minute.

## Web app

**A blank page, with "Invalid environment configuration" in the browser console**: copy `apps/web/.env.example` to
`apps/web/.env`. Restart `pnpm dev` after changing it; Vite reads it at startup.

**Requests fail with a CORS error**: the web app's origin must be listed in the API's
`FRONTEND_URL` (default `http://localhost:5173`). Running Vite on another port, or opening
`127.0.0.1` instead of `localhost`, changes the origin: add it, comma-separated.

**You are signed out on every reload**: the session survives reloads through the refresh cookie,
which only works when the web app and API are on the same site. Use `localhost` for both (not
`localhost` for one and `127.0.0.1` for the other). For separate sites see
`REFRESH_COOKIE_SAMESITE` in [environment-variables.md](environment-variables.md).

## Files

**Uploads fail with "File storage isn't set up yet"**: production needs `STORAGE_PROVIDER=r2`/`s3`
with its keys, or `local` with `STORAGE_LOCAL_PERSISTENT=true`. Locally, storage defaults to
`local`; check `STORAGE_PUBLIC_URL` is an address your browser can reach (default
`http://localhost:3000`).

**Photos or documents are gone after a redeploy**: `local` files live in `STORAGE_LOCAL_DIR`, which
must be a persistent volume in production.

## Tests and tooling

**API e2e tests fail to connect**: they use the database in `apps/api/.env`. Run `pnpm db:up` and
`pnpm db:deploy` first.

**Playwright can't find a browser**: locally it uses your installed Google Chrome. Without Chrome,
install Playwright's: `pnpm --filter @automate/web exec playwright install chromium`. Then stop your
dev servers and run `CI=1 pnpm test:e2e:web`: with `CI` set, Playwright uses its own Chromium and
starts the servers itself.

**A commit is rejected by the pre-commit hook**: the hook runs Prettier and ESLint on your staged
files. Read the ESLint error, fix it, and commit again. Run `pnpm check` to see everything at once.
