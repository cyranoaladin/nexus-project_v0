#!/bin/bash
# =============================================================================
# Teardown E2E Database
# =============================================================================
# Stops and removes E2E PostgreSQL container and all associated volumes
# Usage: npm run test:e2e:teardown
# =============================================================================

set -e  # Exit on error

echo "🧹 Tearing down E2E database..."

if docker compose version > /dev/null 2>&1; then
  COMPOSE=(docker compose)
elif docker-compose version > /dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "❌ Docker Compose is not available."
  exit 1
fi

# Stop and remove containers, networks, and volumes
"${COMPOSE[@]}" -f docker-compose.e2e.yml down -v

echo "✅ E2E database cleanup complete!"
echo ""
echo "💡 To setup again, run: npm run test:e2e:setup"
