#!/usr/bin/env bash
set -euo pipefail

# Base URL
BASE_URL="${BASE_URL:-${E2E_BASE_URL:-http://localhost:3001}}"

# Extract DEV_TOKEN robustly from .env.e2e if not provided in env
if [[ -z "${DEV_TOKEN:-}" ]]; then
  if [[ -f .env.e2e ]]; then
    raw_line=$(grep -m1 '^DEV_TOKEN=' .env.e2e || true)
    if [[ -n "$raw_line" ]]; then
      DEV_TOKEN=$(echo "$raw_line" | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs)
    fi
  fi
fi

if [[ -z "${DEV_TOKEN:-}" ]]; then
  echo "ERREUR: DEV_TOKEN introuvable (env ou .env.e2e)." >&2
  exit 1
fi

echo "Debug: DEV_TOKEN extrait (hash) = $(echo -n "$DEV_TOKEN" | sha256sum | awk '{print $1}')"

# Healthcheck
for i in $(seq 1 40); do
  if curl -sf "$BASE_URL/api/aria/health" >/dev/null; then
    break
  fi
  sleep 1
done

hdr1="/tmp/h1_$$"; hdr2="/tmp/h2_$$"; b1="/tmp/b1_$$.pdf"; b2="/tmp/b2_$$.pdf"
trap 'rm -f "$hdr1" "$hdr2" "$b1" "$b2"' EXIT

# Fetch PDFs on single lines
curl -s -D "$hdr1" -H "Authorization: Bearer $DEV_TOKEN" \
  "$BASE_URL/api/bilan/pdf?niveau=premiere&variant=general" -o "$b1"

curl -s -D "$hdr2" -H "Authorization: Bearer $DEV_TOKEN" \
  "$BASE_URL/api/bilan/pdf?niveau=premiere&variant=general&force=1" -o "$b2"

sz1=$(stat -c '%s' "$b1" 2>/dev/null || echo 0)
sz2=$(stat -c '%s' "$b2" 2>/dev/null || echo 0)
ct1=$(awk 'BEGIN{IGNORECASE=1} /^Content-Type/ {print $2}' "$hdr1" | tr -d '\r')
ct2=$(awk 'BEGIN{IGNORECASE=1} /^Content-Type/ {print $2}' "$hdr2" | tr -d '\r')

echo "PDF1_size=$sz1"
echo "PDF2_size=$sz2"
echo "CT1=$ct1"
echo "CT2=$ct2"
