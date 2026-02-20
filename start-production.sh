#!/bin/bash
set -e

echo "🚀 Starting Nexus Réussite Production (PM2 Managed)..."

# 1. Database Migration (Critical for pgvector)
echo "📦 Applying database migrations..."
if [ -f "prisma/schema.prisma" ]; then
    echo "Running: npx prisma migrate deploy"
    npx prisma migrate deploy
else
    echo "⚠️  Warning: prisma/schema.prisma not found, skipping migration."
fi

# 2. Server Start with PM2
echo "🔄 Managing process..."
if [ -f "ecosystem.config.js" ]; then
    # Stop existing instance if running
    npx pm2 delete nexus-prod 2>/dev/null || true
    
    # Start new instance
    npx pm2 start ecosystem.config.js --env production
    
    echo "✅ Server started on port 3005."
    echo "📊 Monitor logs with: npx pm2 logs"
else
    echo "❌ Error: ecosystem.config.js not found."
    exit 1
fi
