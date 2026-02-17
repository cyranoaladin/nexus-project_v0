#!/bin/bash
# =============================================================================
# Playwright Entrypoint — wait for app-e2e, then run tests
# =============================================================================

set -e

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

echo "[playwright] Running Playwright tests..."
npx playwright test --config playwright.config.e2e.ts

EXIT_CODE=$?
echo "[playwright] Tests finished with exit code: ${EXIT_CODE}"
exit $EXIT_CODE
