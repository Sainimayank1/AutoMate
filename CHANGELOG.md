# Changelog

All notable changes to AutoMate are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (see [docs/RELEASING.md](docs/RELEASING.md)).

## [Unreleased]

AutoMate has not had a tagged release yet. Everything below is on `main` and will make up the first
release.

### Added

- **Garage:** vehicles with a guided setup, an active vehicle, archive and restore, and transfer of a
  vehicle with all its records to another account.
- **Fuel:** fill-up log with mileage from full-tank sequences, trends, cost per km and station search.
- **Expenses:** categories (system and custom), refunds, splitting across vehicles, receipts,
  recurring payments, loans with EMIs and rate changes, budgets, total cost of ownership, insights,
  CSV import and export, and a printable report.
- **Maintenance:** schedules by distance and/or time, service and repair records with a linked
  expense, service history, tracked parts, inspections, workshops, analytics, and a planner with
  estimates and generic templates.
- **Documents:** a vault for vehicle and personal documents with private file storage, thumbnails and
  expiry reminders.
- **Trips:** trips by odometer or distance, costs, linked fill-ups, routes on a map, a planner, road
  trips, analytics, photos, and CSV import and export.
- **Dashboard and Analytics:** an overview of what needs attention and what it costs, and total cost
  of ownership across vehicles.
- **Notifications:** an inbox raised from records, snooze and dismiss, repeating reminders,
  per-category timing, renewal actions, and optional Web Push with quiet hours.
- **Settings and Backup & Export:** profile, preferences, password, devices and account deletion;
  CSV exports and a full ZIP backup that restores into any account.
- **Self-hosting:** Docker images, a production Docker Compose stack with Caddy and automatic HTTPS,
  a backup script, and guides for installing, updating, rolling back, backing up and restoring.
- **Project:** AGPL-3.0 licence, contribution guidelines, code of conduct, security and support
  policies, issue and pull request templates, a synthetic demo dataset, and CI with unit,
  end-to-end, browser, Docker and security checks.
