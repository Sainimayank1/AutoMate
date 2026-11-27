# AutoMate — Tech Stack & Infrastructure

Free-first · Open-source packages · Scalable architecture

Build on a modern, production-ready architecture while keeping all infrastructure free to develop and deploy initially. Avoid repeated boilerplate: use mature libraries for authentication, validation, UI components, forms, tables, charts, file handling, caching, and other common tasks instead of reinventing them.

## Contents

1. [Core stack](#1-core-stack)
2. [Frontend — React + Vite](#2-frontend--react--vite)
3. [Backend — NestJS](#3-backend--nestjs)
4. [Authentication & security](#4-authentication--security)
5. [Shared packages](#5-shared-packages)
6. [File storage & document management](#6-file-storage--document-management)
7. [Background jobs, notifications & automation](#7-background-jobs-notifications--automation)
8. [AI integration](#8-ai-integration--automate-ai-assistant)
9. [Analytics & charts](#9-analytics--charts)
10. [Infrastructure — free initially](#10-infrastructure--keep-it-free-initially)
11. [Testing, code quality & developer tools](#11-testing-code-quality--developer-tools)
12. [Monorepo architecture](#12-monorepo-architecture)
13. [Final technology decision](#13-final-technology-decision)
14. [Package philosophy](#14-package-philosophy)
15. [Next phase](#15-next-phase)

---

## 1. Core stack

- **Frontend — React + Vite:** fast, responsive web application
- **Backend — NestJS:** modular, structured API architecture
- **Database — PostgreSQL:** free, powerful relational database
- **ORM — Prisma:** type-safe database access and migrations

| Layer              | Technology          | Purpose                          |
| ------------------ | ------------------- | -------------------------------- |
| Frontend           | React               | UI development                   |
| Frontend build     | Vite                | Dev server and production builds |
| Language           | TypeScript (strict) | Type safety                      |
| Backend            | NestJS              | API and business logic           |
| API                | REST API            | Frontend/backend communication   |
| Database           | PostgreSQL          | Persistent data                  |
| ORM                | Prisma              | Schema, migrations, queries      |
| API documentation  | Swagger / OpenAPI   | Interactive API docs             |
| Runtime validation | Zod                 | Schema validation                |
| Package manager    | pnpm                | Fast, disk-efficient packages    |
| Monorepo           | Turborepo           | Build and task orchestration     |
| Version control    | Git + GitHub        | Source management                |

---

## 2. Frontend — React + Vite

The frontend should be designed like a premium automotive SaaS dashboard, but remain responsive enough to work on mobile browsers.

### Frontend core

| Package               | Use                 | Why                                          |
| --------------------- | ------------------- | -------------------------------------------- |
| react                 | UI                  | Component-based development                  |
| vite                  | Build tool          | Fast development and builds                  |
| typescript            | Language            | Type safety                                  |
| react-router          | Routing             | Routes, nested layouts, protected pages      |
| @tanstack/react-query | Server state        | API fetching, caching, retries, invalidation |
| zustand               | Global client state | Auth, active vehicle, UI preferences         |
| react-hook-form       | Forms               | Reusable, performant forms                   |
| zod                   | Validation          | Validate inputs and shared schemas           |
| @hookform/resolvers   | Form integration    | Connect React Hook Form with Zod             |
| axios                 | HTTP client         | Centralized API requests and interceptors    |

### UI & design system

- **shadcn/ui** — reusable UI components
- **Tailwind CSS** — styling and layout system
- **Radix UI** — accessible UI primitives
- **Lucide React** — consistent icon library

| Package                  | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| tailwindcss              | Utility-first styling                                          |
| shadcn/ui                | Prebuilt reusable components                                   |
| @radix-ui/*              | Accessible component primitives                                |
| lucide-react             | Icons                                                          |
| class-variance-authority | Component variants                                             |
| clsx                     | Conditional CSS classes                                        |
| tailwind-merge           | Resolve conflicting Tailwind classes                           |
| next-themes              | Theme preference support (can also be adapted outside Next.js) |

We will not build our own buttons, modal systems, dropdowns, tooltips, tabs, accordions, and similar primitives from scratch. We will use shadcn/ui and extend its components whenever needed.

### Frontend feature packages

| Package               | Used for                                    |
| --------------------- | ------------------------------------------- |
| @tanstack/react-table | Advanced data tables                        |
| recharts              | Fuel, expenses and mileage charts           |
| date-fns              | Date formatting, calculations and intervals |
| sonner                | Toast notifications                         |
| react-dropzone        | File drag-and-drop                          |
| react-pdf             | PDF preview and rendering                   |
| @tiptap/react         | Rich text editor when needed                |
| cmdk                  | Search/command menu                         |
| vaul                  | Drawer and bottom-sheet UI                  |
| react-number-format   | Currency, mileage and numeric inputs        |
| input-otp             | OTP input                                   |
| react-error-boundary  | Error boundaries                            |
| @dnd-kit/*            | Drag-and-drop, dashboard customization      |
| papaparse             | CSV import and export                       |

### Frontend utilities we should build once

- Reusable data tables with pagination, sorting, filters, column visibility and export.
- Reusable form fields with validation.
- Standard loading skeletons.
- Empty states.
- Error states.
- Confirmation dialogs.
- Search and filtering utilities.
- Date and currency formatting.
- Indian currency formatter (₹).
- Odometer and fuel quantity formatter.
- Reusable file upload component.
- Page header and breadcrumbs.
- Standardized API error handling.
- Toast notification system.
- Responsive sidebar, navigation and mobile drawer.

---

## 3. Backend — NestJS

NestJS is the backend framework. Use its modular architecture to keep each AutoMate module independent and maintainable.

### Backend core packages

| Package                  | Purpose                           |
| ------------------------ | --------------------------------- |
| @nestjs/core             | Core framework                    |
| @nestjs/common           | Controllers, services, decorators |
| @nestjs/platform-express | HTTP server                       |
| @nestjs/config           | Environment configuration         |
| @nestjs/swagger          | API documentation                 |
| @nestjs/throttler        | Rate limiting                     |
| @nestjs/schedule         | Scheduled jobs                    |
| @nestjs/cache-manager    | Caching integration               |
| class-validator          | DTO validation                    |
| class-transformer        | DTO transformation                |
| helmet                   | HTTP security headers             |
| compression              | Response compression              |
| nestjs-pino              | Structured logging                |
| pino                     | Logging engine                    |
| pino-pretty              | Readable local development logs   |
| rxjs                     | Reactive utilities used by NestJS |

### Database and data layer

| Package        | Purpose                           |
| -------------- | --------------------------------- |
| prisma         | CLI, schema, migration management |
| @prisma/client | Type-safe DB client               |
| pg             | PostgreSQL driver where required  |
| zod            | Runtime schema validation         |
| nestjs-zod     | Zod integration with NestJS       |

### Database rules

- PostgreSQL as the primary database.
- Prisma as the main database access layer.
- Migrations for every schema change.
- No direct database calls inside controllers.
- Controllers → Services → Repository/data access.
- Transactions for operations that update multiple records.
- Proper foreign keys and database constraints.
- Indexes for frequently queried fields.
- Soft deletion only where it makes sense.
- Every vehicle-related record must be properly scoped to the user and vehicle.
- Decimal precision for money, fuel and financial data — never use floating point for monetary calculations.

### Backend reusable utilities

| Package          | Purpose                          |
| ---------------- | -------------------------------- |
| date-fns         | Date/time calculations           |
| decimal.js       | Precise financial calculations   |
| nanoid           | Unique identifiers where needed  |
| uuid             | UUID utilities if needed         |
| lodash           | Selective utility functions only |
| file-type        | Validate uploaded file types     |
| sharp            | Image resizing/compression       |
| sanitize-html    | Sanitize HTML when applicable    |
| @nestjs/terminus | Health checks                    |

---

## 4. Authentication & security

Do not manually implement authentication primitives and security middleware from scratch.

| Package           | Purpose                            |
| ----------------- | ---------------------------------- |
| @nestjs/passport  | Passport integration               |
| passport          | Authentication framework           |
| passport-jwt      | JWT authentication strategy        |
| @nestjs/jwt       | JWT creation and verification      |
| argon2            | Password hashing                   |
| cookie-parser     | Cookie handling                    |
| helmet            | Security headers                   |
| @nestjs/throttler | Protect against excessive requests |

### Authentication features

- Registration
- Login
- Logout
- Access token
- Refresh token
- Forgot password
- Reset password
- Email verification
- Session management
- Protected routes
- Role/permission-based access when required
- Rate limiting
- Secure token storage
- Account deletion

Use a secure authentication pattern with short-lived access tokens and carefully managed refresh tokens. Passwords must never be stored in plain text.

---

## 5. Shared packages

React and NestJS live in one repository, so code used by both goes in `packages/shared`.

| Shared item      | Example                           |
| ---------------- | --------------------------------- |
| Zod schemas      | Fuel record validation            |
| Types            | Vehicle, FuelRecord, Expense      |
| Enums            | FuelType, ExpenseCategory         |
| Constants        | Maintenance categories            |
| API contracts    | Request/response structures       |
| Helpers          | Common calculations               |
| Formatting rules | Units and data format definitions |

Example:

```ts
// packages/shared/src/schemas/fuel.schema.ts
import { z } from "zod";

export const createFuelSchema = z.object({
  vehicleId: z.string().min(1),
  odometer: z.number().positive(),
  quantity: z.number().positive(),
  pricePerLiter: z.number().positive(),
  date: z.string(),
  isFullTank: z.boolean(),
});

export type CreateFuelInput = z.infer<typeof createFuelSchema>;
```

The same schema is used in the React frontend and the NestJS backend. One schema, two applications: less duplication, consistent validation. This prevents the frontend accepting something the backend rejects because the rules differ.

---

## 6. File storage & document management

AutoMate will store:

- RC documents
- Insurance PDFs
- PUC certificates
- Service invoices
- Fuel receipts
- Vehicle photographs
- Other vehicle-related documents

Do not store files directly inside PostgreSQL.

| Technology            | Purpose                  | Free starting option |
| --------------------- | ------------------------ | -------------------- |
| S3-compatible storage | File storage abstraction | Cloudflare R2        |
| Multer                | Backend upload handling  | Free package         |
| sharp                 | Image optimization       | Free package         |
| file-type             | File validation          | Free package         |

Approach:

- Files uploaded through the backend or a secure presigned upload flow.
- Metadata stored in PostgreSQL.
- Files stored in object storage.
- Private files, not public buckets.
- Secure access to documents.
- File size limits.
- File type validation.
- Image compression.
- Document preview.
- Future OCR and AI extraction.

Cloudflare R2 is a good starting candidate. Check its free allowance and pricing at deploy time.

---

## 7. Background jobs, notifications & automation

Jobs that don't need to run during a user's API request:

- Service reminder generation.
- Insurance expiry alerts.
- PUC expiry reminders.
- Scheduled notifications.
- Monthly ownership summary.
- Maintenance due calculations.
- Email reminders.
- Future AI analysis.

| Package          | Purpose                   |
| ---------------- | ------------------------- |
| @nestjs/schedule | Cron and scheduled jobs   |
| bullmq           | Background job queue      |
| ioredis          | Redis connection          |
| @nestjs/bullmq   | NestJS BullMQ integration |

**Important:** Redis and BullMQ are not mandatory in the initial MVP. Start with NestJS scheduled jobs and add queue/worker infrastructure only when jobs require it. This keeps the first deployment free and simple.

---

## 8. AI integration — AutoMate AI Assistant

The assistant must not be a chatbot that only gives generic answers. It must understand the user's actual vehicle and recorded data.

| Technology                               | Purpose                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| Anthropic SDK                            | Claude integration                                           |
| @nestjs/ai or direct service integration | Backend AI orchestration (evaluate maturity before adopting) |
| Zod                                      | Validate tool inputs and outputs                             |
| NestJS tools/services                    | Execute controlled actions and data retrieval                |

Keep the AI provider behind a dedicated interface so we can switch between Claude, OpenAI, or other providers without rewriting the assistant module.

Controlled tool access:

- `getVehicleProfile()`
- `getFuelHistory()`
- `calculateMileage()`
- `getExpenseSummary()`
- `getMaintenanceHistory()`
- `getUpcomingMaintenance()`
- `getDocumentExpiry()`
- `getTripHistory()`

AI must never calculate financial or mileage figures by guessing. The backend calculates actual values and provides them to the AI.

AI features incur costs. Build and test the app without requiring an AI API initially.

---

## 9. Analytics & charts

Don't build chart components from scratch.

| Package               | Purpose                     |
| --------------------- | --------------------------- |
| recharts              | Charts and visual analytics |
| @tanstack/react-table | Data tables                 |
| date-fns              | Date ranges and grouping    |
| papaparse             | CSV exports                 |

Used for:

- Monthly fuel expense chart.
- Mileage trend chart.
- Monthly expense breakdown.
- Cost per kilometre.
- Maintenance cost trends.
- Vehicle usage trends.
- Ownership expense summary.

---

## 10. Infrastructure — keep it free initially

Start with free hosting. Free-tier conditions change, so verify actual limits before deployment.

| Service          | What we use it for                            | Required initially?       |
| ---------------- | --------------------------------------------- | ------------------------- |
| Cloudflare Pages | Frontend deployment (static React/Vite build) | Yes                       |
| Render           | Backend deployment (NestJS API)               | Yes                       |
| Neon             | Managed PostgreSQL                            | Yes                       |
| Cloudflare R2    | Documents and photos                          | When file module starts   |
| Upstash          | Redis (jobs and caching)                      | No                        |
| GitHub           | Git repository                                | Yes                       |
| GitHub Actions   | CI/CD                                         | Yes                       |
| Sentry           | Error tracking                                | Recommended               |
| Resend           | Transactional email                           | When email features start |

### Development infrastructure

Run locally with Docker Compose so setting up the dev environment is easy:

- PostgreSQL
- Redis (optional)
- NestJS API
- React frontend

---

## 11. Testing, code quality & developer tools

| Package                     | Purpose                     |
| --------------------------- | --------------------------- |
| vitest                      | Unit and component testing  |
| @testing-library/react      | React component testing     |
| @testing-library/user-event | User interaction simulation |
| playwright                  | End-to-end browser testing  |
| eslint                      | Code linting                |
| prettier                    | Code formatting             |
| husky                       | Git hooks                   |
| lint-staged                 | Run checks on staged files  |

Use automated checks to catch regressions, particularly for important calculations: fuel mileage, expense aggregation, loan costs and maintenance intervals.

---

## 12. Monorepo architecture

pnpm workspace + Turborepo: frontend, backend and shared packages in one repository.

- **apps/web** — React + Vite: Dashboard · Garage · Fuel · Expenses · Maintenance · Analytics
- **apps/api** — NestJS: REST API · Auth · Business logic · Jobs · AI
- **packages/shared** — types, schemas, enums, constants
- **packages/ui** — reusable UI components
- **packages/config** — ESLint, TypeScript configs
- **packages/utils** — common utilities
- **Infrastructure** — PostgreSQL, Redis, Docker Compose, GitHub Actions

### Folder structure

```
automate/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── layouts/
│   │   │   ├── lib/
│   │   │   ├── routes/
│   │   │   ├── stores/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── vehicles/
│       │   │   ├── fuel/
│       │   │   ├── expenses/
│       │   │   ├── maintenance/
│       │   │   ├── documents/
│       │   │   ├── trips/
│       │   │   ├── analytics/
│       │   │   ├── assistant/
│       │   │   └── notifications/
│       │   ├── common/
│       │   ├── config/
│       │   └── main.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   ├── enums/
│   │   │   └── constants/
│   │   └── package.json
│   ├── ui/
│   ├── utils/
│   └── config/
│
├── infrastructure/
│   └── docker/
│
├── docs/
│   ├── architecture/
│   ├── database/
│   └── api/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

---

## 13. Final technology decision

| Technology   | Selected                         |
| ------------ | -------------------------------- |
| Frontend     | React + Vite                     |
| Language     | TypeScript                       |
| UI           | shadcn/ui + Tailwind CSS         |
| Icons        | Lucide                           |
| Forms        | React Hook Form + Zod            |
| API state    | TanStack Query                   |
| Client state | Zustand                          |
| HTTP         | Axios                            |
| Backend      | NestJS                           |
| API          | REST                             |
| Database     | PostgreSQL                       |
| ORM          | Prisma                           |
| Auth         | JWT + Passport                   |
| API docs     | Swagger                          |
| Charts       | Recharts                         |
| Tables       | TanStack Table                   |
| Storage      | Cloudflare R2                    |
| Cache/Queue  | Redis + BullMQ (later)           |
| Monorepo     | pnpm + Turborepo                 |
| Containers   | Docker + Docker Compose          |
| Deployment   | Cloudflare Pages + Render        |
| DB Hosting   | Neon                             |
| CI/CD        | GitHub Actions                   |
| Monitoring   | Sentry                           |
| AI           | Claude API, provider abstraction |

---

## 14. Package philosophy

Rules enforced when implementing AutoMate:

- **Don't reinvent existing solutions.** Before building any utility or component, look for an existing reliable package.
- **Don't install unnecessary packages.** Maximum leverage from packages, not dependency bloat.
- **Don't create giant components.** Break every feature into reusable components, hooks and services.
- **Don't duplicate validation.** Share schemas between frontend and backend where practical.
- **Don't duplicate business logic.** Fuel, cost and maintenance calculations belong in the backend/shared domain layer as appropriate.
- **Don't put business logic inside UI components.**
- **Don't call APIs directly inside random components.** Use a centralized API layer and feature hooks.
- **Don't hardcode configuration.** Use validated environment variables and configuration modules.
- **Don't make the frontend responsible for financial truth.** Backend calculations are authoritative.
- **Don't overengineer the MVP.** Use scalable patterns without introducing unnecessary infrastructure.

---

## 15. Next phase

Lock this stack and start with **Phase 0 — Infrastructure**: monorepo, frontend bootstrap, backend bootstrap, shared packages, database, Docker, configuration, linting, and deployment foundations. **No vehicle/product modules yet.**
