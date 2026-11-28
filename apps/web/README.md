# AutoMate web app (`apps/web`)

AutoMate's frontend: React 19, Vite, TypeScript (strict), shadcn/ui and Tailwind CSS 4, with
TanStack Query for server state. Every module is built: Dashboard, Garage, Fuel, Expenses,
Maintenance, Documents, Trips, Analytics, Notifications, Settings, and Backup & Export.

Setup for the whole repository is in the root [README](../../README.md#quick-start) and
[CONTRIBUTING.md](../../CONTRIBUTING.md).

## Running it

From the repository root, with `apps/web/.env` in place (copy `apps/web/.env.example`):

```bash
pnpm codegen      # once on a fresh clone: the web app imports the built shared package
pnpm dev          # http://localhost:5173
```

The app needs the API running (`pnpm dev:api`). The session survives reloads through an httpOnly
refresh cookie, so use `localhost` for both the web app and the API.

## Scripts (here, or `pnpm --filter @automate/web <script>` from the root)

| Script                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `dev`                 | Vite dev server on :5173                                              |
| `build`               | Type check (`tsc -b`) and production build into `dist/`               |
| `preview`             | Serve the production build locally                                    |
| `typecheck` / `lint`  | TypeScript / ESLint (with import ordering; `--fix` sorts imports)     |
| `test` / `test:watch` | Vitest and Testing Library                                            |
| `test:e2e`            | Playwright browser tests (`e2e/`), desktop and phone                  |
| `screenshots`         | Re-capture the README screenshots from the demo data (`screenshots/`) |

Formatting is repository-wide: `pnpm format` / `pnpm format:check` from the root.

## Environment variables

`VITE_API_BASE_URL` (required) and `VITE_MAP_TILE_URL` (optional), validated at startup by
`src/lib/env.ts`; see [environment variables](../../docs/development/environment-variables.md#web-app-appswebenv).
Vite bakes `VITE_*` values into the bundle at build time, so they are public: never put a secret in
one, and set them in the build environment when deploying.

## Where things live

```
src/
├── app/            App.tsx, providers, router, module registry (modules.ts)
├── components/
│   ├── ui/         shadcn/ui primitives (add with `pnpm dlx shadcn@latest add <name>`)
│   ├── common/     app-level building blocks: PageHeader, FormField, StatCard, Pager…
│   ├── feedback/   empty, error and loading states, error boundaries
│   └── layout/     AppShell, sidebar, header, bottom navigation, search, user menu
├── features/<id>/  one folder per module; route files are lazily loaded entries
├── hooks/          shared hooks
├── lib/            env, API client, API errors, query client, form helpers
├── stores/         Zustand (client-only global state)
├── styles/         Tailwind entry and design tokens
├── test/           Vitest setup and API mocks
└── utils/          pure helpers (Indian formatting, CSV, images)
```

More detail:

- [docs/architecture/frontend.md](../../docs/architecture/frontend.md): architecture, conventions, adding a module.
- [docs/architecture/design-system.md](../../docs/architecture/design-system.md): tokens, typography, components.
