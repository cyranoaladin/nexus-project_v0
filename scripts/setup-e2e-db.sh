#!/bin/bash
# =============================================================================
# Setup E2E Database
# =============================================================================
# Creates ephemeral PostgreSQL container, runs migrations, and seeds test data
# Usage: npm run test:e2e:setup
# =============================================================================

set -e  # Exit on error

echo "🚀 Setting up E2E database..."

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Stop and remove existing E2E container if it exists
echo "🧹 Cleaning up existing E2E container..."
docker-compose -f docker-compose.e2e.yml down -v 2>/dev/null || true

# Start PostgreSQL container
echo "🐘 Starting PostgreSQL E2E container..."
docker-compose -f docker-compose.e2e.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for database to be ready..."
RETRIES=30
COUNT=0

until docker-compose -f docker-compose.e2e.yml exec -T postgres-e2e pg_isready -U postgres -d nexus_e2e > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $RETRIES ]; then
    echo "❌ Database failed to start after $RETRIES attempts"
    docker-compose -f docker-compose.e2e.yml logs postgres-e2e
    exit 1
  fi
  echo "  Attempt $COUNT/$RETRIES..."
  sleep 1
done

echo "✅ Database is ready!"

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/nexus_e2e?schema=public" \
  npx prisma db push --accept-data-loss

# Generate Prisma client
echo "🔧 Generating Prisma client..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/nexus_e2e?schema=public" \
  npx prisma generate

# Seed test data
echo "🌱 Seeding E2E test data..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/nexus_e2e?schema=public" \
  npx tsx scripts/seed-e2e-db.ts

echo "✅ E2E database setup complete!"
echo ""
echo "📊 Database Info:"
echo "  Host: localhost"
echo "  Port: 5435"
echo "  Database: nexus_e2e"
echo "  User: postgres"
echo "  Password: postgres"
echo ""
echo "🧪 You can now run E2E tests with: npm run test:e2e"
echo "🧹 Cleanup with: npm run test:e2e:teardown"
