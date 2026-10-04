#!/usr/bin/env bash

set -euo pipefail
umask 077

source "$(dirname "$0")/e2e-runtime-secrets.sh"

project="${1:-}"
case "$project" in
  aria-desktop|aria-mobile|aria-a11y|aria-smoke) ;;
  *)
    echo "Usage: $0 aria-desktop|aria-mobile|aria-a11y|aria-smoke" >&2
    exit 2
    ;;
esac

run_head="$(git rev-parse HEAD)"
compose_project="nexus-aria-${project}-${run_head:0:12}-$$"
compose=(docker compose -p "$compose_project" -f docker-compose.e2e.yml)
artifact_dir=".artifacts/aria/playwright/${project}"
if [ -L "$artifact_dir" ] || { [ -e "$artifact_dir" ] && [ ! -d "$artifact_dir" ]; }; then
  echo "ARIA_E2E_ARTIFACT_PATH_INVALID=${artifact_dir}" >&2
  exit 2
fi
if [ -e "$artifact_dir" ]; then
  echo "ARIA_E2E_EXISTING_EVIDENCE_REFUSED" >&2
  exit 2
fi
private_parent=".artifacts/aria/private/${project}"
private_artifact_dir="${private_parent}/${run_head}.$$"
mkdir -p "$private_parent"
mkdir "$private_artifact_dir"
printf '%s\n' "$run_head" > "$private_artifact_dir/head.sha"

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
"${compose[@]}" cp \
  "playwright:/app/.artifacts/aria/playwright/${project}/." "$private_artifact_dir/"
artifact_status=$?
"${compose[@]}" down -v --remove-orphans
teardown_status=$?
current_head="$(git rev-parse HEAD)"
current_head_status=$?
source_status=0
if [ "$current_head_status" -ne 0 ] || [ "$current_head" != "$run_head" ]; then
  echo "ARIA_E2E_SOURCE_HEAD_CHANGED=${run_head}:${current_head:-UNAVAILABLE}" >&2
  source_status=2
fi
set -e
trap - INT TERM

if [ "$artifact_status" -ne 0 ]; then
  echo "ARIA_E2E_ARTIFACT_COPY_FAILED=${artifact_status}" >&2
  exit "$artifact_status"
fi
if [ "$teardown_status" -ne 0 ]; then
  echo "ARIA_E2E_TEARDOWN_FAILED=${teardown_status}" >&2
  exit "$teardown_status"
fi
if [ "$source_status" -ne 0 ]; then
  exit "$source_status"
fi
node scripts/testing/safe-playwright-report.mjs \
  "$private_artifact_dir/report.json" "$artifact_dir/report.json" "$run_head"
if [ "$test_status" -ne 0 ]; then
  exit "$test_status"
fi
if [ "$project" = "aria-mobile" ]; then
  npm run aria:visual-evidence:write
fi
