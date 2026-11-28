# AutoMate documentation

Start with the [project README](../README.md). This folder holds everything deeper.

## Using and running AutoMate

- [Environment variables](development/environment-variables.md): every setting the API and web app read.
- [Database](development/database.md): migrations, seeding (including the demo data), resets and backups.
- [Troubleshooting](development/troubleshooting.md): common problems and fixes.
- [Deployment](architecture/deployment.md): the managed-hosting setup (Cloudflare Pages, Render, Neon, R2).

## Contributing

- [CONTRIBUTING.md](../CONTRIBUTING.md): setup, coding standards, checks, commits and pull requests.
- [Product spec](MODULES.md): what each module does, and the rules that cross modules.
- [Tech stack](TECH_STACK.md): packages, folder layout and infrastructure choices.

## Architecture

How the code is organised and why:

- [Backend](architecture/backend.md), [API conventions](architecture/api-conventions.md),
  [Database](architecture/database.md), [Security](architecture/security.md)
- [Frontend](architecture/frontend.md), [Design system](architecture/design-system.md)
- Modules: [Dashboard](architecture/dashboard.md), [Expenses](architecture/expenses.md),
  [Maintenance](architecture/maintenance.md), [Documents](architecture/documents.md),
  [Trips](architecture/trips.md), [Analytics](architecture/analytics.md),
  [Notifications](architecture/notifications.md), [Settings](architecture/settings.md),
  [Backup & Export](architecture/backup.md)

## Assets

`assets/` holds the logo and the README screenshots. Re-capture the screenshots from the demo data
with `pnpm db:seed:demo` and then `pnpm --filter @automate/web screenshots` (API and web app
running).
