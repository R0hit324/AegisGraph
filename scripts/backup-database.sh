#!/usr/bin/env bash
# AegisGraph — create a timestamped PostgreSQL backup.
# Credentials come from .env and are never echoed. Runs pg_dump inside the
# database container over the local socket (no password on the host).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
OUTPUT_DIR="${1:-$REPO_ROOT/backups}"

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

command -v docker >/dev/null 2>&1 || fail "Docker CLI was not found. Install Docker Desktop first."
[ -f "$ENV_FILE" ] || fail "Environment file not found at '$ENV_FILE'. Copy .env.example to .env first."

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${POSTGRES_DB:?POSTGRES_DB missing in .env}"
: "${POSTGRES_USER:?POSTGRES_USER missing in .env}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_PATH="$OUTPUT_DIR/aegisgraph_backup_${TIMESTAMP}.dump"

echo "Creating backup of database '$POSTGRES_DB'..."
docker compose --project-directory "$REPO_ROOT" exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=plain \
    > "$BACKUP_PATH"

# Sanity check: PostgreSQL plain-format dumps start with an SQL comment header.
if [ "$(head -c 4 "$BACKUP_PATH")" != "-- " ]; then
    rm -f "$BACKUP_PATH"
    fail "Backup file header invalid; removed partial dump."
fi

SIZE_KB=$(( $(stat -c%s "$BACKUP_PATH" 2>/dev/null || stat -f%z "$BACKUP_PATH") / 1024 ))
echo
echo "SUCCESS: backup created -> $BACKUP_PATH (${SIZE_KB} KB)"
