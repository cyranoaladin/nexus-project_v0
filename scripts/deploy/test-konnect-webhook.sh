#!/usr/bin/env bash
set -euo pipefail

# Test Konnect webhook with HMAC signature
# Usage:
#   BASE_URL=https://nexusreussite.academy \
#   KONNECT_WEBHOOK_SECRET={{KONNECT_WEBHOOK_SECRET}} \
#   bash scripts/deploy/test-konnect-webhook.sh '{"payment_id":"p1","status":"completed"}'
#
# Notes:
# - No secrets printed; uses env vars.
# - Prints HTTP status and response.

BODY=${1:-}
if [[ -z "${BASE_URL:-}" || -z "${KONNECT_WEBHOOK_SECRET:-}" ]]; then
  echo "Missing BASE_URL or KONNECT_WEBHOOK_SECRET" >&2
  exit 1
fi
if [[ -z "$BODY" ]]; then
  echo "Provide JSON body as first arg" >&2
  exit 1
fi

SIG=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$KONNECT_WEBHOOK_SECRET" -r | awk '{print $1}')

HTTP_CODE=$(curl -sk -o /tmp/konnect_webhook_resp.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/webhooks/konnect" \
  -H 'content-type: application/json' \
  -H "x-konnect-signature: $SIG" \
  --data "$BODY")

echo "HTTP $HTTP_CODE"
cat /tmp/konnect_webhook_resp.json
echo