#!/bin/bash
# =============================================================================
# Playwright Entrypoint — wait for app-e2e, then run tests
# =============================================================================

set -e

APP_URL="${BASE_URL:-http://app-e2e:3000}"
PLAYWRIGHT_CONFIG="${PLAYWRIGHT_CONFIG:-playwright.config.e2e.ts}"
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

set +e
PLAYWRIGHT_ARGV=()
if [ -n "${PLAYWRIGHT_ARGS:-}" ]; then
  read -r -a PLAYWRIGHT_ARGV <<< "${PLAYWRIGHT_ARGS}"
  echo "[playwright] Running Playwright with custom args: ${PLAYWRIGHT_ARGS}"
else
  echo "[playwright] Running Playwright tests (default config)..."
fi

case "${PLAYWRIGHT_CONFIG}" in
  playwright.config.e2e.ts)
    if [ "${#PLAYWRIGHT_ARGV[@]}" -gt 0 ]; then
      npx playwright test --config playwright.config.e2e.ts "${PLAYWRIGHT_ARGV[@]}"
    else
      npx playwright test --config playwright.config.e2e.ts
    fi
    ;;
  playwright.auth.config.ts)
    if [ "${#PLAYWRIGHT_ARGV[@]}" -gt 0 ]; then
      npx playwright test --config playwright.auth.config.ts "${PLAYWRIGHT_ARGV[@]}"
    else
      npx playwright test --config playwright.auth.config.ts
    fi
    ;;
  *)
    echo "[playwright] ERROR: unsupported Playwright config: ${PLAYWRIGHT_CONFIG}"
    exit 64
    ;;
esac

EXIT_CODE=$?
echo "[playwright] Tests finished with exit code: ${EXIT_CODE}"
exit $EXIT_CODE
