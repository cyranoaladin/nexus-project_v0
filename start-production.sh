#!/usr/bin/env sh
set -e

# Ensure DATABASE_URL is present
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx tsx prisma/seed.ts || true

echo "Starting Next.js standalone server on port 3000"
exec node server.js
