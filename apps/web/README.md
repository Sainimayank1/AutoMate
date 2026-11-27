# @automate/web

AutoMate's frontend: React 19 + Vite 8 + TypeScript (strict), shadcn/ui + Tailwind CSS v4.

Status: infrastructure, the Stitch "Cockpit" theme and email/password sign-in and registration are built. All 12 module pages are placeholders. Screens are built from the Stitch project (see the `automate-design` skill).

## Run it

Requirements: Node ≥ 24, pnpm 12.

```bash
# from the repo root
pnpm install
pnpm --filter @automate/shared build   # web imports the API types from the built shared package
cp apps/web/.env.example apps/web/.env
pnpm dev                               # http://localhost:5173
```

Sign-in needs the API running too (`docker compose up -d`, then `pnpm dev:api`). Open http://localhost:5173 and create an account on `/register`; the session survives reloads through an httpOnly refresh cookie.

## Scripts (run in `apps/web`, or via `pnpm --filter @automate/web <script>`)

| Script                          | What it does                                             |
| ------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                      | Vite dev server on :5173                                 |
| `pnpm build`                    | Type check (`tsc -b`) + production build into `dist/`    |
| `pnpm preview`                  | Serve the production build locally                       |
| `pnpm typecheck`                | TypeScript only                                          |
| `pnpm lint`                     | ESLint (includes import ordering; `--fix` sorts imports) |
| `pnpm test` / `pnpm test:watch` | Vitest + Testing Library                                 |

Formatting is repo-wide: `pnpm format` / `pnpm format:check` from the root.

## Environment variables

| Variable            | Required | Example                        | Notes                                     |
| ------------------- | -------- | ------------------------------ | ----------------------------------------- |
| `VITE_API_BASE_URL` | yes      | `http://localhost:3000/api/v1` | API base URL including the version prefix |

Validated at startup by `src/lib/env.ts`. A missing or invalid value stops the app with a clear console error. Vite bakes `VITE_*` values in at **build** time, so set them in the hosting provider's build settings.

## Where things live

```
src/
├── app/            # App.tsx, providers, router, module registry (modules.ts)
├── components/
│   ├── ui/         # shadcn/ui primitives (generated; add via `pnpm dlx shadcn@latest add <name>`)
│   ├── common/     # app-level building blocks: PageHeader, DataTable, FormField, StatCard…
│   ├── feedback/   # Empty/Error/Loading states, error boundaries
│   └── layout/     # AppShell, sidebar, header, theme toggle, user menu
├── features/<id>/  # one folder per module; route.tsx is its lazily loaded entry
├── hooks/          # shared hooks
├── lib/            # env, API client, API errors, query client, form helpers
├── stores/         # Zustand (client-only global state)
├── styles/         # Tailwind entry + design tokens
├── test/           # Vitest setup
└── utils/          # pure helpers (Indian formatters)
```

More detail:

- [docs/architecture/frontend.md](../../docs/architecture/frontend.md): architecture, conventions, adding a module.
- [docs/architecture/design-system.md](../../docs/architecture/design-system.md): tokens, typography, components.
