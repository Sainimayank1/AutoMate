# Backup and restore

For a self-hosted AutoMate ([self-hosting](self-hosting.md)), two things hold your data:

| What           | Where                                | Backed up as                    |
| -------------- | ------------------------------------ | ------------------------------- |
| Database       | `postgres-data` volume               | `db-<timestamp>.dump` (pg_dump) |
| Uploaded files | `api-storage` volume (local storage) | `files-<timestamp>.tar.gz`      |

If you store files in a bucket (`STORAGE_PROVIDER=r2` or `s3`), back the bucket up with your
provider's tools instead. Caddy's certificates (`caddy-data`) are renewed automatically and don't
need backing up.

Users can also export their own data at any time from **Backup & Export** in the app (a ZIP of their
records and files that restores into any account).

## Back up

[`deploy/backup.sh`](../../deploy/backup.sh) writes both files to `./backups` (owner-only
permissions) and deletes backups older than 14 days:

```bash
cd /opt/automate
deploy/backup.sh
```

| Variable           | Default     | Meaning                                                   |
| ------------------ | ----------- | --------------------------------------------------------- |
| `BACKUP_DIR`       | `./backups` | Where to write the backups                                |
| `BACKUP_KEEP_DAYS` | `14`        | Delete backups older than this                            |
| `COMPOSE_ENV_FILE` |             | An env file other than `.env`, passed to `docker compose` |

Run it daily from cron:

```cron
30 2 * * * /opt/automate/deploy/backup.sh >> /var/log/automate-backup.log 2>&1
```

**Copy backups off the server** (another machine or encrypted object storage): a backup on the
same disk doesn't survive losing the server. Backups contain personal data, so keep them private
and encrypted, and test a restore now and then.

## Restore

Restoring replaces the current data. Take a fresh backup first if there is anything worth keeping.

```bash
cd /opt/automate
dc() { docker compose -f docker-compose.prod.yml "$@"; }   # works in bash and zsh

# 1. Stop the API so nothing writes while you restore (the database keeps running).
dc stop api web

# 2. Database: replace its contents with the dump.
dc exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/db-YYYYMMDD-HHMMSS.dump

# 3. Files: replace the storage folder with the archive.
dc run --rm --no-deps -T --entrypoint sh api -c \
  'rm -rf /data/storage/* && tar -C /data -xzf -' \
  < backups/files-YYYYMMDD-HHMMSS.tar.gz

# 4. Start again (migrations re-run and are a no-op if the schema matches).
dc up -d
```

Restore into the same AutoMate version that made the backup, or a newer one: the migrate job brings
an older dump's schema up to date. Restoring a dump made by a newer version into older code isn't
supported.

## Checking a backup without touching your data

Restore the dump into a scratch database next to the live one, look at it, then drop it:
(`dc` is the shell function defined in the restore steps above.)

```bash
dc exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" restore_check'
dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d restore_check --no-owner' < backups/db-YYYYMMDD-HHMMSS.dump
dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d restore_check -c "select count(*) from users"'
dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" restore_check'
```
