#!/bin/bash

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Erreur: DATABASE_URL non définie." >&2
  exit 1
fi

echo "Application des migrations Prisma..."
npx prisma migrate deploy
echo "OK."
