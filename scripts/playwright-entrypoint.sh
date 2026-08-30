#!/bin/bash
# =============================================================================
# Playwright Entrypoint — wait for app-e2e, then run tests
# =============================================================================

set -euo pipefail

APP_URL="${BASE_URL:-http://app-e2e:3000}"
MAX_WAIT=120

echo "[playwright] Waiting for app at ${APP_URL} (max ${MAX_WAIT}s)..."

for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "${APP_URL}" > /dev/null 2>&1; then
    echo "[playwright] App is ready after ${i}s."
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    echo "[playwright] ERROR: App not ready after ${MAX_WAIT}s. Aborting."
    exit 1
  fi
  sleep 1
done

# Consume credentials directly from the private shared volume. Never copy the
# manifest into the bind-mounted source tree, where a root-owned residue could
# leak into audits or survive teardown.
if [ -f "${E2E_CREDENTIALS_PATH:-}" ]; then
  echo "[playwright] Credentials manifest verified in shared volume."
else
  echo "[playwright] ERROR: credentials manifest is missing from the shared volume."
  exit 1
fi

PLAYWRIGHT_CONFIG="${PLAYWRIGHT_CONFIG:-playwright.config.e2e.ts}"
case "$PLAYWRIGHT_CONFIG" in
  playwright.config.e2e.ts|playwright.aria.config.ts) ;;
  *)
    echo "[playwright] ERROR: unsupported config: ${PLAYWRIGHT_CONFIG}"
    exit 2
    ;;
esac

PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-}"
case "$PLAYWRIGHT_PROJECT" in
  ""|aria-desktop|aria-mobile|aria-a11y) ;;
  *)
    echo "[playwright] ERROR: unsupported project: ${PLAYWRIGHT_PROJECT}"
    exit 2
    ;;
esac

args=(test --config "$PLAYWRIGHT_CONFIG")
if [ -n "$PLAYWRIGHT_PROJECT" ]; then
  args+=(--project "$PLAYWRIGHT_PROJECT")
fi
echo "[playwright] Running allowlisted config ${PLAYWRIGHT_CONFIG} project ${PLAYWRIGHT_PROJECT:-all}."
exec npx playwright "${args[@]}"
