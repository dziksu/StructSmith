#!/bin/sh
set -e

DATA_DIR="$(dirname "${DATABASE_PATH:-/data/architecture.db}")"
mkdir -p "$DATA_DIR"

echo "[entrypoint] running migrations"
bun run scripts/migrate.ts

echo "[entrypoint] starting server"
exec "$@"
