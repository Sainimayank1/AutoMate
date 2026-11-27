# Security (API)

Baseline controls in Phase 0 and the rules every module follows. Related: [backend.md](backend.md), [api-conventions.md](api-conventions.md).

## 1. Controls in place

| Area              | Control                                                                                                                                                                                                                                                                                 | Where                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Headers           | helmet: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, no `X-Powered-By`                                                                                                                                                                                                       | `app.setup.ts`                       |
| CORS              | Allow-list from `FRONTEND_URL` (comma-separated), credentials allowed. `*` refused in production by env validation                                                                                                                                                                      | `app.setup.ts`, `env.validation.ts`  |
| Rate limiting     | 120 requests/min per IP (global `ThrottlerGuard`). `TRUST_PROXY` makes the client IP correct behind Render                                                                                                                                                                              | `http.constants.ts`, `app.module.ts` |
| Body size         | JSON only, 100 kB max → 413. No urlencoded or multipart parsers are registered                                                                                                                                                                                                          | `app.setup.ts`                       |
| Authentication    | Global `JwtAuthGuard`, secure by default; `@Public()` is an explicit opt-out. HS256 only, issuer and audience checked, 15-minute access tokens kept in memory by the web. Every request also checks the token's session in the database, so revoking a session takes effect immediately | `modules/auth`                       |
| Passwords         | argon2id (64 MiB, t=3, p=4) via `PasswordService`; 8–128 characters with a letter and a number; the hash never leaves `UsersService`                                                                                                                                                    | `modules/auth`, `modules/users`      |
| Sessions          | Opaque 256-bit refresh token in an httpOnly cookie (Secure in production, path `/api/v1/auth`), stored only as a SHA-256 hash, rotated on every refresh, deleted on logout                                                                                                              | `modules/auth`                       |
| CSRF              | Cookie routes refuse an `Origin` outside `FRONTEND_URL` (`TrustedOriginGuard`); `SameSite=Lax` by default                                                                                                                                                                               | `modules/auth`                       |
| Account discovery | Login: one message and equal timing for an unknown email and a wrong password. Registration reveals a taken email until email verification exists                                                                                                                                       | `modules/auth`                       |
| Input validation  | Zod at every input (`createZodDto` + global pipe)                                                                                                                                                                                                                                       | `app.module.ts`                      |
| Errors            | Single filter. 5xx bodies are generic; stack traces and driver errors are only logged; health exposes only up/down                                                                                                                                                                      | `all-exceptions.filter.ts`           |
| Logging           | Authorization, cookie and set-cookie headers and password/token/secret fields are redacted. Bodies are never logged                                                                                                                                                                     | `logger.config.ts`                   |
| Config            | All config is validated at startup. Secrets come only from the environment; error messages name variables, never values                                                                                                                                                                 | `env.validation.ts`                  |
| Local infra       | Postgres/Redis ports bound to `127.0.0.1` only. Compose credentials are local-only defaults                                                                                                                                                                                             | `docker-compose.yml`                 |
| Dependencies      | pnpm `minimumReleaseAge` (7 days) and an explicit `allowBuilds` list for install scripts                                                                                                                                                                                                | `pnpm-workspace.yaml`                |

## 2. Rules for every module

- **Ownership on every query.** Include `userId: user.id` (from `@CurrentUser()`) in every `where`, including updates and deletes (`updateMany`/`deleteMany` with `userId`, or find-then-check). Return 404 for another user's records, not 403.
- **Never trust ids from the body for ownership.** `userId` comes from the token only; `vehicleId` from the body must be checked against the user.
- **Validate everything** with a shared Zod schema. Bound string lengths and numeric ranges (odometer, amounts) so huge inputs are rejected.
- **No raw SQL with string interpolation.** Use Prisma queries or tagged `$queryRaw` templates (parameterised); never `$queryRawUnsafe` with user input.
- **No secrets in code, logs or responses.** Add new sensitive field names to the redaction list when introducing them.
- **Location is personal data.** The fuel form reads the device position only after the browser's own permission prompt, and the user can drop it before saving. Coordinates travel in request bodies (never URLs, which are logged) and are never logged; the reverse geocoder (`GEOCODER_URL`) receives them server-side. Use a keyed provider in production; the public OpenStreetMap server is for development (1 request/s, attribution shown in the form).
- **Sensitive routes** get a stricter `@Throttle()`: login and register 10/min per IP, refresh 30/min. Password reset gets the same when it ships.

## 3. File uploads (when Documents ships)

There's no upload endpoint in Phase 0. The planned design ([backend.md §11](backend.md#11-file-storage-strategy)):

- Private bucket only. Short-lived presigned PUT/GET URLs, issued only after an ownership check.
- Allow-listed MIME types, a maximum size enforced in the presigned policy and re-checked on confirm, the real type sniffed with `file-type`.
- Server-generated object keys (`users/<userId>/<uuid>`); client filenames are only metadata.
- File bytes never go through the JSON API and are never stored in PostgreSQL. Document contents are never logged.

## 4. Production checklist

- [ ] `NODE_ENV=production`, so Swagger and pretty logs are off and wildcard CORS is refused
- [ ] `JWT_ACCESS_SECRET`: unique, random, at least 32 characters, stored in Render's environment, never in the repo
- [ ] **Refresh cookie reachability:** serve the web and the API from the same site (e.g. `app.<domain>` + `api.<domain>`) and keep `REFRESH_COOKIE_SAMESITE=lax`. On different sites (`*.pages.dev` + `*.onrender.com`) the cookie is third-party: it needs `none`, and browsers that block third-party cookies (Safari, Firefox) will still drop it, signing users out on every reload
- [ ] `FRONTEND_URL` = the exact Cloudflare Pages origin(s)
- [ ] `TRUST_PROXY=1` on Render
- [ ] `DATABASE_URL` uses TLS (`sslmode=require`) and a least-privilege role
- [ ] `SWAGGER_ENABLED` unset (or behind auth)
- [ ] Health check path `/api/v1/health`
- [ ] Rate-limit storage moved to Redis before running more than one instance
