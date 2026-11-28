# Backend architecture (`apps/api`)

NestJS 11 on Express 5, TypeScript strict, PostgreSQL via Prisma 7. Product scope is in [MODULES.md](../MODULES.md) and stack choices are in [TECH_STACK.md](../TECH_STACK.md). Setup and commands are in [apps/api/README.md](../../apps/api/README.md).

Related: [database.md](database.md) · [api-conventions.md](api-conventions.md) · [security.md](security.md)

## 1. Principles

- **Feature modules.** Each product area (vehicles, fuel, expenses...) is one Nest module under `src/modules/<name>/`. Cross-cutting code lives in `src/common/`.
- **Layering:** Controller → Service → Prisma. Controllers handle HTTP only (routing, DTOs, decorators). Services hold business logic. Only services touch `PrismaService`.
- **The backend owns financial truth.** Mileage, cost and due-date calculations live in services (or `packages/shared` when the web also needs them), use `decimal.js`, and have unit tests.
- **One validation system:** Zod. Schemas live in `packages/shared` and are reused by web and API (`createZodDto` on the API side). No class-validator.
- **Secure by default:** every route requires a valid access token unless marked `@Public()`.
- **No speculative abstraction.** Use Prisma directly from services; add a repository class only when a module has complex queries worth isolating.

## 2. Folder structure

```
src/
├── main.ts                     bootstrap
├── app.module.ts               root module; global pipe, interceptor, filter, guards
├── app.setup.ts                configureApp(): HTTP setup shared by main.ts and e2e tests
├── config/
│   ├── env.validation.ts       Zod env schema, Env type, production rules
│   └── logger.config.ts        pino-http options (levels, redaction, pretty dev logs)
├── common/
│   ├── constants/              http.constants.ts (body limit, rate limit, header names)
│   ├── decorators/             Swagger response decorators
│   ├── filters/                AllExceptionsFilter: every error → error envelope
│   ├── interceptors/           ResponseEnvelopeInterceptor: every success → envelope
│   └── middleware/             requestIdMiddleware
├── database/                   PrismaService + global DatabaseModule
├── health/                     health module (Terminus)
├── modules/
│   ├── auth/                   register/login/refresh/logout, JWT strategy, global guard, @Public, @CurrentUser
│   ├── users/                  UsersService (owns `users`), GET /users/me
│   ├── vehicles/               Garage (M2): CRUD, archive/restore, profile completion (vehicles.mapper.ts)
│   ├── fuel/                   Fuel (M3): fill-ups under /vehicles/:id, mileage + summary (fuel.calculations.ts)
│   ├── expenses/               Expenses (M4): expenses, categories (seeded), refunds, shared splits (docs/architecture/expenses.md)
│   └── geocoding/              POST /geocode/reverse and /geocode/search (Nominatim-compatible, GEOCODER_URL); RoutingService (OSRM-compatible, ROUTER_URL)
├── storage/                    StorageProvider contract
└── generated/prisma/           Prisma client (generated, gitignored)
```

There are no empty folders for future modules. A module's folder appears when the module is built (priority order is in [MODULES.md §14](../MODULES.md)).

**Imports.** Use relative paths inside a top-level area (`./`, `../` within `modules/auth`). Use the `@/` alias (→ `src/`) when crossing areas, e.g. `@/config/env.validation`. `nest build` rewrites aliases in `dist/`, and Vitest resolves them via `vitest.config.mts`.

## 3. Request pipeline

```
request
 → requestIdMiddleware      x-request-id: reuse the caller's id if safe, else a new UUID; echoed in the response
 → helmet, cookie-parser, JSON body parser (100 kB), CORS
 → pino-http                one log line per request: method, url, status, duration (header values redacted)
 → ThrottlerGuard           120 req/min per IP (APP_GUARD #1)
 → JwtAuthGuard             Bearer token unless @Public() (APP_GUARD #2)
 → ZodValidationPipe        validates createZodDto params (APP_PIPE)
 → controller → service → PrismaService
 → ResponseEnvelopeInterceptor   { success: true, message, data, meta }
 ✗ AllExceptionsFilter           { success: false, message, error: { code, details, requestId } }
```

`configureApp()` (`app.setup.ts`) holds the HTTP-level setup and is shared by `main.ts` and the e2e tests, so tests run the real pipeline. Global pipes, interceptors, filters and guards are DI providers in `AppModule` (`APP_*` tokens), not `app.useGlobal*`, so they can inject services.

## 4. Adding a feature module

Use the Garage module as the example. Read its section in MODULES.md first.

1. **Contract in `packages/shared`.** Add Zod schemas and types (e.g. `src/vehicles/vehicle.schema.ts`), export them from `src/index.ts`, and run `pnpm --filter @automate/shared build`.
2. **Schema.** Add Prisma models following [database.md](database.md), then run `pnpm --filter api prisma:migrate --name add_vehicles`.
3. **Generate the module:** `cd apps/api && pnpm exec nest g module modules/vehicles --no-spec` (likewise `controller`, `service`). Use `--no-spec`, because the generated specs assume Jest globals; write Vitest specs that import from `vitest`.
4. **Lay it out:**
   ```
   modules/vehicles/
   ├── vehicles.module.ts
   ├── vehicles.controller.ts       routes, DTO params, Swagger decorators only
   ├── vehicles.service.ts          business rules; injects PrismaService
   ├── vehicles.service.spec.ts     unit tests (required for calculations)
   ├── dto/vehicle.dto.ts           class CreateVehicleDto extends createZodDto(createVehicleSchema) {}
   └── vehicles.constants.ts / vehicles.types.ts   only when needed
   ```
5. **Paginate every list** (api-conventions.md §2): a query DTO from `paginationQuerySchema`, a `Paginated` result, `{ paginated: true }` on its Swagger decorator.
6. **Scope every query by user.** Take the user from `@CurrentUser()` and include `userId: user.id` in every `where`. Never accept `userId` from the request body.
7. **Document it:** `@ApiTags("vehicles")`, `@ApiBearerAuth()`, and `@ApiEnvelopeResponse(VehicleDto)` / `@ApiErrorResponses(401, 404)` on each route (see [api-conventions.md §7](api-conventions.md#7-swagger)).
8. **Register it** in `AppModule.imports`.
9. **Test it:** unit tests for services (use `vi.fn()` mocks for `PrismaService` or a real test database), plus e2e cases in `test/` for the HTTP contract.

A module imports another module's exported service rather than querying another module's tables directly. For example, Fuel calls `ExpensesService` to create the linked expense, inside one `prisma.$transaction`.

**How the built modules connect:**

| From → to                               | Through                                                                                                                                                                                                 | Why                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Fuel → Vehicles                         | `VehiclesService.findOwned` (reads), `lockOwned(userId, id, tx)` (writes), `raiseOdometer(id, km, tx)`                                                                                                  | Ownership (404 for others), one odometer history, the vehicle's reading only goes up           |
| Fuel → Expenses                         | `LinkedExpensesService.sync / remove` inside the fuel write transaction, keyed by `(source FUEL, sourceId)` (unique); the backfill migration covered earlier fill-ups                                   | One money record per fill-up, read-only in Expenses                                            |
| Expenses → Vehicles                     | `findOwned`, `lockOwned` for every vehicle a write touches (id order), `raiseOdometer`                                                                                                                  | Ownership, archived vehicles read-only, one odometer history                                   |
| Dashboard → Fuel                        | M1: `GET /vehicles/:id/fuel-summary`                                                                                                                                                                    | Mileage and fuel spend come from the API, never recomputed                                     |
| Maintenance → Vehicles                  | `findOwned`, `lockOwned`, `raiseOdometer`, `correctOdometer`                                                                                                                                            | Ownership, archived vehicles read-only, one odometer history                                   |
| Maintenance → Expenses                  | `LinkedExpensesService.sync / remove` in the service record's transaction (`source MAINTENANCE`); `odometerAround`, `highestOdometer`, `expenseIdsFor`; `ExpensesService.spendByMonth` for the overview | One money record per service record; spending read from Expenses                               |
| Dashboard → Maintenance                 | `MaintenanceService.snapshot` (status-panel items and the maintenance card)                                                                                                                             | Due and overdue schedules on the dashboard                                                     |
| Dashboard → Trips                       | `TripsService.dashboardTrips`, `TripsService.recent`                                                                                                                                                    | The Driving card's trips summary and trips in recent activity                                  |
| Maintenance, Trips, Expenses → Vehicles | `OdometerHistoryService.around` / `highest`                                                                                                                                                             | One odometer history: every new reading is checked against expenses, service records and trips |
| Fuel form → Geocoding                   | Web: `POST /geocode/reverse` when the add form gets the device position; the address is saved with the coordinates                                                                                      | Read-only, automatic location for a future map of fill-ups                                     |

Writes that touch a vehicle's records take its row lock first (`lockOwned`), so concurrent saves can't break ordering rules such as the odometer sequence. Maintenance, Trips and service records should use the same lock and `raiseOdometer`.

## 5. Configuration

- `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` loads `apps/api/.env` (if present) and `process.env`, then validates them once at startup.
- Read config with the typed service: `constructor(private config: ConfigService<Env, true>)`, then `this.config.get("PORT", { infer: true })`.
- To add a variable, add it to the schema in `env.validation.ts`, to `.env.example`, and to the README table. A secret should be required only when its feature is enabled (see the `STORAGE_*` rule).
- Development and production differ only through `NODE_ENV`-dependent defaults and rules in the same schema (Swagger, log level, the wildcard CORS ban). There are no per-environment config files.

## 6. Authentication

Email + password. There is no Google or OTP sign-in.

**Verification** (every request):

- `JwtStrategy` verifies `Authorization: Bearer <token>`: HS256, issuer `automate-api`, audience `automate-web`, expiry.
- It then checks the database: the token's `sid` claim must name a session that still exists, belongs to `sub` and hasn't expired. That's one primary-key lookup per request. Deleting a session (logout, "sign out all devices", a password change) therefore revokes its access tokens immediately, not after the 15-minute expiry.
- It attaches `{ id, sessionId }` to `request.user`.
- `JwtAuthGuard` is registered globally; `@Public()` opts a route or controller out.
- `@CurrentUser()` injects the `AuthUser`.

**Flow** (`modules/auth`, `modules/users`):

| Route                 | Does                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/register` | Validates `registerSchema`, rejects a taken email (409, field `email`), hashes the password with argon2id (`PasswordService`), creates the user, then signs in                             |
| `POST /auth/login`    | Validates `loginSchema`. Unknown email and wrong password give the same 401 and take the same time (a dummy hash is verified). `rememberMe` picks a persistent or a browser-session cookie |
| `POST /auth/refresh`  | Exchanges the refresh cookie for a new access token and **rotates** the cookie. The old token stops working; a dead token is cleared                                                       |
| `POST /auth/logout`   | Deletes this device's session and clears the cookie. Idempotent                                                                                                                            |
| `GET /users/me`       | The signed-in user's profile (bearer token)                                                                                                                                                |

Register, login and refresh return `AuthSession` (`{ user, accessToken, expiresIn }`, from `@automate/shared`).

**Tokens and sessions:**

- **Access token:** a 15-minute JWT (`{ sub: userId, sid: sessionId }`), signed by the same `JwtModule` settings the strategy verifies. A refresh issues a new token for the same session. The previous one stays valid until it expires, so several open tabs sharing one session don't knock each other out.
- **Refresh token:** 256 random bits, sent only as the httpOnly cookie `automate_rt` (path `/api/v1/auth`). The database stores only its SHA-256 hash, in `Session` (one row per signed-in device).
- **Rotation:** a conditional update on the old hash, so two concurrent refreshes with one token can't both succeed.
- **Lifetime:** sliding, renewed on each refresh. 30 days with "Keep me signed in" (and registration); 1 day without it, with a browser-session cookie.
- **Housekeeping:** a user's expired sessions are deleted when they next sign in.

**Supporting pieces:**

- `RefreshCookieService` sets, reads and clears the cookie (Secure in production, `SameSite` from `REFRESH_COOKIE_SAMESITE`).
- `TrustedOriginGuard` refuses cookie routes called from origins outside `FRONTEND_URL` (CSRF).
- Rate limits: `@Throttle()` allows 10/min per IP for login and register, 30/min for refresh.
- `UsersService` owns the `users` table; `toUserProfile()` is the only way a user leaves the API, so the password hash never does.

Not built yet: password reset and email verification (both need an email provider).

Roles and permissions are not built. The product has no roles: every record belongs to exactly one user, and authorization means "is this the owner?", enforced by scoping queries (§4.5). Add a `@Roles()` decorator and guard only when a real role (e.g. admin) appears.

## 7. Logging and request IDs

- nestjs-pino / pino-http. Pretty single-line logs in development, JSON in production. Level comes from `LOG_LEVEL`.
- Every request gets an id (`x-request-id`, caller-supplied if it matches `[\w-]{1,128}`). It appears in every log line for that request and in error responses (`error.requestId`).
- Use Nest's `Logger` (`private readonly logger = new Logger(MyService.name)`). Its output goes through pino and carries the request id automatically.
- Redacted: `authorization`, `cookie`, `set-cookie` headers and `*.password`, `*.token`, `*.accessToken`, `*.refreshToken`, `*.secret` fields. Request and response bodies are never logged. Don't log document contents or personal data.
- 5xx errors are logged with stack traces by `AllExceptionsFilter`. 4xx responses are logged at `warn` as request lines. Successful health probes aren't logged.

## 8. Health checks

`GET /api/v1/health` (public, not rate-limited) pings PostgreSQL with a 3 s timeout, generous enough for a serverless database waking from idle. When `REDIS_ENABLED=true` it also pings Redis.

- 200: `data = { status: "ok", checks: { database: "up" }, app: { name, environment, apiVersion, uptimeSeconds } }`
- 503 `SERVICE_UNAVAILABLE`: `error.details[0]` holds the same report with the failing check `down`. Only up/down is exposed, never driver messages.

## 9. Shared package (`@automate/shared`)

- An ESM package built to `dist/` with `tsc`, consumed by both apps. The API is CommonJS and loads it through Node 24's `require(esm)`.
- It contains the API response contract (`ErrorCode`, `ApiSuccessResponse`, `ApiErrorResponse`, `FieldError`) today, and will hold Zod schemas, enums and constants.
- Rules: no Nest, React or Node-only imports; no circular imports with the apps. The API must never import from `apps/web`.

## 10. Background jobs (strategy)

Nothing runs in the background yet, and Redis is optional (`REDIS_ENABLED=false` by default).

- **First step**, when reminders arrive (Documents/Notifications, P1): `@nestjs/schedule` cron jobs inside the API process. Jobs must be idempotent (safe to run twice), because Render may run overlapping instances during deploys.
- **When jobs become slow or need retries**: add Redis (Upstash) + BullMQ (`@nestjs/bullmq`). Producers enqueue from services; processors live in `src/modules/<name>/jobs/`.
- **When workers need isolation**: add a second entry point (`src/worker.ts` creating an application context with only the job modules) and deploy it as a separate Render background worker from the same codebase.
- Add the Redis connection settings needed for Upstash (password/TLS or a `REDIS_URL`) and move `ThrottlerModule` storage to Redis in the same change.

## 11. File storage (strategy)

Files (RC, insurance PDFs, PUC, invoices, receipts, photos) are stored in private object storage (Cloudflare R2, S3-compatible), never in PostgreSQL. `src/storage/storage.provider.ts` defines the contract and the `STORAGE_PROVIDER` injection token; `StorageModule` binds the local provider (development and tests) or the R2/S3 one. As built for Documents: [documents.md §2](documents.md#2-files-and-storage).

Planned flow:

1. The client asks the API for an upload slot: `POST /documents/uploads { fileName, contentType, size }`.
2. The API checks ownership, allow-listed types (PDF, JPEG, PNG, WebP, HEIC) and the size limit, then returns a short-lived presigned PUT URL. The key is `users/<userId>/<uuid>`; the client's filename is stored only as metadata.
3. The client uploads directly to R2, so the API never buffers file bytes and the 100 kB JSON body limit stays in place.
4. The client confirms. The API checks the object exists and its size, sniffs the real type with `file-type`, and stores metadata (key, size, MIME type, checksum, owner) in PostgreSQL. Images are resized with `sharp` asynchronously.
5. Downloads go through the API: ownership check, then a presigned GET URL valid for a few minutes. Buckets are never public.

Built with Documents (M6); a presigned PUT can't cap the size, so step 4 re-checks it, and the real type is checked by its first bytes (`src/storage/file-signature.ts`) for the five allowed types. Image resizing isn't built.

## 12. Testing

- Vitest with SWC (`unplugin-swc`) so decorator metadata (dependency injection) works.
- Unit tests: `src/**/*.spec.ts`, run with `pnpm --filter api test`. Required for calculations (mileage, expense aggregation, loan costs, maintenance intervals).
- E2E: `test/**/*.e2e-spec.ts`, run with `pnpm --filter api test:e2e`. Boots `AppModule` through `configureApp()` against the local database. `test/setup-env.ts` sets the test JWT secret and silences logs.
