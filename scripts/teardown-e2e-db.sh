#!/bin/bash
# =============================================================================
# Teardown E2E Database
# =============================================================================
# Stops and removes E2E PostgreSQL container and all associated volumes
# Usage: npm run test:e2e:teardown
# =============================================================================

set -e  # Exit on error

echo "🧹 Tearing down E2E database..."

# Stop and remove containers, networks, and volumes
docker-compose -f docker-compose.e2e.yml down -v

echo "✅ E2E database cleanup complete!"
echo ""
echo "💡 To setup again, run: npm run test:e2e:setup"
