#!/usr/bin/env sh
set -e

# Ensure DATABASE_URL is present
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Applying Prisma migrations (deploy)..."
npx prisma migrate deploy

if [ "${PRISMA_SEED_ON_START:-0}" = "1" ]; then
  echo "Seeding database (PRISMA_SEED_ON_START=1)..."
  npx tsx prisma/seed.ts || true
fi

echo "Starting Next.js standalone server on port 3000"
exec node server.js
