#!/bin/bash

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Erreur: DATABASE_URL non définie" >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@example.com" >&2
  exit 1
fi

EMAIL="$1"
SQL="DELETE FROM \"users\" WHERE email='${EMAIL}';"

echo "Suppression RGPD pour ${EMAIL}..."
node -e "(async()=>{const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();await p.$executeRawUnsafe(\`${SQL}\`);await p.$disconnect();})().catch(e=>{console.error(e);process.exit(1)})"
echo "Terminé."
