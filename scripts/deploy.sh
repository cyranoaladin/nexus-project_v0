#!/bin/bash
# =============================================================================
# DEPLOYMENT SCRIPT — NEXUS RÉUSSITE
# =============================================================================

set -e

echo "🚀 Starting Nexus Réussite deployment..."

# 1. Environment Check
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create it from .env.production.example first."
    exit 1
fi

# 2. Update code (optional if running manually)
# echo "📥 Pulling latest changes..."
# git pull origin main

# 3. Build and Start Services
echo "🏗️ Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# 4. Database Migrations
echo "📦 Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm migrate

# 5. Health Check
echo "🔍 Verifying health..."
sleep 5
STATUS=$(docker compose -f docker-compose.prod.yml ps nexus-app --format "{{.Status}}")

if [[ $STATUS == *"Up"* ]]; then
    echo "✅ Deployment successful! App is $STATUS"
else
    echo "⚠️ Warning: App status is $STATUS. Checking logs..."
    docker compose -f docker-compose.prod.yml logs --tail=20 nexus-app
fi

echo "📊 Monitor logs with: docker compose -f docker-compose.prod.yml logs -f"
