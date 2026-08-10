#!/usr/bin/env bash

set -euo pipefail

COMPOSE=(docker compose -f docker-compose.e2e.yml)

cleanup() {
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

npm run check:e2e-syntax
"${COMPOSE[@]}" up --build --abort-on-container-exit --exit-code-from playwright
