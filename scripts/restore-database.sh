#!/usr/bin/env bash
# AegisGraph — restore a database backup (DESTRUCTIVE: replaces current data).
# Requires explicit typed confirmation unless --force is provided.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

command -v docker >/dev/null 2>&1 || fail "Docker CLI was not found. Install Docker Desktop first."
[ -f "$ENV_FILE" ] || fail "Environment file not found at '$ENV_FILE'. Copy .env.example to .env first."

BACKUP_PATH="${1:-}"
FORCE="${2:-}"
[ -n "$BACKUP_PATH" ] || { echo "Usage: $0 <backup-file> [--force]"; exit 1; }
[ -f "$BACKUP_PATH" ] || fail "Backup file not found: '$BACKUP_PATH'"
BACKUP_PATH="$(readlink -f "$BACKUP_PATH")"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${POSTGRES_DB:?POSTGRES_DB missing in .env}"
: "${POSTGRES_USER:?POSTGRES_USER missing in .env}"
[[ "$POSTGRES_DB" =~ ^[A-Za-z0-9_]+$ ]] || fail "POSTGRES_DB must be a simple identifier."
[[ "$POSTGRES_USER" =~ ^[A-Za-z0-9_]+$ ]] || fail "POSTGRES_USER must be a simple identifier."

if [ "$FORCE" != "--force" ]; then
    echo
    echo "WARNING: this DESTROYS the current database '$POSTGRES_DB' and replaces it"
    echo "with '$(basename "$BACKUP_PATH")'."
    read -r -p "Type RESTORE to confirm: " ANSWER
    [ "$ANSWER" = "RESTORE" ] || { echo "Restore cancelled. No changes were made."; exit 0; }
fi

echo "Dropping and recreating database '$POSTGRES_DB'..."
docker compose --project-directory "$REPO_ROOT" exec -T db \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" \
    -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";" >/dev/null

echo "Restoring from backup..."
docker compose --project-directory "$REPO_ROOT" exec -T db \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --quiet \
    < "$BACKUP_PATH" >/dev/null

echo
echo "SUCCESS: database '$POSTGRES_DB' restored from $BACKUP_PATH"
