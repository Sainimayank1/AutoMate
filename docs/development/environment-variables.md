# Environment variables

AutoMate reads configuration from environment variables, validated at startup:

- **API** (`apps/api`): `src/config/env.validation.ts`. A missing or invalid value stops the API
  with a message naming the variable, never its value. Blank values (`KEY=`) count as unset.
- **Web app** (`apps/web`): `src/lib/env.ts`, at build time. Everything here ends up in the
  JavaScript bundle that browsers download, so **never put a secret in a `VITE_` variable**.

Templates: [`apps/api/.env.example`](../../apps/api/.env.example) and
[`apps/web/.env.example`](../../apps/web/.env.example). Copy them to `.env` in the same folder.
`.env` files are git-ignored; never commit one.

Generate secrets with `openssl rand -base64 48`.

## API (`apps/api/.env`)

### Core

| Variable       | Required | Default                      | Description                                                                                                                                                |
| -------------- | -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | no       | `development`                | `development`, `test` or `production`. Production turns on the stricter checks below.                                                                      |
| `PORT`         | no       | `3000`                       | HTTP port.                                                                                                                                                 |
| `API_PREFIX`   | no       | `api`                        | Path prefix: `/api/...`.                                                                                                                                   |
| `API_VERSION`  | no       | `v1`                         | Default version: `/api/v1/...`.                                                                                                                            |
| `DATABASE_URL` | **yes**  |                              | PostgreSQL URL, e.g. `postgresql://postgres:postgres@localhost:5432/automate` (the local Docker database). Hosted databases often need `?sslmode=require`. |
| `LOG_LEVEL`    | no       | `debug` (dev), `info` (prod) | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. Logs never include secrets or tokens.                                                      |

### Security and the web app

| Variable                  | Required | Default                 | Description                                                                                                                                                                                                           |
| ------------------------- | -------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`       | **yes**  |                         | Signs access tokens. At least 32 characters; random, and different per environment.                                                                                                                                   |
| `FRONTEND_URL`            | no       | `http://localhost:5173` | Allowed browser origins (CORS), comma-separated. `*` is refused in production.                                                                                                                                        |
| `REFRESH_COOKIE_SAMESITE` | no       | `lax`                   | SameSite of the refresh-token cookie: `lax`, `strict` or `none`. Use `none` (always Secure) only when the web app and API are on different sites. See [`docs/architecture/security.md`](../architecture/security.md). |
| `TRUST_PROXY`             | no       | `0`                     | Reverse-proxy hops in front of the API, so rate limits see the real client address (`1` behind one proxy).                                                                                                            |
| `SWAGGER_ENABLED`         | no       | on, except production   | API documentation at `/api/docs`.                                                                                                                                                                                     |

### Files (documents, receipts, photos)

| Variable                   | Required                | Default                    | Description                                                                                                                                         |
| -------------------------- | ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`         | no                      | `local` outside production | `local` (files on disk, served by the API), `r2` (Cloudflare R2) or `s3` (any S3-compatible bucket).                                                |
| `STORAGE_LOCAL_DIR`        | no                      | `.storage`                 | Folder for `local` files.                                                                                                                           |
| `STORAGE_LOCAL_PERSISTENT` | production with `local` | `false`                    | `true` declares `STORAGE_LOCAL_DIR` a persistent, backed-up volume. Production refuses `local` without it, because files would be lost on redeploy. |
| `STORAGE_PUBLIC_URL`       | no                      | `http://localhost:$PORT`   | The API's own address as browsers reach it, for `local` upload and download links.                                                                  |
| `STORAGE_BUCKET`           | with `r2`/`s3`          |                            | Bucket name.                                                                                                                                        |
| `STORAGE_REGION`           | with `r2`/`s3`          |                            | Region (`auto` for R2).                                                                                                                             |
| `STORAGE_ACCESS_KEY`       | with `r2`/`s3`          |                            | Access key with read and write on that bucket only.                                                                                                 |
| `STORAGE_SECRET_KEY`       | with `r2`/`s3`          |                            | Its secret.                                                                                                                                         |
| `STORAGE_ENDPOINT`         | with `r2`/`s3`          |                            | The bucket's S3 endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com`.                                                                     |

Without any working storage, the app runs and uploads answer "storage isn't set up".

### Maps and places (optional)

| Variable           | Required | Default                                       | Description                                                                                                                                                                                              |
| ------------------ | -------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEOCODER_URL`     | no       | `https://nominatim.openstreetmap.org/reverse` | A Nominatim-compatible `/reverse` endpoint, for the fuel form's location and trip place search. The public server allows about 1 request a second: use a keyed provider (e.g. LocationIQ) in production. |
| `GEOCODER_API_KEY` | no       |                                               | Sent as `key` when set.                                                                                                                                                                                  |
| `ROUTER_URL`       | no       | `https://router.project-osrm.org`             | An OSRM-compatible routing server for trip routes. The public demo is for development only.                                                                                                              |

### Web Push and scheduled jobs (optional)

| Variable                 | Required          | Description                                                                                                                                                                               |
| ------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUSH_VAPID_PUBLIC_KEY`  | all three or none | Web Push key pair: `npx web-push generate-vapid-keys`. Without them, push is off and the in-app inbox still works.                                                                        |
| `PUSH_VAPID_PRIVATE_KEY` | all three or none |                                                                                                                                                                                           |
| `PUSH_CONTACT`           | all three or none | `mailto:` or `https://` contact for push services.                                                                                                                                        |
| `DISPATCH_SECRET`        | no                | 32+ characters. Protects `POST /api/v1/internal/notifications/dispatch`, called by `.github/workflows/notify.yml` (repository secrets `AUTOMATE_API_URL` and `AUTOMATE_DISPATCH_SECRET`). |

### Redis (optional)

| Variable        | Default     | Description                                                            |
| --------------- | ----------- | ---------------------------------------------------------------------- |
| `REDIS_ENABLED` | `false`     | When `true`, `/health` also checks Redis. Nothing else uses Redis yet. |
| `REDIS_HOST`    | `localhost` |                                                                        |
| `REDIS_PORT`    | `6379`      |                                                                        |

### Production checks

With `NODE_ENV=production` the API refuses to start when `FRONTEND_URL` contains `*`, or when
`STORAGE_PROVIDER=local` without `STORAGE_LOCAL_PERSISTENT=true`. It also turns Swagger off and
logs at `info` unless told otherwise.

## Web app (`apps/web/.env`)

| Variable            | Required | Description                                                                                                                                     |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | **yes**  | The API's base URL including the version, e.g. `http://localhost:3000/api/v1`.                                                                  |
| `VITE_MAP_TILE_URL` | no       | Map tiles (`{z}/{x}/{y}`) for trip routes. Unset uses OpenStreetMap's server, which is for light use only: point production at a tile provider. |

These are read when the app is built (`pnpm dev` or `pnpm build`); change them, then rebuild.

## Tests and scripts

| Variable            | Used by                 | Description                                                                                |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| `E2E_BASE_URL`      | Playwright (`apps/web`) | Web app to test; when set, Playwright doesn't start the dev servers.                       |
| `E2E_API_URL`       | Playwright helpers      | API the browser tests set data up through (default `http://localhost:3000/api/v1`).        |
| `DEMO_API_URL`      | `pnpm db:seed:demo`     | API to seed (default `http://localhost:3000/api/v1`).                                      |
| `DEMO_ALLOW_REMOTE` | `pnpm db:seed:demo`     | `true` allows seeding an API that isn't on this machine. Never do this against production. |

The API's own tests set their variables in `apps/api/test/setup-env.ts` and need only
`DATABASE_URL` pointing at a database you don't mind being written to.
