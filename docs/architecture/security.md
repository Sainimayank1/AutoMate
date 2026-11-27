# Security (API)

Baseline controls in Phase 0 and the rules every module follows. Related: [backend.md](backend.md), [api-conventions.md](api-conventions.md).

## 1. Controls in place

| Area             | Control                                                                                                                                        | Where                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Headers          | helmet: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, no `X-Powered-By`                                                              | `app.setup.ts`                       |
| CORS             | Allow-list from `FRONTEND_URL` (comma-separated), credentials allowed. `*` refused in production by env validation                             | `app.setup.ts`, `env.validation.ts`  |
| Rate limiting    | 120 requests/min per IP (global `ThrottlerGuard`). `TRUST_PROXY` makes the client IP correct behind Render                                     | `http.constants.ts`, `app.module.ts` |
| Body size        | JSON only, 100 kB max → 413. No urlencoded or multipart parsers are registered                                                                 | `app.setup.ts`                       |
| Authentication   | Global `JwtAuthGuard`, secure by default; `@Public()` is an explicit opt-out. HS256 only, issuer and audience checked, 15-minute access tokens | `modules/auth`                       |
| Passwords        | argon2id (64 MiB, t=3, p=4) via `PasswordService`                                                                                              | `modules/auth`                       |
| Input validation | Zod at every input (`createZodDto` + global pipe)                                                                                              | `app.module.ts`                      |
| Errors           | Single filter. 5xx bodies are generic; stack traces and driver errors are only logged; health exposes only up/down                             | `all-exceptions.filter.ts`           |
| Logging          | Authorization, cookie and set-cookie headers and password/token/secret fields are redacted. Bodies are never logged                            | `logger.config.ts`                   |
| Config           | All config is validated at startup. Secrets come only from the environment; error messages name variables, never values                        | `env.validation.ts`                  |
| Local infra      | Postgres/Redis ports bound to `127.0.0.1` only. Compose credentials are local-only defaults                                                    | `docker-compose.yml`                 |
| Dependencies     | pnpm `minimumReleaseAge` (7 days) and an explicit `allowBuilds` list for install scripts                                                       | `pnpm-workspace.yaml`                |

## 2. Rules for every module

- **Ownership on every query.** Include `userId: user.id` (from `@CurrentUser()`) in every `where`, including updates and deletes (`updateMany`/`deleteMany` with `userId`, or find-then-check). Return 404 for another user's records, not 403.
- **Never trust ids from the body for ownership.** `userId` comes from the token only; `vehicleId` from the body must be checked against the user.
- **Validate everything** with a shared Zod schema. Bound string lengths and numeric ranges (odometer, amounts) so huge inputs are rejected.
- **No raw SQL with string interpolation.** Use Prisma queries or tagged `$queryRaw` templates (parameterised); never `$queryRawUnsafe` with user input.
- **No secrets in code, logs or responses.** Add new sensitive field names to the redaction list when introducing them.
- **Sensitive routes** (login, password reset, OTP) get a stricter `@Throttle()` with the auth phase.

## 3. File uploads (when Documents ships)

There's no upload endpoint in Phase 0. The planned design ([backend.md §11](backend.md#11-file-storage-strategy)):

- Private bucket only. Short-lived presigned PUT/GET URLs, issued only after an ownership check.
- Allow-listed MIME types, a maximum size enforced in the presigned policy and re-checked on confirm, the real type sniffed with `file-type`.
- Server-generated object keys (`users/<userId>/<uuid>`); client filenames are only metadata.
- File bytes never go through the JSON API and are never stored in PostgreSQL. Document contents are never logged.

## 4. Production checklist

- [ ] `NODE_ENV=production`, so Swagger and pretty logs are off and wildcard CORS is refused
- [ ] `JWT_ACCESS_SECRET` (later `JWT_REFRESH_SECRET`): unique, random, at least 32 characters, stored in Render's environment, never in the repo
- [ ] `FRONTEND_URL` = the exact Cloudflare Pages origin(s)
- [ ] `TRUST_PROXY=1` on Render
- [ ] `DATABASE_URL` uses TLS (`sslmode=require`) and a least-privilege role
- [ ] `SWAGGER_ENABLED` unset (or behind auth)
- [ ] Health check path `/api/v1/health`
- [ ] Rate-limit storage moved to Redis before running more than one instance
