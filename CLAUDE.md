# AutoMate — Car Ownership Assistant

Mobile-first app to manage vehicles, fuel, expenses, maintenance, documents, trips and total cost of ownership. Target market: India (INR, metric units, DD/MM/YYYY).

## Status
Stack locked. Current phase: **Phase 0 — Infrastructure** (monorepo, web + api bootstrap, shared packages, DB, Docker, config, linting, CI/deploy foundations). Do not build product modules until Phase 0 is done.

## Source of truth
- `docs/MODULES.md` — what to build: 12 modules, cross-module rules (§13), priority (§14). Read the relevant module before working on it.
- `docs/TECH_STACK.md` — how to build it: packages, folder structure (§12), DB rules (§3), hosting (§10).
- `docs/architecture/frontend.md` + `design-system.md` — web conventions: module registry, API/query/form patterns, tokens. Follow them in `apps/web`.

## Stack (summary)
pnpm + Turborepo monorepo · TypeScript strict
- `apps/web`: React + Vite, shadcn/ui + Tailwind, TanStack Query, Zustand, React Hook Form + Zod, Axios, Recharts, TanStack Table
- `apps/api`: NestJS (REST, Swagger), Prisma + PostgreSQL, JWT + Passport, argon2, pino
- `packages/shared`: Zod schemas, types, enums, constants used by both apps
- Local: Docker Compose. Hosting: Cloudflare Pages (web), Render (api), Neon (DB), R2 (files, later). Redis/BullMQ only when needed.

## Build order (do not build everything at once)
- **P0:** Garage (M2) → Fuel (M3) → Expenses (M4) → Dashboard (M1)
- **P1:** Maintenance (M5), Documents (M6), Notifications (M10)
- **P2:** Analytics (M8), Trips (M7)
- **P3:** AI Assistant (M9), Settings (M11), Backup & Export (M12)

## Code rules
- Use an existing package before writing a utility or component; don't add a package you don't need.
- Use shadcn/ui primitives; never hand-roll buttons, modals, dropdowns, tabs, etc.
- Validation schemas live once in `packages/shared` and are reused by web and api.
- Business logic (mileage, costs, maintenance due) lives in api/shared, never in UI components. Backend numbers are authoritative.
- Web calls the API only through the central API layer + feature hooks.
- API layering: Controller → Service → data access. No DB calls in controllers. Transactions for multi-record writes. A Prisma migration for every schema change.
- Config from validated env vars, never hardcoded.
- Money, fuel and other financial values use Decimal (DB) / decimal.js (code), never float.
- Tests required for calculations: mileage, expense aggregation, loan costs, maintenance intervals.

## Domain rules (every module)
- Every record belongs to a user, and to a vehicle where applicable. No cross-user access.
- Fuel/service/insurance/trip records that create expenses must link back to their origin — never duplicate money entries.
- Loan principal is not an ownership expense; only interest is.
- Odometer readings are a single, consistent history; flag readings that go backwards.
- Mileage only from reliable full-tank sequences; partial fills roll into the next full fill.
- Maintenance is due on time OR distance, whichever comes first.
- Keep data model offline-sync ready (client-generated IDs, updated-at timestamps).
