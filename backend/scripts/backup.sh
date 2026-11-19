#!/usr/bin/env bash
# Backup database ke backups/<db>_<waktu>.sql
# Pemakaian (dari folder backend):  bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source <(grep -E '^DB_(HOST|PORT|DATABASE|USERNAME|PASSWORD)=' .env | tr -d '\r')
set +a

MYSQLDUMP="${MYSQLDUMP:-mysqldump}"
mkdir -p backups
FILE="backups/${DB_DATABASE}_$(date +%Y-%m-%d_%H%M%S).sql"

MYSQL_PWD="${DB_PASSWORD:-}" "$MYSQLDUMP" \
  -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USERNAME:-root}" \
  --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  "$DB_DATABASE" > "$FILE"

echo "Backup tersimpan: $FILE ($(du -h "$FILE" | cut -f1))"
