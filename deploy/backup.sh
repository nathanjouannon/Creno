#!/usr/bin/env bash
# Encrypted database backup (environments.md, section 5). Run from the repository directory, daily by cron and by update.sh.
#   deploy/backup.sh [label]      e.g. `deploy/backup.sh pre-update`
# The dump is encrypted for the age public key in BACKUP_ENCRYPTION_KEY; the private key is never on the server.
# Retention: daily files for 7 days, plus the first backup of each month kept for 12 months.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
DAILY_DAYS=7
MONTHLY_KEEP=12
label="${1:-daily}"
[[ "$label" =~ ^[a-z0-9-]+$ ]] || { echo "label must match [a-z0-9-]+" >&2; exit 2; }
command -v age >/dev/null || { echo "age is not installed (apt install age)" >&2; exit 2; }

# Read only the one variable: .env is not a shell script and its values must not be echoed.
key="${BACKUP_ENCRYPTION_KEY:-$(sed -n 's/^BACKUP_ENCRYPTION_KEY=//p' .env | tail -n 1)}"
[[ "$key" == age1* ]] || { echo "BACKUP_ENCRYPTION_KEY must be an age public key (age1...)" >&2; exit 2; }

mkdir -p "$BACKUP_DIR/monthly"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/creno-$stamp-$label.dump.age"

# Written under a temporary name so an interrupted run never leaves a file that looks complete.
umask 077
trap 'rm -f "$file.part"' EXIT
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  | age -r "$key" > "$file.part"
[ -s "$file.part" ] || { echo "backup is empty" >&2; exit 1; }
mv "$file.part" "$file"
echo "backup written: $file ($(wc -c < "$file") bytes)"

# First daily backup of a month is also kept as the monthly one.
month="${stamp:0:6}"
ls "$BACKUP_DIR/monthly"/creno-"$month"* >/dev/null 2>&1 || cp "$file" "$BACKUP_DIR/monthly/"

find "$BACKUP_DIR" -maxdepth 1 -name 'creno-*.dump.age' -mtime +$((DAILY_DAYS - 1)) -delete
find "$BACKUP_DIR/monthly" -name 'creno-*.dump.age' -mtime +$((MONTHLY_KEEP * 31)) -delete
echo "disk: $(df -h "$BACKUP_DIR" | awk 'NR==2 {print $5 " used, " $4 " free"}')"
