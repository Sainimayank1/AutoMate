# Contributing to AutoMate

Thanks for your interest in AutoMate, an open-source car ownership companion. Contributions of all
sizes are welcome: bug reports, fixes, features, documentation, design feedback and tests.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug or suggest a feature**: search [existing issues](https://github.com/Sainimayank1/AutoMate/issues)
  first, then open a new one with the matching form.
- **Fix a bug or build a feature**: for anything larger than a small fix, open an issue (or comment
  on an existing one) first so we can agree on the approach before you spend time on it.
- **Improve the docs**: typos, unclear steps and missing explanations are all worth a pull request.
- **Report a security vulnerability**: never in a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

### Prerequisites

| Tool    | Version                                                                     |
| ------- | --------------------------------------------------------------------------- |
| Git     | any recent version                                                          |
| Node.js | 24 or newer (`.nvmrc` says `24`)                                            |
| pnpm    | 12.15.0, pinned in `package.json`; `corepack enable` installs the right one |
| Docker  | with Docker Compose, for the local PostgreSQL database                      |

### First run

```bash
git clone https://github.com/Sainimayank1/AutoMate.git
cd AutoMate
corepack enable
pnpm install

# Environment files (never commit the copies)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Then set JWT_ACCESS_SECRET in apps/api/.env to a random value of 32+ characters:
openssl rand -base64 48

pnpm db:up        # PostgreSQL 17 in Docker on localhost:5432
pnpm codegen      # builds the shared package and the Prisma client
pnpm db:deploy    # applies the migrations
pnpm db:seed      # reference data (system expense categories)
```

Then start the API and the web app in two terminals:

```bash
pnpm dev:api      # http://localhost:3000/api/v1, Swagger at http://localhost:3000/api/docs
pnpm dev          # http://localhost:5173
```

Open http://localhost:5173 and create an account. Every variable in `apps/api/.env` is explained in
`apps/api/.env.example` and `apps/api/README.md`.

`pnpm install` also sets up Git hooks (husky): on every commit, Prettier and ESLint fix the files
you staged.

## Project layout

```
apps/api         NestJS REST API, Prisma schema and migrations, unit and e2e tests
apps/web         React + Vite web app, Vitest tests, Playwright browser tests (e2e/)
packages/shared  Zod schemas, types and calculations used by both apps
docs/            product spec (MODULES.md), stack (TECH_STACK.md) and architecture notes
```

Before working on a module, read its section in [`docs/MODULES.md`](docs/MODULES.md) and its notes
in [`docs/architecture/`](docs/architecture/).

## Coding standards

These rules keep the codebase consistent; reviewers will ask for them.

- **TypeScript strict**, no `any`. Formatting is Prettier's, linting is ESLint's; don't fight them.
- **Validation lives once**, as Zod schemas in `packages/shared`, used by both the web app and the API.
- **Business logic** (mileage, costs, due dates, aggregates) lives in the API or `packages/shared`,
  never in UI components. The API's numbers are authoritative.
- **Money and other financial values** use `Decimal` in the database and `decimal.js` in code, never
  floating point.
- **Every list endpoint is paginated** (`?page&pageSize`); filters and search are query parameters
  applied on the server. See [`docs/architecture/api-conventions.md`](docs/architecture/api-conventions.md).
- **API layering**: controller → service → data access, with transactions for multi-record writes.
- **UI**: use the existing shadcn/ui primitives and the design tokens; don't hand-roll buttons,
  dialogs or menus. See [`docs/architecture/design-system.md`](docs/architecture/design-system.md)
  and the design guidelines in [`.claude/skills/automate-design/`](.claude/skills/automate-design/).
- **Tests are required for calculations** (mileage, expense aggregation, loan costs, maintenance
  intervals) and expected for new behaviour.
- **Every record belongs to a user**: never allow access across users. Read
  [`docs/architecture/security.md`](docs/architecture/security.md) before touching auth or ownership.
- Use an existing package or helper before adding one, and explain any new dependency in your pull
  request.

## Database changes

- Change `apps/api/prisma/schema.prisma`, then create a migration:
  `pnpm --filter @automate/api prisma:migrate --name short_description`.
- Commit the generated migration folder with your change. One migration per change.
- Never edit or delete a migration that is already on `main`; add a new one instead.
- Describe the migration in your pull request, including anything existing data needs.

## Checks

Run these before you open a pull request:

```bash
pnpm check          # format check, lint, type check and unit tests in one go
pnpm test:e2e:api   # API end-to-end tests (needs the database from `pnpm db:up`)
pnpm build          # production builds
```

Browser tests (Playwright) drive the real app: with the dev servers running (or not; it starts them),
run `pnpm test:e2e:web`. Locally they use your installed Google Chrome.

## Branches and commits

- Branch from `main` and name the branch after the change: `feat/fuel-csv-export`,
  `fix/odometer-order`, `docs/setup-steps`, `refactor/…`, `test/…`, `chore/…`.
- Write commits in the [Conventional Commits](https://www.conventionalcommits.org/) style, which the
  history already uses:

  ```
  feat(fuel): export the fill-up history as CSV
  fix(maintenance): count the due date from the last service
  docs: explain the database reset
  ```

  Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`, `ci`.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests and documentation where they apply.
3. Run the checks above.
4. Push your branch and open a pull request against `main`. Describe what changed and why, link the
   issue, and add screenshots for UI changes (desktop and phone width).
5. Respond to review feedback. A maintainer merges once the checks pass and the review is approved.

Keep pull requests focused: one fix or feature each. Large changes are much easier to review when
split into smaller steps.

## AI assistants

You may use AI coding assistants. You are responsible for every line you submit: understand it,
test it, and make sure it follows the rules above. Don't submit code you can't explain.

The repository includes `CLAUDE.md` (project context for assistants) and the design guidelines under
`.claude/skills/automate-design/`. Optional assistant tooling, such as the code-graph hooks in
`.claude/settings.example.json`, is never required: copy it to `.claude/settings.json` only if you
use those tools.

## Licence

AutoMate is licensed under the [GNU Affero General Public License v3.0](LICENSE)
(`AGPL-3.0-only`). By contributing, you agree that your contributions are licensed under the same
licence.
