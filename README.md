<div align="center">

<img src="docs/assets/logo.svg" alt="AutoMate logo" width="72" height="72">

# AutoMate

**Your car ownership companion.** Fuel, expenses, maintenance, documents and trips in one place,
with the true cost of owning each vehicle.

[![CI](https://github.com/Sainimayank1/AutoMate/actions/workflows/ci.yml/badge.svg)](https://github.com/Sainimayank1/AutoMate/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](.nvmrc)

[Features](#features) · [Screenshots](#screenshots) · [Quick start](#quick-start) ·
[Architecture](#architecture) · [Deployment](#deployment) · [Contributing](#contributing)

<img src="docs/assets/screenshots/dashboard.png" alt="AutoMate dashboard: the active vehicle, what needs attention next, and this month's spending, running cost and mileage" width="900">

</div>

## About AutoMate

Owning a car is more than paying for fuel. There are services that come due by date or by
kilometres, insurance and PUC renewals, EMIs, tolls, parking, repairs and the slow drift of the
odometer. Most people track bits of this in a spreadsheet, a notes app and a pile of receipts, and
never see what the car actually costs them.

AutoMate brings all of it into one app. You log a fill-up, a service or a trip once, and AutoMate
links the money to the record, works out real mileage from full-tank fill-ups, tells you what's due
next, reminds you before documents expire, and shows the total cost of ownership per vehicle and
per kilometre.

It's built for individuals and families who look after one or more vehicles. It's India-first
(rupees, kilometres, DD/MM/YYYY, Indian document types such as RC and PUC), mobile-first, and works
in any modern browser on a phone or a computer.

**What makes it different from an expense tracker:**

- **Records, not just amounts.** A service record keeps its parts, workshop and odometer reading,
  and files its expense automatically. Nothing is entered twice, and nothing is counted twice.
- **Honest numbers.** Mileage comes only from full-tank sequences (partial fills roll into the next
  full one). A loan's principal isn't treated as a running cost; its interest is.
- **Due by time or distance.** Maintenance is due at whichever comes first, from your own
  intervals.
- **Self-hostable and open source.** Your data stays in your own database, with full backups you
  can restore anywhere.

## Features

Everything below is implemented and in use.

| Module              | What you can do                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**       | See the active vehicle, what needs attention next (overdue service, expiring documents, due payments), this period's spending, running cost per km, mileage, upcoming EMIs and recent activity. Customise which cards show.                                                                                                 |
| **Garage**          | Add vehicles with a guided wizard, switch the active vehicle, archive and restore, and transfer a vehicle with all its records to another account.                                                                                                                                                                          |
| **Fuel**            | Log fill-ups (full or partial), with mileage from full-tank sequences, a mileage trend, cost per km, best and worst tanks, and station search.                                                                                                                                                                              |
| **Expenses**        | Categories you can extend, refunds, splitting across vehicles, receipts, recurring payments, loans with EMIs and rate changes, budgets, total cost of ownership, insights, CSV import and export, and a printable report.                                                                                                   |
| **Maintenance**     | Schedules by km and/or time, service and repair records with parts and a linked expense, a service history timeline, tracked parts with warranty and lifespan, inspection checklists, workshops, analytics (spend trends, service vs repair, frequency, part life) and a planner with cost estimates and generic templates. |
| **Documents**       | A vault for RC, insurance, PUC, licence and more, with files (PDF or photos) kept in private storage and expiry reminders.                                                                                                                                                                                                  |
| **Trips**           | Log trips by odometer or distance, with costs, linked fill-ups, routes on a map, a trip planner, multi-day road trips, analytics, photos, and CSV import and export.                                                                                                                                                        |
| **Analytics**       | Total cost of ownership across all your vehicles.                                                                                                                                                                                                                                                                           |
| **Notifications**   | An inbox raised from your records (due, overdue, expiring), with snooze and dismiss, your own repeating reminders, per-category timing, "Renew" straight from an expiring document, and optional Web Push with quiet hours.                                                                                                 |
| **Settings**        | Profile and photo, theme (dark or light), default vehicle, reminder preferences, password change, signed-in devices and account deletion.                                                                                                                                                                                   |
| **Backup & Export** | CSV exports, and a full ZIP backup (records and files) that restores into any account.                                                                                                                                                                                                                                      |

Search vehicles, expenses, fill-ups, services, documents, trips and reminders with
<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>. The app can be added
to a phone's home screen.

## Screenshots

All screenshots come from the running app with the synthetic demo data (`pnpm db:seed:demo`).

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/fuel.png" alt="Fuel: mileage from full-tank sequences, the mileage trend and the fill-up history"><br><sub><b>Fuel.</b> Mileage from full-tank sequences, with the trend and history.</sub></td>
    <td width="50%"><img src="docs/assets/screenshots/expenses.png" alt="Expenses overview with spending by category and the monthly trend"><br><sub><b>Expenses.</b> Where the money goes, month by month.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshots/maintenance.png" alt="Maintenance overview: overdue and upcoming schedules and spending"><br><sub><b>Maintenance.</b> What's overdue, what's next, what it cost.</sub></td>
    <td><img src="docs/assets/screenshots/maintenance-analytics.png" alt="Maintenance analytics: spend, service frequency, category breakdown and insights"><br><sub><b>Maintenance analytics.</b> Spend, frequency and rule-based insights.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshots/garage.png" alt="Garage with two vehicles"><br><sub><b>Garage.</b> Every vehicle and its status.</sub></td>
    <td><img src="docs/assets/screenshots/documents.png" alt="Documents vault with expiry states"><br><sub><b>Documents.</b> RC, insurance and PUC with expiry reminders.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshots/trips.png" alt="Trip history grouped by month"><br><sub><b>Trips.</b> History, costs, routes and road trips.</sub></td>
    <td><img src="docs/assets/screenshots/analytics.png" alt="Fleet analytics: total cost of ownership across vehicles"><br><sub><b>Analytics.</b> Total cost of ownership across vehicles.</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/assets/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="240">
  &nbsp;
  <img src="docs/assets/screenshots/mobile-fuel.png" alt="Fuel on a phone" width="240">
  &nbsp;
  <img src="docs/assets/screenshots/mobile-maintenance.png" alt="Maintenance on a phone" width="240">
</p>

## Tech stack

| Area         | Technologies                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web app**  | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query and Table, React Hook Form, Zustand, Recharts, Leaflet, React Router          |
| **API**      | NestJS 11, Prisma 7, Passport (JWT), argon2, Zod (via nestjs-zod), Swagger/OpenAPI, Helmet, rate limiting, pino logging, sharp (image thumbnails), Web Push |
| **Database** | PostgreSQL 17                                                                                                                                               |
| **Shared**   | `packages/shared`: Zod schemas, types and calculations used by both apps                                                                                    |
| **Files**    | Local disk or any S3-compatible bucket (Cloudflare R2, AWS S3), always behind short-lived signed links                                                      |
| **Testing**  | Vitest, Testing Library, Supertest, Playwright                                                                                                              |
| **Tooling**  | pnpm workspaces, ESLint, Prettier, husky with lint-staged, GitHub Actions, Docker Compose                                                                   |

## Architecture

AutoMate is a pnpm monorepo with a React web app, a NestJS REST API and a shared package of schemas
and types that both use.

```mermaid
flowchart LR
  subgraph Browser
    Web["Web app<br/>React + Vite"]
  end
  Shared["packages/shared<br/>Zod schemas, types, calculations"]
  API["API<br/>NestJS, /api/v1"]
  DB[("PostgreSQL 17")]
  Files[("Files<br/>local disk or S3/R2")]
  Ext["Optional services<br/>geocoding, routing, Web Push"]

  Web -- "REST + JWT" --> API
  Web -. "upload / download<br/>signed links" .-> Files
  API -- "Prisma" --> DB
  API -- "signs links, checks uploads" --> Files
  API -.-> Ext
  Shared --- Web
  Shared --- API
```

- **Web app** (`apps/web`): a single-page app. It talks to the API only through one API client and
  per-feature hooks; business rules live in the API and the shared package, never in components.
- **API** (`apps/api`): modules per feature (controller → service → Prisma), a global response
  envelope and error codes, request validation from the shared Zod schemas, and every record scoped
  to its owner. Every list endpoint is paginated.
- **Authentication**: 15-minute JWT access tokens kept in memory, plus a rotating, httpOnly refresh
  cookie stored only as a hash. Passwords are hashed with argon2id. Sign-in is rate limited.
- **Files**: browsers upload and download through short-lived signed links: straight to the bucket
  with S3/R2, or through the API with local storage. The API checks each upload's size and real file
  type on confirm, and makes WebP thumbnails of photos.
- **Database**: PostgreSQL through Prisma, with money as `Decimal` (never floating point) and every
  schema change as a committed migration.

Design notes for each module are in [`docs/architecture/`](docs/architecture/).

## Quick start

**Prerequisites:** Git, [Node.js 24+](https://nodejs.org/), pnpm (through Corepack, bundled with
Node.js), and [Docker](https://docs.docker.com/get-docker/) with Docker Compose for the database.

```bash
git clone https://github.com/Sainimayank1/AutoMate.git
cd AutoMate
corepack enable
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Set JWT_ACCESS_SECRET in apps/api/.env to a random value (32+ characters):
openssl rand -base64 48

pnpm db:up        # PostgreSQL in Docker
pnpm codegen      # shared package + Prisma client
pnpm db:deploy    # apply migrations
pnpm db:seed      # reference data
```

Start the API and the web app in two terminals:

```bash
pnpm dev:api      # API on http://localhost:3000
pnpm dev          # web app on http://localhost:5173
```

Open **http://localhost:5173** and create an account, or load the demo data and sign in with the
account it prints:

```bash
pnpm db:seed:demo
```

Detailed steps, conventions and checks are in [CONTRIBUTING.md](CONTRIBUTING.md). Stuck? See
[troubleshooting](docs/development/troubleshooting.md).

### Docker

Run the whole stack (PostgreSQL, API, and the web app behind Caddy) with Docker alone, no Node.js
needed:

```bash
cp .env.example .env    # set POSTGRES_PASSWORD and JWT_ACCESS_SECRET (commands in the file)
docker compose -f docker-compose.prod.yml up -d --build
```

Open <http://localhost>. Migrations and reference data are applied automatically by a one-off
`migrate` service; data and uploaded files live in named volumes. Set `PUBLIC_URL` to a domain and
Caddy serves it over HTTPS with an automatic certificate. The full guide, including ports, logs,
updates and backups, is [docs/deployment/self-hosting.md](docs/deployment/self-hosting.md).

For development, `docker-compose.yml` runs only the database (`pnpm db:up`, bound to `127.0.0.1`).

## Configuration

The API and web app are configured with environment variables, validated at startup. The essentials:

| Variable            | Service | Required | Description                                 | Example                                                  |
| ------------------- | ------- | -------- | ------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`      | API     | yes      | PostgreSQL connection URL                   | `postgresql://postgres:postgres@localhost:5432/automate` |
| `JWT_ACCESS_SECRET` | API     | yes      | Signs access tokens; 32+ random characters  | output of `openssl rand -base64 48`                      |
| `FRONTEND_URL`      | API     | no       | Allowed web origins (CORS), comma-separated | `http://localhost:5173`                                  |
| `STORAGE_PROVIDER`  | API     | no       | `local`, `r2` or `s3`                       | `local`                                                  |
| `VITE_API_BASE_URL` | Web     | yes      | The API's base URL                          | `http://localhost:3000/api/v1`                           |

Every variable (storage, maps, Web Push, production checks) is documented in
[docs/development/environment-variables.md](docs/development/environment-variables.md), with
templates in `apps/api/.env.example` and `apps/web/.env.example`. Never commit a `.env` file, and
never put secrets in `VITE_` variables: they end up in the browser bundle.

## Project structure

```
AutoMate/
├── apps/
│   ├── api/                 NestJS API
│   │   ├── prisma/          schema, migrations, seed and demo seed
│   │   ├── src/modules/     feature modules (vehicles, fuel, expenses, maintenance, …)
│   │   └── test/            end-to-end tests against a real database
│   └── web/                 React web app
│       ├── src/features/    one folder per module (pages, components, hooks, services)
│       ├── src/components/  shared UI: shadcn/ui primitives, layout, feedback
│       ├── e2e/             Playwright browser tests
│       └── screenshots/     the README screenshot capture
├── packages/shared/         Zod schemas, types and calculations for both apps
├── deploy/                  Caddyfile and the backup script for self-hosting
├── docs/                    product spec, architecture notes, development and deployment guides
├── .github/workflows/       CI and scheduled jobs
├── docker-compose.yml       development database
└── docker-compose.prod.yml  production stack (PostgreSQL, API, Caddy)
```

## API

The REST API lives under `/api/v1`. With the API running in development, interactive
documentation (Swagger UI) is at **http://localhost:3000/api/docs** and the OpenAPI JSON at
`/api/docs/json`. Swagger is off in production unless `SWAGGER_ENABLED=true`.

- **Authentication:** `POST /api/v1/auth/register` or `/auth/login` returns an access token; send
  it as `Authorization: Bearer <token>`. The refresh cookie renews it at `/auth/refresh`.
- **Responses:** `{ "success": true, "data": …, "meta": … }`; errors are
  `{ "success": false, "message": …, "error": { "code", "details", "requestId" } }`.
- **Lists:** always paginated with `?page=&pageSize=` (default 20, at most 100), with
  `{ page, pageSize, total, totalPages }` in `meta`.
- **Health:** `GET /api/v1/health`.

Conventions are in [docs/architecture/api-conventions.md](docs/architecture/api-conventions.md).

## Database

PostgreSQL 17 through Prisma 7. Migrations live in `apps/api/prisma/migrations` and are applied with
`pnpm db:deploy`; `pnpm db:seed` adds reference data and `pnpm db:seed:demo` a synthetic demo
account. Creating migrations, resetting, and backing up and restoring are covered in
[docs/development/database.md](docs/development/database.md).

## Testing

| Command             | What it runs                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm check`        | Formatting, lint, type checks and unit tests for every package       |
| `pnpm test:e2e:api` | API end-to-end tests against the local database                      |
| `pnpm test:e2e:web` | Playwright browser tests (desktop and phone) against the running app |
| `pnpm build`        | Production builds of the shared package, API and web app             |

GitHub Actions runs all of these on every push to `main` and every pull request.

## Deployment

- **Recommended: self-hosting with Docker.** One Linux server (2 vCPU, 2–4 GB RAM) runs PostgreSQL,
  the API and Caddy with automatic HTTPS from `docker-compose.prod.yml`. PostgreSQL stays on an
  internal network, the API runs as a non-root user, and migrations run before each start.
  Guides: [self-hosting](docs/deployment/self-hosting.md) (install, updates, rollback) and
  [backup and restore](docs/deployment/backup-and-restore.md) (with a cron-ready
  `deploy/backup.sh`).
- **Alternative: managed free tiers.** The web app on Cloudflare Pages, the API on Render,
  PostgreSQL on Neon and files on Cloudflare R2. The repository includes the configuration
  (`render.yaml`, `apps/web/public/_redirects` and `_headers`); the guide is
  [docs/architecture/deployment.md](docs/architecture/deployment.md).

In any deployment: set strong secrets, serve over HTTPS, never expose PostgreSQL to the internet,
and back up the database and files regularly. See [SECURITY.md](SECURITY.md).

## Roadmap

- [x] Garage, Fuel, Expenses, Dashboard
- [x] Maintenance, Documents, Notifications
- [x] Trips, Analytics
- [x] Settings, Backup & Export, vehicle transfer between accounts
- [x] Self-hosting with Docker Compose and automatic HTTPS
- [ ] Versioned releases with a changelog and upgrade notes
- [ ] Password reset and email verification (needs an email provider)
- [ ] Email reminders and digests
- [ ] Thumbnails for trip photos
- [ ] Restoring a backup into an existing vehicle (merge)

An AI assistant module was considered and dropped. Ideas and requests are welcome as
[issues](https://github.com/Sainimayank1/AutoMate/issues).

## Contributing

Notable changes are listed in the [changelog](CHANGELOG.md). Contributions are welcome: bug reports, fixes, features, documentation and tests. Read
[CONTRIBUTING.md](CONTRIBUTING.md) for the setup, coding standards, commit style and pull request
checklist, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md) for how to
report them privately.

## Support

Questions, bug reports and feature requests: see [SUPPORT.md](SUPPORT.md).

## License

AutoMate is free software, licensed under the [GNU Affero General Public License v3.0](LICENSE)
(`AGPL-3.0-only`). You can use, study, change and share it. If you run a modified version as a
service for others, you must offer them the source of your changes.

## Credits

AutoMate stands on many open-source projects, among them [React](https://react.dev),
[NestJS](https://nestjs.com), [Prisma](https://www.prisma.io), [PostgreSQL](https://www.postgresql.org),
[shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com),
[Tailwind CSS](https://tailwindcss.com), [TanStack](https://tanstack.com),
[Recharts](https://recharts.org), [Leaflet](https://leafletjs.com) and
[Lucide](https://lucide.dev) icons. Fonts: Inter, Manrope and Geist Mono (SIL Open Font License),
via Fontsource.

Maps and places use [OpenStreetMap](https://www.openstreetmap.org/copyright) data
(© OpenStreetMap contributors), with Nominatim and OSRM as the default development services;
their usage policies apply. The Code of Conduct is adapted from the
[Contributor Covenant](https://www.contributor-covenant.org).
