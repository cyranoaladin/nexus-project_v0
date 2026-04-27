#!/bin/bash
set -e

echo "🛑 Arrêt des conteneurs DB conflictuels..."
# Force stop & remove of any container using port 5435 or named nexus-postgres-db
docker ps -q --filter "name=nexus-postgres-db" | xargs -r docker stop
docker ps -a -q --filter "name=nexus-postgres-db" | xargs -r docker rm

# Also clean up the weirdly named one found in logs if it exists
docker ps -q --filter "name=30b18b0d9094" | xargs -r docker stop
docker ps -a -q --filter "name=30b18b0d9094" | xargs -r docker rm

echo "🚀 Démarrage de la nouvelle infrastructure PGVector..."
# Force recreation to ensure image update
docker compose up -d --force-recreate postgres-db

echo "⏳ Attente de la disponibilité de la base de données..."
# Wait loop for DB ready
until docker compose exec postgres-db pg_isready -U nexus_user -d nexus_reussite_prod; do
  echo "En attente de Postgres..."
  sleep 2
done

echo "📦 Application des migrations (PGVector + Protection Paiements)..."
npx prisma migrate deploy

echo "✅ Infrastructure Base de Données réparée et à jour !"
