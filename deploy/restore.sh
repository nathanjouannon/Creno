#!/usr/bin/env bash
# Restores an encrypted backup (environments.md, section 5). Run from the repository directory, on the server.
#   deploy/restore.sh <backup.dump.age> <age-identity-file>
# Stops the application, replaces the content of the database with the backup, starts the application again.
# RESTORE_DB=<name> restores into another (empty or disposable) database and leaves the application running.
set -euo pipefail
cd "$(dirname "$0")/.."

backup="${1:?usage: deploy/restore.sh <backup.dump.age> <age-identity-file>}"
identity="${2:?usage: deploy/restore.sh <backup.dump.age> <age-identity-file>}"
[ -f "$backup" ] && [ -f "$identity" ] || { echo "backup or identity file not found" >&2; exit 2; }
command -v age >/dev/null || { echo "age is not installed (apt install age)" >&2; exit 2; }

target="${RESTORE_DB:-}"
if [ -z "$target" ]; then
  docker compose stop app
else
  docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" "$1"' _ "$target"
fi

# --clean drops the objects before recreating them; --no-owner keeps the restoring role as owner.
age -d -i "$identity" "$backup" \
  | docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}" --clean --if-exists --no-owner --exit-on-error' _ "$target"
echo "restored $backup into ${target:-the production database}"

if [ -z "$target" ]; then
  docker compose up -d
  echo "check: curl -fsS https://\$DOMAIN/health"
fi
