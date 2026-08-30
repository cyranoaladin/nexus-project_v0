#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/e2e-runtime-secrets.sh"

project="${1:-}"
case "$project" in
  aria-desktop|aria-mobile|aria-a11y) ;;
  *)
    echo "Usage: $0 aria-desktop|aria-mobile|aria-a11y" >&2
    exit 2
    ;;
esac

compose=(docker compose -f docker-compose.e2e.yml)
artifact_dir=".artifacts/aria/playwright/${project}"
if [ -e "$artifact_dir" ] && [ ! -d "$artifact_dir" ]; then
  echo "ARIA_E2E_ARTIFACT_PATH_INVALID=${artifact_dir}" >&2
  exit 2
fi
if [ -d "$artifact_dir" ]; then
  find "$artifact_dir" -mindepth 1 -delete
fi
mkdir -p "$artifact_dir"

cleanup_on_signal() {
  set +e
  "${compose[@]}" down -v --remove-orphans
  signal_cleanup_status=$?
  if [ "$signal_cleanup_status" -ne 0 ]; then
    echo "ARIA_E2E_TEARDOWN_FAILED=${signal_cleanup_status}" >&2
  fi
  exit 130
}
trap cleanup_on_signal INT TERM

export PLAYWRIGHT_CONFIG=playwright.aria.config.ts
export PLAYWRIGHT_PROJECT="$project"
prepare_aria_e2e_runtime_secrets

set +e
"${compose[@]}" up --build --abort-on-container-exit --exit-code-from playwright
test_status=$?
docker compose -f docker-compose.e2e.yml cp \
  "playwright:/app/.artifacts/aria/playwright/${project}/." "$artifact_dir/"
artifact_status=$?
"${compose[@]}" down -v --remove-orphans
teardown_status=$?
set -e
trap - INT TERM

if [ "$test_status" -ne 0 ]; then
  exit "$test_status"
fi
if [ "$artifact_status" -ne 0 ]; then
  echo "ARIA_E2E_ARTIFACT_COPY_FAILED=${artifact_status}" >&2
  exit "$artifact_status"
fi
if [ "$teardown_status" -ne 0 ]; then
  echo "ARIA_E2E_TEARDOWN_FAILED=${teardown_status}" >&2
  exit "$teardown_status"
fi
