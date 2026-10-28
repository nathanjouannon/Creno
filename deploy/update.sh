#!/usr/bin/env bash
# Production update (environments.md, section 4): backup, new images, migrations, restart, /health check.
#   deploy/update.sh <version>      e.g. `deploy/update.sh 0.2.0` for the tag v0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:?usage: deploy/update.sh <version>}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 0.2.0" >&2; exit 2; }
previous="$(sed -n 's/^CRENO_VERSION=//p' .env | tail -n 1)"

deploy/backup.sh pre-update

sed -i.bak "s/^CRENO_VERSION=.*/CRENO_VERSION=$version/" .env && rm -f .env.bak
docker compose pull
if ! docker compose up -d --wait; then
  echo "update to $version failed (previous version: ${previous:-unknown}); see 'Revenir en arrière' in README.md" >&2
  exit 1
fi

domain="$(sed -n 's/^DOMAIN=//p' .env | tail -n 1)"
curl -fsS "https://$domain/health" && echo
echo "updated ${previous:-?} -> $version"
