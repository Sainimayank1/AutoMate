#!/bin/sh
# Backs up the AutoMate production stack (docker-compose.prod.yml): the database as a custom-format
# pg_dump and the uploaded files as a tarball, with a timestamp, then deletes backups older than
# BACKUP_KEEP_DAYS. Run it from anywhere; cron example (daily at 02:30):
#   30 2 * * * /opt/automate/deploy/backup.sh >> /var/log/automate-backup.log 2>&1
# Backups contain personal data: keep them private, encrypted, and copied off this server.
set -eu

cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -f docker-compose.prod.yml ${COMPOSE_ENV_FILE:+--env-file $COMPOSE_ENV_FILE}"

mkdir -p "$DEST"
umask 077

$COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$DEST/db-$STAMP.dump"
# Uploaded files (local storage). With a bucket, back the bucket up with your provider's tools.
$COMPOSE exec -T api tar -C /data -czf - storage > "$DEST/files-$STAMP.tar.gz"

find "$DEST" -name 'db-*.dump' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'files-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "Backed up to $DEST: db-$STAMP.dump, files-$STAMP.tar.gz"
