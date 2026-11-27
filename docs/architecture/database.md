# Database (PostgreSQL + Prisma 7)

Related: [backend.md](backend.md) · [MODULES.md §13](../MODULES.md) (cross-module rules)

## 1. Setup

| Piece          | Location                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema         | `apps/api/prisma/schema.prisma`: `User`, `Session` (auth), `Vehicle` (Garage), `FuelEntry` (Fuel), `ExpenseCategory` + `Expense` (Expenses), `MaintenanceSchedule`, `ServiceRecord` + `ServiceRecordItem`, `ServiceProvider`, `VehicleComponent` + `ComponentEvent` (Maintenance), `UserPreference` (per-user settings: the dashboard layout); more per module |
| CLI config     | `apps/api/prisma.config.ts`: schema path, migrations path, seed command, `DATABASE_URL`                                                                                                                                                                                                                                                                        |
| Migrations     | `apps/api/prisma/migrations/` (created with the first model)                                                                                                                                                                                                                                                                                                   |
| Client         | generated to `apps/api/src/generated/prisma` (gitignored); import `@/generated/prisma/client`                                                                                                                                                                                                                                                                  |
| Runtime access | `PrismaService` (`src/database/`), global, uses the `@prisma/adapter-pg` driver adapter                                                                                                                                                                                                                                                                        |
| Local DB       | `docker compose up -d` → PostgreSQL 17 on `127.0.0.1:5432`, persistent volume `postgres-data`                                                                                                                                                                                                                                                                  |
| Production     | Neon (pooled connection string, `sslmode=require`)                                                                                                                                                                                                                                                                                                             |

How Prisma 7 differs from older guides:

- The datasource URL lives in `prisma.config.ts`, not in `schema.prisma`.
- The CLI doesn't read `.env` itself; `prisma.config.ts` loads `apps/api/.env` when it exists.
- Queries run through a driver adapter (`PrismaPg`) instead of the Rust query engine.
- `prisma migrate dev` no longer runs `generate` or `seed`. The `prisma:migrate` script regenerates afterwards, and seeding is explicit (`prisma:seed`).

## 2. Using Prisma in code

- Inject `PrismaService` into services. Never `new PrismaClient()` (the seed script is the only exception), and never touch Prisma in controllers.
- Use Prisma directly. Don't wrap every call in a generic repository; extract a query helper or repository only when a module's queries get complex.
- **Multi-record writes use a transaction:** `this.prisma.$transaction(async (tx) => { ... })`. Pass `tx` to any helper that writes inside it. Examples: a fuel entry and its linked expense; a service record and its maintenance schedule update.
- Prisma errors `P2002` (unique violation → 409) and `P2025` (record not found → 404) map to API errors automatically. Other database errors become a generic 500.

## 3. Schema conventions

| Topic          | Rule                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming         | Models `PascalCase` singular, fields `camelCase`. Map to `snake_case` with `@@map("vehicles")` / `@map("user_id")`                                                                                       |
| IDs            | `id String @id @default(uuid(7)) @db.Uuid`. UUIDv7 is time-ordered, so indexes stay compact. Offline-capable records accept a client-generated UUID, validated in the shared Zod schema                  |
| Timestamps     | `createdAt DateTime @default(now()) @db.Timestamptz(3)` and `updatedAt DateTime @updatedAt @db.Timestamptz(3)` on every table (also needed for offline sync)                                             |
| Calendar dates | `@db.Date` for dates without a time (document expiry). A fill-up is an instant (`filledAt`, timestamptz)                                                                                                 |
| Money          | `Decimal @db.Decimal(12, 2)` in INR. In code, compute with `decimal.js` (Prisma's `Decimal` is decimal.js). Never `Float`                                                                                |
| Quantities     | Fuel litres/kg/kWh `Decimal @db.Decimal(10, 3)`, price per unit `Decimal @db.Decimal(10, 3)`, odometer `Int` (km)                                                                                        |
| Coordinates    | `latitude`/`longitude` `Decimal @db.Decimal(9, 6)`, nullable as a pair (CHECK constraints for the pair and the ranges); the API returns them as numbers                                                  |
| Ownership      | Every user-owned table has `userId` (FK, `onDelete: Cascade`) and `vehicleId` where applicable. Every query filters by `userId`                                                                          |
| Origin links   | A record that is also money has one linked expense, keyed by the unique pair `Expense (source, sourceId)` (e.g. `FUEL` + the fill-up's id) and written in the same transaction (`LinkedExpensesService`) |
| Enums          | Prisma `enum` for closed sets the database must enforce (fuel type). Mirror them in `packages/shared` for the web                                                                                        |
| Constraints    | Use the database for invariants: `@@unique`, FKs, `NOT NULL`. Add `CHECK` constraints (e.g. `amount >= 0`) in the migration SQL with `--create-only`                                                     |
| Indexes        | Add them for real query patterns, typically `@@index([userId, vehicleId, date])` for histories. Don't index speculatively                                                                                |
| JSON columns   | Avoid. Use only for opaque payloads that are never filtered (e.g. AI tool traces)                                                                                                                        |
| Soft delete    | Only where the product needs restore or audit (`deletedAt DateTime?`). Default is hard delete                                                                                                            |
| Files          | Never store bytes. Store the object key and metadata (see [backend.md §11](backend.md#11-file-storage-strategy))                                                                                         |

Illustrative only (not created yet):

```prisma
model Vehicle {
  id           String   @id @default(uuid(7)) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  name         String
  registration String?
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, registration])
  @@index([userId])
  @@map("vehicles")
}
```

## 4. Migration workflow

Development:

```bash
# 1. edit prisma/schema.prisma
pnpm --filter api prisma:migrate --name add_vehicles   # creates + applies the migration, regenerates the client
# 2. review prisma/migrations/<timestamp>_add_vehicles/migration.sql
# 3. commit schema.prisma and the migration folder together
```

- Every schema change gets a migration. Never edit a migration that has been applied anywhere outside your machine; fix it with a new migration.
- For hand-written SQL (`CHECK` constraints, partial indexes, data backfills), use `pnpm --filter api exec prisma migrate dev --create-only --name <change>`, edit the SQL, then run `prisma:migrate` again.
- Destructive changes (dropping or renaming columns) follow expand → migrate data → contract across separate deploys.
- To reset local data: `pnpm --filter api exec prisma migrate reset`. This drops and recreates the local database.

Production: `pnpm --filter api prisma:deploy && pnpm --filter api prisma:seed` runs as Render's pre-deploy command (migrations, then reference data). It only applies committed migrations and never generates new ones.

## 5. Seeding

`prisma/seed.ts` (run with `pnpm --filter api prisma:seed`) is for **reference data only**: today the system expense categories, upserted by `key` from `SYSTEM_EXPENSE_CATEGORIES` (`@automate/shared`). It runs on every deploy after migrations, and the expenses e2e tests call the same function. Write it as idempotent `upsert`s so it can run repeatedly. Never seed users, vehicles or sample business data; tests create their own data.
