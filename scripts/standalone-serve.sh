#!/usr/bin/env bash
# Kill any existing process on 3002, build standalone, copy statics, serve.
set -euo pipefail
fuser -k 3002/tcp 2>/dev/null || true
sleep 2
npx next build
cp -r .next/static .next/standalone/.next/static
HOSTNAME=127.0.0.1 PORT=3002 node .next/standalone/server.js &
sleep 3
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/)
echo "Standalone on :3002 → HTTP $CODE"
[ "$CODE" = "200" ] || exit 1
