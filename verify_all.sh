#!/bin/bash
set -e

echo "🛑 Cleaning up old processes..."
pkill -f "server.js" || true
pkill -f "next-server" || true
pkill -f "playwright" || true

echo "🧹 Cleaning cache..."
rm -rf .next

echo "🏗️  Building application..."
npm run build

echo "🚀 Starting Production Server (Standalone) on Port 3001..."
cd .next/standalone
PORT=3001 nohup node server.js > ../../output.log 2>&1 &
SERVER_PID=$!
cd ../..
echo "Server PID: $SERVER_PID"

echo "⏳ Waiting for server to be ready..."
sleep 5
for i in {1..5}; do
    if curl -I -m 5 http://localhost:3001; then
        echo "✅ Server is UP!"
        READY=true
        break
    else
        echo "Server not ready yet, retrying..."
        sleep 5
    fi
done

if [ "$READY" != "true" ]; then
    echo "❌ Server failed to start. Logs:"
    cat output.log
    kill $SERVER_PID
    exit 1
fi

echo "🧪 Running Unit Tests (Jest)..."
CI=1 npm test

echo "🎭 Running E2E Tests (Playwright)..."
export PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001
export REUSE_EXISTING_SERVER=true
CI=1 npx playwright test --reporter=line

echo "🎉 All checks passed! Killing server..."
kill $SERVER_PID
