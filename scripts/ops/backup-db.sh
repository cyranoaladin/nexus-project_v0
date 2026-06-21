#!/bin/bash
set -euo pipefail
umask 077

# === Config ===
SB_USER="u554481-sub1"
SB_HOST="${SB_USER}.your-storagebox.de"
SB_KEY="/root/.ssh/storagebox_korrigo"
SB_DIR="backups/nexus-prod"
CONTAINER="nexus-postgres-db"
DB_NAME="nexus_prod"
DB_USER="nexus_admin"
DATE=$(date +%Y%m%d_%H%M%S)
HOUR=$(date +%H)
DOW=$(date +%u)
LOG="/var/log/nexus-backup-db.log"
TMP="/tmp/nexus_bk_$$"
START=$(date +%s)

log() { echo "$(date +%H:%M:%S) $1"; }
SB_SSH() { ssh -i "$SB_KEY" -p 23 -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=20 "$SB_USER@$SB_HOST" "$@"; }
SB_SCP() { scp -P 23 -i "$SB_KEY" -o StrictHostKeyChecking=no -o BatchMode=yes "$@"; }

log "=== DEBUT $DATE (${HOUR}h) ==="

# Pre-flight: container running?
docker inspect "$CONTAINER" --format {{.State.Status}} 2>/dev/null | grep -q running || {
  log "CRITIQUE: conteneur $CONTAINER non running"; exit 1
}

# Pre-flight: StorageBox accessible?
SB_SSH "ls" >/dev/null 2>&1 || { log "CRITIQUE: StorageBox inaccessible"; exit 1; }
SB_SSH "mkdir -p $SB_DIR/hourly $SB_DIR/daily $SB_DIR/weekly" 2>/dev/null || true

mkdir -p "$TMP"

# === pg_dump via docker exec ===
DUMP="nexus_prod_$DATE.dump"
log "Dump PostgreSQL ($DB_NAME)..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=9 --no-privileges --no-owner --file="/tmp/$DUMP" 2>>"$LOG"
docker cp "$CONTAINER:/tmp/$DUMP" "$TMP/$DUMP"
docker exec "$CONTAINER" rm "/tmp/$DUMP"

DUMP_SIZE=$(stat -c%s "$TMP/$DUMP" 2>/dev/null || echo 0)
[ "$DUMP_SIZE" -lt 1000 ] && { log "ERR: dump trop petit ($DUMP_SIZE bytes)"; rm -rf "$TMP"; exit 1; }
log "Dump OK: $(numfmt --to=iec "$DUMP_SIZE")"

# === Upload to StorageBox ===
SB_SCP "$TMP/$DUMP" "$SB_USER@$SB_HOST:$SB_DIR/hourly/" 2>>"$LOG" && log "Upload OK" || {
  log "ERR: upload echoue"; rm -rf "$TMP"; exit 1
}

# === Config backup (env + nginx) ===
CF="nexus_config_$DATE.tar.gz"
tar -czf "$TMP/$CF" \
  /var/www/nexus-project_v0/.env \
  /var/www/nexus-project_v0/ecosystem.config.js \
  /etc/nginx/sites-enabled/nexusreussite.academy \
  2>/dev/null || true
SB_SCP "$TMP/$CF" "$SB_USER@$SB_HOST:$SB_DIR/hourly/" 2>>"$LOG" && log "Config OK" || true

# === Promote daily (midnight) ===
if [ "$HOUR" = "00" ]; then
  SB_SSH "cp $SB_DIR/hourly/$DUMP $SB_DIR/daily/ && cp $SB_DIR/hourly/$CF $SB_DIR/daily/" 2>/dev/null && log "Promu daily" || true
fi

# === Promote weekly (Sunday midnight) ===
if [ "$DOW" = "7" ] && [ "$HOUR" = "00" ]; then
  SB_SSH "cp $SB_DIR/hourly/$DUMP $SB_DIR/weekly/ && cp $SB_DIR/hourly/$CF $SB_DIR/weekly/" 2>/dev/null && log "Promu weekly" || true
fi

# === Cleanup: 25 hourly, 8 daily, 5 weekly ===
for DM in "hourly:25" "daily:8" "weekly:5"; do
  D="${DM%%:*}"; M="${DM##*:}"
  for P in "nexus_prod_*.dump" "nexus_config_*.tar.gz"; do
    SB_SSH "ls -t $SB_DIR/$D/$P 2>/dev/null | tail -n +$M | xargs rm -f" 2>/dev/null || true
  done
done

# === Cleanup temp ===
rm -rf "$TMP"

# === Report ===
HC=$(SB_SSH "ls -1 $SB_DIR/hourly/nexus_prod_*.dump 2>/dev/null | wc -l" 2>/dev/null || echo "?")
DC=$(SB_SSH "ls -1 $SB_DIR/daily/nexus_prod_*.dump 2>/dev/null | wc -l" 2>/dev/null || echo "?")
WC=$(SB_SSH "ls -1 $SB_DIR/weekly/nexus_prod_*.dump 2>/dev/null | wc -l" 2>/dev/null || echo "?")
log "Backups: h=$HC/24 d=$DC/7 w=$WC/4 — ${HOUR}h — $(($(date +%s)-START))s"
log "=== FIN ==="
