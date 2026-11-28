# Self-hosting with Docker

Run AutoMate on one server: PostgreSQL, the API and the web app, with automatic HTTPS from
[Caddy](https://caddyserver.com). Everything is defined in
[`docker-compose.prod.yml`](../../docker-compose.prod.yml) and configured with one `.env` file.

```
                internet (80, 443)
                       │
                ┌──────▼──────┐   serves the web app, proxies /api, gets HTTPS certificates
                │ web (Caddy) │
                └──────┬──────┘
                       │ frontend network
                ┌──────▼──────┐   NestJS API, non-root, files on the api-storage volume
                │     api     │
                └──────┬──────┘
                       │ backend network (internal: no internet, nothing published)
  ┌─────────┐   ┌──────▼──────┐
  │ migrate │──▶│  postgres   │   PostgreSQL 17, data on the postgres-data volume
  └─────────┘   └─────────────┘
  one-off: migrations + reference data, then exits
```

Prefer managed services instead? See [the managed-hosting guide](../architecture/deployment.md)
(Cloudflare Pages, Render, Neon and R2).

## What you need

- A Linux server with **2 vCPU and 2–4 GB of RAM** (building the images needs the memory; running
  needs far less) and about 10 GB of disk, plus room for your data and backups.
- [Docker Engine with the Compose plugin](https://docs.docker.com/engine/install/).
- A domain name (for example `automate.example.com`) with an **A/AAAA record pointing at the
  server**, and ports **80 and 443** open to the internet. Caddy needs both to obtain and renew the
  certificate.
- A firewall that allows only SSH, 80 and 443. PostgreSQL is never published; don't open 5432.

## Install

```bash
git clone https://github.com/Sainimayank1/AutoMate.git /opt/automate
cd /opt/automate
cp .env.example .env
```

Edit `.env` and set the three required values:

```bash
PUBLIC_URL=https://automate.example.com
POSTGRES_PASSWORD=<openssl rand -hex 32>
JWT_ACCESS_SECRET=<openssl rand -base64 48>
```

Use `openssl rand -hex 32` for the database password: it goes into a connection URL, so it must be
letters and digits only. Keep `.env` private (`chmod 600 .env`); it holds your secrets. The
optional settings in `.env.example` cover file storage in a bucket, maps and places providers, and
Web Push; every API setting is explained in
[environment variables](../development/environment-variables.md).

Then build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

What happens:

1. **postgres** starts and waits until it is healthy.
2. **migrate** applies the database migrations and the reference data (expense categories), then
   exits. It never adds demo data.
3. **api** starts once migrations succeed, as a non-root user, and reports healthy.
4. **web** (Caddy) starts, obtains the HTTPS certificate for your domain, and serves the app.

Open your `PUBLIC_URL` and create the first account.

## Check it

```bash
docker compose -f docker-compose.prod.yml ps                 # api and postgres "healthy"; migrate "exited (0)"
curl -fsS https://automate.example.com/api/v1/health         # {"success":true,...}
docker compose -f docker-compose.prod.yml logs -f api web    # follow the logs (Ctrl+C to stop)
docker compose -f docker-compose.prod.yml logs migrate       # migration output
```

Logs rotate automatically (three files of 10 MB per service).

## Try it on your own machine first

With the defaults (`PUBLIC_URL=http://localhost`), the same stack runs locally over plain HTTP at
<http://localhost>. If port 80 or 443 is already taken, publish other ports and tell Caddy to serve
any host name:

```bash
# .env
PUBLIC_URL=http://localhost:8080
HTTP_PORT=8080
HTTPS_PORT=8443
SITE_ADDRESS=:80
```

## Updating

Back up first (see [backup and restore](backup-and-restore.md)), then:

```bash
cd /opt/automate
git pull                                                     # or: git checkout <release tag>
docker compose -f docker-compose.prod.yml up -d --build
```

The migrate job applies any new migrations before the new API starts. Read the release notes (or
the commit history) for anything that needs attention before you update.

## Rolling back

Code rolls back by checking out the previous version and rebuilding:

```bash
git checkout <previous tag or commit>
docker compose -f docker-compose.prod.yml up -d --build
```

Database migrations only move forward. If the update you are undoing included migrations, restore
the backup you took before updating (see [backup and restore](backup-and-restore.md)); running older
code against a newer schema isn't supported.

## Backups

Run [`deploy/backup.sh`](../../deploy/backup.sh) every day from cron and copy the results off the
server. The full procedure, including restoring, is in [backup and restore](backup-and-restore.md).

## Stopping and removing

```bash
docker compose -f docker-compose.prod.yml down        # stop; volumes (your data) are kept
docker compose -f docker-compose.prod.yml down -v     # stop and DELETE all data, files and certificates
```

## Security notes

- Secrets live only in `.env` on the server. Never commit it.
- PostgreSQL sits on an internal network with no published ports and no internet access.
- The API runs as a non-root user with all Linux capabilities dropped; Caddy adds security headers
  and HTTPS (with automatic renewal).
- Swagger is off (`SWAGGER_ENABLED=false`). Sign-in is rate limited.
- The default geocoding, routing and map tile services are public OpenStreetMap services meant for
  light use. For real traffic, set your own providers in `.env`.
- Keep the server and Docker updated, and see [SECURITY.md](../../SECURITY.md) to report issues.
