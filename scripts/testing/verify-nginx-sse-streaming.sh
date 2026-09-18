#!/usr/bin/env bash
# =============================================================================
# verify-nginx-sse-streaming.sh
# =============================================================================
# Real, ephemeral proof that Nginx's `location = /api/aria/chat` block
# (nginx/nginx.conf) actually streams — not merely that the config file is
# syntactically valid. This repo has no automated `nginx -t` check at all
# today (verified: no CI step runs it), so an accidentally reintroduced
# `proxy_buffering on` — or any other regression to this exact block —
# would previously have shipped completely undetected. `nginx -t` alone
# would not have caught it either: that only proves the file parses, not
# that it streams.
#
# Extracts the EXACT current bytes of that location block, wraps it in a
# minimal http{} server pointing its upstream at a synthetic SSE fixture
# (scripts/testing/fixtures/sse-echo-server.mjs), runs real Nginx against
# it via Docker, and measures real chunk-arrival timing through the proxy.
#
# Requires: docker, node.
# Usage: bash scripts/testing/verify-nginx-sse-streaming.sh
# =============================================================================
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_DIR="$ROOT_DIR/scripts/testing/fixtures"
WORK_DIR="$(mktemp -d)"
CONTAINER_NAME="nexus-nginx-sse-verify-$$"
FIXTURE_PORT=4510
NGINX_PORT=18099
EVENT_COUNT=5
EVENT_INTERVAL_MS=250

FIXTURE_PID=""

cleanup() {
  local status=$?
  set +e
  if [[ -n "$FIXTURE_PID" ]]; then
    kill "$FIXTURE_PID" >/dev/null 2>&1
    wait "$FIXTURE_PID" 2>/dev/null
  fi
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  exit "$status"
}
trap cleanup EXIT INT TERM

# Same class of failure that took down main CI right after this job was
# added (PR #274): `docker run`'s own implicit image pull can hit a
# transient Docker Hub registry reset. Pull explicitly first, with
# retries, so `docker run` below always finds the image already cached.
pull_image_with_retry() {
  local image="$1"
  local attempt
  for attempt in 1 2 3; do
    if docker pull "$image" >/dev/null 2>&1; then
      return 0
    fi
    echo "docker pull ${image} failed (attempt ${attempt}/3)" >&2
    if [[ "$attempt" -lt 3 ]]; then
      sleep $((attempt * 5))
    fi
  done
  echo "docker pull ${image} failed after 3 attempts" >&2
  return 1
}
# One reference feeds both the retry-wrapped pull and docker run: pulling a
# mutable tag and running a digest makes the retry useless, because docker run
# falls back to its own implicit, unretried pull of a reference nothing warmed.
NGINX_SSE_IMAGE="nginx@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10" # 1.27-alpine
pull_image_with_retry "$NGINX_SSE_IMAGE"

echo "Extracting the current /api/aria/chat location block from nginx/nginx.conf..."
node "$FIXTURE_DIR/extract-nginx-location.mjs" "$ROOT_DIR/nginx/nginx.conf" 'location = /api/aria/chat {' \
  > "$WORK_DIR/location.conf"
echo "--- extracted block ---"
cat "$WORK_DIR/location.conf"
echo "-----------------------"

# The extracted block references the "api" limit_req zone declared
# elsewhere in the real file — pull its exact current declaration too,
# rather than hardcoding a rate here that could silently drift from it.
API_ZONE_DECLARATION="$(grep -m1 'limit_req_zone .*zone=api:' "$ROOT_DIR/nginx/nginx.conf")"

cat > "$WORK_DIR/nginx.conf" <<EOF
events { worker_connections 64; }
http {
    access_log off;
    ${API_ZONE_DECLARATION}
    upstream nexus_app { server 127.0.0.1:${FIXTURE_PORT}; }
    server {
        listen ${NGINX_PORT};
$(sed 's/^/        /' "$WORK_DIR/location.conf")
    }
}
EOF

echo "Starting the synthetic SSE fixture upstream on 127.0.0.1:${FIXTURE_PORT}..."
SSE_FIXTURE_PORT="$FIXTURE_PORT" node "$FIXTURE_DIR/sse-echo-server.mjs" &
FIXTURE_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${FIXTURE_PORT}/api/aria/chat" -o /dev/null --max-time 1 2>/dev/null; then break; fi
  sleep 0.2
done

echo "Starting real Nginx (Docker) with the extracted location block, --network host..."
docker run -d --rm --name "$CONTAINER_NAME" --network host \
  -v "$WORK_DIR/nginx.conf:/etc/nginx/nginx.conf:ro" \
  "$NGINX_SSE_IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${NGINX_PORT}/api/aria/chat" -o /dev/null --max-time 1 2>/dev/null; then break; fi
  sleep 0.2
done

echo "Measuring chunk arrival timing through Nginx..."
node "$FIXTURE_DIR/measure-sse-streaming.mjs" "$NGINX_PORT" "/api/aria/chat" "$EVENT_COUNT" "$EVENT_INTERVAL_MS"
