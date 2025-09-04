#!/usr/bin/env bash
set -euo pipefail

# Simple backup script for Postgres (pg_dump) and MinIO data volume
# Usage: ./scripts/backup.sh [backup_dir]

BACKUP_DIR=${1:-"./backups"}
TS=$(date +%Y%m%d_%H%M%S)
OUT_DIR="$BACKUP_DIR/$TS"
mkdir -p "$OUT_DIR"

echo "[Backup] Dumping Postgres..."
docker exec nexus_db_prod pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nexus_dev}" > "$OUT_DIR/db.sql"

echo "[Backup] Archiving MinIO data (container: nexus_minio_prod:/data)..."
docker cp nexus_minio_prod:/data "$OUT_DIR/minio_data" >/dev/null 2>&1 || true
tar -czf "$OUT_DIR/minio_data.tar.gz" -C "$OUT_DIR" minio_data >/dev/null 2>&1 || true
rm -rf "$OUT_DIR/minio_data" || true

echo "[Backup] Done => $OUT_DIR"

