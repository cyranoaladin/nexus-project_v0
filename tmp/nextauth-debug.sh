#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-3010}

DEBUG=next-auth:* PORT=$PORT pnpm dev > /tmp/nextauth-dev.log 2>&1 &
SERVER_PID=$!
cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

sleep 5

BASE_URL="http://localhost:${PORT}"

curl -s -c /tmp/nextauth-cookies.txt "${BASE_URL}/api/auth/csrf" > /tmp/nextauth-csrf.json

CSRF_TOKEN=$(python - <<'PY'
import json
with open('/tmp/nextauth-csrf.json', 'r', encoding='utf-8') as fh:
    data = json.load(fh)
print(data['csrfToken'])
PY
)

curl -s -b /tmp/nextauth-cookies.txt -c /tmp/nextauth-cookies.txt \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=${CSRF_TOKEN}" \
  --data-urlencode "email=student@test.local" \
  --data-urlencode "password=password" \
  --data-urlencode "callbackUrl=${BASE_URL}/dashboard" \
  --data-urlencode "json=true" \
  --data-urlencode "redirect=false" \
  "${BASE_URL}/api/auth/callback/credentials" \
  > /tmp/nextauth-login.json

sleep 2