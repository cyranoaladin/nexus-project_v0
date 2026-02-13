#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${LOCAL_DOMAIN:-nexus.local}"
HTTPS_PORT="${LOCAL_HTTPS_PORT:-18443}"
COMPOSE_FILES=(
  -f docker-compose.prod.yml
  -f docker-compose.prod.override.yml
  -f docker-compose.prod.local-domain.override.yml
)

if ! grep -Eq "(^|[[:space:]])${DOMAIN}([[:space:]]|$)" /etc/hosts; then
  echo "Add this entry first (requires sudo):"
  echo "127.0.0.1 ${DOMAIN}"
  exit 1
fi

if command -v mkcert >/dev/null 2>&1; then
  echo "[0/4] Generating trusted local certificate for ${DOMAIN}..."
  mkcert -cert-file nginx/ssl/fullchain.pem -key-file nginx/ssl/privkey.pem "${DOMAIN}" localhost 127.0.0.1 ::1 >/dev/null
else
  echo "[0/4] mkcert not found. Using existing certificate in nginx/ssl/"
fi

echo "[1/4] Building and starting prod-like stack (local domain)..."
docker compose "${COMPOSE_FILES[@]}" up -d --build --force-recreate --remove-orphans

echo "[2/4] Waiting for DB..."
docker compose "${COMPOSE_FILES[@]}" exec -T postgres sh -lc "pg_isready -U ${POSTGRES_USER:-nexus_user} -d ${POSTGRES_DB:-nexus_reussite_prod}"

echo "[3/4] Verifying migration status..."
docker compose "${COMPOSE_FILES[@]}" logs --tail=100 migrate

echo "[4/4] Verifying app health behind nginx on ${DOMAIN}..."
docker compose "${COMPOSE_FILES[@]}" exec -T nginx sh -lc "wget -qO- --no-check-certificate --header='Host: ${DOMAIN}' https://127.0.0.1/api/health"

echo "Local prod-like URL: https://${DOMAIN}:${HTTPS_PORT}"
