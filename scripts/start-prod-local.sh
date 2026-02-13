#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILES=(-f docker-compose.prod.yml -f docker-compose.prod.override.yml)

echo "[1/4] Building and starting prod-like stack..."
docker compose "${COMPOSE_FILES[@]}" up -d --build --force-recreate --remove-orphans

echo "[2/4] Waiting for DB..."
docker compose "${COMPOSE_FILES[@]}" exec -T postgres sh -lc "pg_isready -U ${POSTGRES_USER:-nexus_user} -d ${POSTGRES_DB:-nexus_reussite_prod}"

echo "[3/4] Verifying migration status..."
docker compose "${COMPOSE_FILES[@]}" ps migrate
docker compose "${COMPOSE_FILES[@]}" logs --tail=100 migrate

echo "[4/4] Verifying app health behind nginx..."
docker compose "${COMPOSE_FILES[@]}" exec -T nginx sh -lc "wget -qO- --no-check-certificate https://127.0.0.1/api/health"

echo "Local prod-like URL: https://localhost:9443"
