# AutoMate — Car Ownership Assistant

Mobile-first app to manage vehicles, fuel, expenses, maintenance, documents, trips and total cost of ownership. Target market: India (INR, metric units, DD/MM/YYYY).

## Status

Phase 0 (infrastructure) is done, plus email/password auth. **P0 modules in progress:** Garage (M2) and Fuel (M3) are built; Expenses (M4) is built in approved phases (phases 1 · core, 2 · Fuel link and the Overview tab done; plan and money rules in `docs/architecture/expenses.md`), then Dashboard (M1). Build one module at a time, in this order.

## Token-saving tools (mandatory on every prompt)

- **graphify** (code graph in `graphify-out/`): look code up with `graphify query` / `explain` / `path` before any grep or file read. Rules are in the `## graphify` section below. A strict hook in `.claude/settings.json` blocks the first raw code read per session until the graph has been queried. The graph sees code calls and imports only, so still grep for strings, test names and env vars.
- **ponytail** (Claude Code plugin, enabled in `.claude/settings.json` at level `full`): smallest complete change, short replies. Keep it on for project work.
- **New machine:** `pipx install graphifyy`, then in the repo root run `graphify hook install` (rebuilds the graph after commits, checkouts and merges) and `graphify update .` (first build, ~5s, no API cost). Claude Code offers the ponytail plugin when you trust the folder; otherwise `/plugin marketplace add DietrichGebert/ponytail` then `/plugin install ponytail@ponytail`.

## Source of truth

- `docs/MODULES.md` — what to build: 12 modules, cross-module rules (§13), priority (§14). Read the relevant module before working on it.
- `docs/TECH_STACK.md` — how to build it: packages, folder structure (§12), DB rules (§3), hosting (§10).
- `docs/architecture/frontend.md` + `design-system.md` — web conventions: module registry, API/query/form patterns, tokens. Follow them in `apps/web`.
- **Look and feel: the Stitch project "AutoMate Design System Platform"**, applied through the `automate-design` skill. Build every screen from its Stitch design; if a flow needs a screen Stitch doesn't have, generate it in Stitch first, then build it.
- `docs/architecture/backend.md` + `database.md`, `api-conventions.md`, `security.md` — api conventions: module layout, Prisma/migrations, response envelope + error codes, auth/ownership rules. Follow them in `apps/api`.

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
- **Every list endpoint is paginated (mandatory).** Query `?page&pageSize` (default 20, max 100) via `paginationQuerySchema` extended per list; return `Paginated` (`Paginated.of` or `pageArgs` + `count`), which puts `{ page, pageSize, total, totalPages }` in the envelope's `meta`. Filters and search are query params applied before paging, never on the client. Web reads lists with `requestPage` (or `requestAllPages` for small sets the UI needs whole) and shows `<Pager>`. Rules: `docs/architecture/api-conventions.md` §2.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
