# Deployment

Free tiers first ([TECH_STACK.md §9](../TECH_STACK.md#9-infrastructure--keep-it-free-initially)): the web app on **Cloudflare Pages**, the API on **Render**, PostgreSQL on **Neon**, files on **Cloudflare R2**, checks on **GitHub Actions**. The repository holds the configuration (`render.yaml`, `apps/web/public/_redirects` and `_headers`, `.github/workflows/`); accounts, projects and secrets are created by the owner in each dashboard, never committed.

## 1. Order

1. **Neon** (database): create a project in the Singapore region (closest to India on the free tier). Copy the **pooled** connection string and make sure it ends with `?sslmode=require`.
2. **Cloudflare R2** (files): create a bucket (e.g. `automate-files`), then an R2 API token with Object Read & Write on that bucket only. Note the account's S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`), the access key and the secret. Add this CORS policy to the bucket so the browser can upload and read straight from storage (replace the origin once Pages has given you one):

   ```json
   [
     {
       "AllowedOrigins": ["https://automate.pages.dev"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **Render** (API): New → Blueprint → this repository. Render reads `render.yaml` and asks for the `sync: false` values: `DATABASE_URL` (Neon), `FRONTEND_URL` (the Pages origin, e.g. `https://automate.pages.dev`; comma-separate several), and the four `STORAGE_*` values from R2. `JWT_ACCESS_SECRET` is generated. The first deploy builds, runs `prisma migrate deploy`, and serves `GET /api/v1/health`. Note the service URL (`https://automate-api.onrender.com`).
4. **Cloudflare Pages** (web): connect the repository with
   - build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @automate/web build`
   - build output directory: `apps/web/dist`
   - environment variables: `NODE_VERSION=24`, `VITE_API_BASE_URL=https://automate-api.onrender.com/api/v1` (and optionally `VITE_MAP_TILE_URL`, see `apps/web/.env.example`).
     `_redirects` sends every path to `index.html` (client routing); `_headers` adds security headers and long caching for fingerprinted assets.
5. Put the final Pages origin in Render's `FRONTEND_URL` and in the R2 CORS policy if it changed (a custom domain, say), then redeploy the API.

## 2. How the pieces fit

- **Cookies across sites.** The web app and the API are on different sites, so the refresh cookie is `SameSite=None; Secure` (`REFRESH_COOKIE_SAMESITE=none` in `render.yaml`); the access token stays in memory. CORS allows only `FRONTEND_URL`, with credentials.
- **Migrations** run on every API start (`prisma migrate deploy` is idempotent) because the free plan has no pre-deploy step. A migration that fails stops the start, and Render keeps the previous deploy serving.
- **Cold starts.** Free Render services sleep after inactivity; the first request after that takes up to a minute. The web app's requests simply wait.
- **Files** never pass through the API: it signs short-lived R2 links (upload and download) and checks each upload's size and magic bytes on confirm. Production refuses local storage (env validation) unless `STORAGE_LOCAL_PERSISTENT=true` declares `STORAGE_LOCAL_DIR` a persistent, backed-up volume (a self-hosted server; Render's disk is not one). Without either, uploads answer 503 while the rest works.
- **Secrets** live in Render (API) and, for scheduled jobs, in GitHub Actions secrets. `.env` files are local only and git-ignored.

## 3. Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: install (frozen lockfile), Prisma client, format check, lint, type check, API unit tests, migrations into a throwaway Postgres 17 service, API e2e tests, web tests and the production builds. A second job, `browser`, builds both apps, starts the API and a web preview against their own Postgres, and runs the Playwright tests (`apps/web/e2e`, desktop and phone) in Chromium; the report is uploaded when it fails. Render and Pages deploy from `main` on their own; keep `main` green.

**Locally:** `pnpm test:e2e:web` runs the Playwright tests against the dev servers (it starts `pnpm dev` / `pnpm dev:api` when they aren't running) in your installed Google Chrome, so no browser download is needed. **Pre-commit:** husky runs lint-staged (`package.json`): Prettier on staged files, ESLint `--fix` on staged web and API TypeScript. `pnpm install` sets it up (`prepare`); the post-commit, post-checkout and post-merge hooks in `.husky/` hand over to graphify's hooks in `.git/hooks`.

## 4. Push notifications (optional)

1. Generate a key pair once: `npx web-push generate-vapid-keys`. In Render set `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY` and `PUSH_CONTACT` (a `mailto:` address push services may use), plus `DISPATCH_SECRET` (`openssl rand -base64 48`).
2. In the GitHub repository's Actions secrets add `AUTOMATE_API_URL` (`https://automate-api.onrender.com`) and `AUTOMATE_DISPATCH_SECRET` (the same secret). `.github/workflows/notify.yml` then calls `POST /api/v1/internal/notifications/dispatch` every hour; without the secrets it does nothing.
3. Users turn on "Push to this device" in Settings → Reminders & alerts. On iPhone, Web Push works for the app added to the home screen (Safari 16.4+), which the web manifest allows.

## 5. Before going live

- Verify the free-tier limits of each service (they change).
- Set up a custom domain on Pages, then update `FRONTEND_URL` and the R2 CORS origin.
- Swagger is off in production unless `SWAGGER_ENABLED=true`.
- Recommended next: Sentry for errors and uptime monitoring on `/api/v1/health`.
