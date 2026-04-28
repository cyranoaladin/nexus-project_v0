#!/bin/bash

# Automated Deployment Script for Nexus Réussite Production
# Deploys to nexusreussite.academy via SSH

set -e  # Exit on error

# Configuration
SERVER="root@88.99.254.59"
DOMAIN="nexusreussite.academy"
PROJECT_DIR="/opt/nexus"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Starting deployment to ${DOMAIN}..."
echo "📦 Server: ${SERVER}"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Step 1: SSH into server and pull latest changes
echo "📥 Step 1: Pulling latest changes from git..."
ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
git fetch origin main
git checkout main
git pull origin main
EOF
print_success "Git pull completed"

# Step 2: Build and restart Docker containers
echo ""
echo "🔨 Step 2: Building and restarting Docker containers..."
ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
# Stop and remove all containers with volumes cleanup
docker compose -f ${COMPOSE_FILE} down --volumes --remove-orphans
# Force remove any remaining nexus containers
docker ps -aq --filter "name=nexus" | xargs -r docker rm -f
# Build and start
docker compose -f ${COMPOSE_FILE} up -d --build
EOF
print_success "Docker containers rebuilt and restarted"

# Step 3: Wait for containers to be healthy
echo ""
echo "⏳ Step 3: Waiting for containers to be healthy..."
ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
# Wait for postgres to be healthy
echo "Waiting for postgres..."
timeout 60 bash -c 'until docker compose -f ${COMPOSE_FILE} ps postgres | grep -q healthy; do sleep 2; done'

# Wait for nexus-app to be healthy (migrations run automatically before app starts)
echo "Waiting for nexus-app (migrations run automatically)..."
timeout 120 bash -c 'until docker compose -f ${COMPOSE_FILE} ps nexus-app | grep -q healthy; do sleep 2; done'
EOF
print_success "All containers are healthy (migrations completed automatically)"

# Step 4: Verify deployment
echo ""
echo "🔍 Step 5: Verifying deployment..."
ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} ps
EOF

# Step 6: Health check
echo ""
echo "🏥 Step 6: Health check..."
HEALTH_CHECK=$(ssh ${SERVER} "curl -s http://localhost/api/health" || echo "failed")
if [[ $HEALTH_CHECK == *"ok"* ]]; then
    print_success "Health check passed"
else
    print_error "Health check failed: $HEALTH_CHECK"
    exit 1
fi

# Step 7: Show recent logs
echo ""
echo "📋 Step 7: Recent application logs (last 20 lines)..."
ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} logs --tail=20 nexus-app
EOF

echo ""
print_success "Deployment completed successfully!"
echo "🌐 Application is available at: https://${DOMAIN}"
