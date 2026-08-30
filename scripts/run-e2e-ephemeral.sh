#!/usr/bin/env bash

set -euo pipefail

source scripts/aria/e2e-runtime-secrets.sh
prepare_aria_e2e_runtime_secrets

COMPOSE=(docker compose -f docker-compose.e2e.yml)

cleanup() {
  set +e
  "${COMPOSE[@]}" down -v --remove-orphans
  cleanup_status=$?
  set -e
  if [ "$cleanup_status" -ne 0 ]; then
    echo "E2E_TEARDOWN_FAILED=${cleanup_status}" >&2
    exit "$cleanup_status"
  fi
}

trap cleanup EXIT INT TERM

npm run check:e2e-syntax
"${COMPOSE[@]}" up --build --abort-on-container-exit --exit-code-from playwright
