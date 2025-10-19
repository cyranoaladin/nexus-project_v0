#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/deploy/prod-deploy.sh nexus-app-v0.2.2.tar
# Requires: docker, docker compose, .env (prod) present in repo root

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

IMAGE_TAR=${1:-}
if [[ -z "$IMAGE_TAR" ]]; then
  echo "Usage: $0 <image-tar>" >&2
  exit 1
fi

if [[ ! -f "$IMAGE_TAR" ]]; then
  echo "Image tar not found: $IMAGE_TAR" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env file in repo root. Copy .env.production.example to .env and fill secrets." >&2
  exit 1
fi

source .env

echo "[1/5] Loading image: $IMAGE_TAR"
docker load -i "$IMAGE_TAR"

echo "[2/5] Starting Postgres (compose prod)"
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres

# Wait for Postgres
echo "Waiting for Postgres to be healthy..."
TRIES=60
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-nexus_user}" >/dev/null 2>&1; do
  ((TRIES--)) || { echo "Postgres did not become ready" >&2; exit 1; }
  sleep 2
  echo -n "."
done
echo " OK"

echo "[3/5] Starting app + nginx"
docker compose -f docker-compose.prod.yml --env-file .env up -d nexus-app nginx

# Migrate
echo "[4/5] Applying Prisma migrations"
docker compose -f docker-compose.prod.yml exec -T nexus-app npx prisma migrate deploy

# Health check
APP_URL=${NEXTAUTH_URL:-"http://localhost:3000"}
echo "[5/5] Health check: $APP_URL/api/health"
set +e
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "$APP_URL/api/health")
set -e
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Health check failed with HTTP $HTTP_CODE" >&2
  exit 1
fi

echo "Deployment successful. App healthy at $APP_URL"