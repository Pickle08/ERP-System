#!/usr/bin/env bash
# Restore dari file backup. DESTRUKTIF: database di .env dihapus lalu dibuat ulang.
# Pemakaian: bash scripts/restore.sh backups/erp_distributor_2026-11-18_101500.sql
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Pemakaian: bash scripts/restore.sh <file-backup.sql>"
  exit 1
fi

set -a
source <(grep -E '^DB_(HOST|PORT|DATABASE|USERNAME|PASSWORD)=' .env | tr -d '\r')
set +a

MYSQL_BIN="${MYSQL_BIN:-mysql}"
CONN=(-h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "${DB_USERNAME:-root}")

echo "PERINGATAN: database '$DB_DATABASE' akan DIHAPUS lalu diisi ulang dari $1"
read -r -p "Ketik 'ya' untuk lanjut: " confirm
[ "$confirm" = "ya" ] || { echo "Dibatalkan."; exit 1; }

export MYSQL_PWD="${DB_PASSWORD:-}"
"$MYSQL_BIN" "${CONN[@]}" -e "DROP DATABASE IF EXISTS \`$DB_DATABASE\`; CREATE DATABASE \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
"$MYSQL_BIN" "${CONN[@]}" "$DB_DATABASE" < "$1"

echo "Restore selesai. Menjalankan cek integritas..."
php artisan erp:check-integrity
