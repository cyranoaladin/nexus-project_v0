#!/bin/bash

# SAFE PRODUCTION DEPLOYMENT SCRIPT
# This script performs a safe, controlled deployment to production.
# It never calls `docker compose down` or `--volumes`.
#
# SAFEGUARDS:
# - Refuses to run if repo is dirty
# - Shows current commit
# - Requires CONFIRM_PRODUCTION_DEPLOY=yes
# - Checks for recent DB backup
# - Uses --ff-only for git pull
# - Builds only nexus-app container
# - Restarts only nexus-app (no postgres restart)
# - Performs healthcheck
# - Shows rollback instructions
#
# Usage:
#   CONFIRM_PRODUCTION_DEPLOY=yes ./scripts/deploy-production-safe.sh

set -e  # Exit on error

# Configuration
SERVER="root@88.99.254.59"
DOMAIN="nexusreussite.academy"
PROJECT_DIR="/opt/nexus"
COMPOSE_FILE="docker-compose.prod.yml"

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

# SAFEGUARD 1: Require explicit confirmation
if [ "$CONFIRM_PRODUCTION_DEPLOY" != "yes" ]; then
  print_error "Deployment aborted: CONFIRM_PRODUCTION_DEPLOY not set to 'yes'"
  echo ""
  echo "To deploy to production, run:"
  echo "  CONFIRM_PRODUCTION_DEPLOY=yes ./scripts/deploy-production-safe.sh"
  echo ""
  echo "To dry-run (check logic without deploying), run:"
  echo "  DRY_RUN=yes CONFIRM_PRODUCTION_DEPLOY=yes ./scripts/deploy-production-safe.sh"
  exit 1
fi

# Check for dry-run mode
DRY_RUN_MODE=${DRY_RUN:-no}
if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN MODE: No actual deployment will be performed"
  print_warning "Only logic checks will be executed"
  echo ""
fi

echo "🚀 SAFE DEPLOYMENT to ${DOMAIN}..."
echo "📦 Server: ${SERVER}"
echo ""

# SAFEGUARD 2: Check if repo is dirty
echo "🔍 Checking repository state..."
if [ -n "$(git status --porcelain)" ]; then
  print_error "Repository is dirty. Commit or stash changes before deploying."
  git status --short
  exit 1
fi
print_success "Repository is clean"

# SAFEGUARD 3: Show current commit
echo ""
echo "📋 Current commit:"
git log -1 --oneline
echo ""

# SAFEGUARD 4: Check for recent DB backup on server (enforces 24h cutoff)
echo ""
echo "🔍 Checking for recent DB backup on server (last 24h)..."
BACKUP_EXISTS=$(ssh ${SERVER} -o LogLevel=ERROR << 'EOF'
cd ${PROJECT_DIR}
if [ -d "backups" ]; then
  LATEST_BACKUP=$(ls -t backups/nexus_db_*.sql.gz 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_AGE=$(find backups/nexus_db_*.sql.gz -mmin -1440 2>/dev/null | wc -l)
    echo "LATEST_BACKUP:$LATEST_BACKUP,AGE:$BACKUP_AGE"
  else
    echo "NO_BACKUP"
  fi
else
  echo "NO_BACKUP_DIR"
fi
EOF
)

if [[ $BACKUP_EXISTS == *"NO_BACKUP"* ]]; then
  print_error "No recent DB backup found (last 24h). Deployment aborted."
  echo "To deploy without recent backup, take a backup first or use ALLOW_STALE_BACKUP=yes"
  exit 1
elif [[ $BACKUP_EXISTS == *"AGE:"* ]] && [[ $BACKUP_EXISTS != *"AGE:0"* ]]; then
  print_success "Recent DB backup found (within last 24h)"
else
  print_error "No DB backup within last 24h. Deployment aborted."
  echo "To deploy without recent backup, take a backup first or use ALLOW_STALE_BACKUP=yes"
  exit 1
fi

# Step 1: SSH into server and pull latest changes (ff-only)
echo ""
echo "📥 Step 1: Pulling latest changes from git (ff-only)..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping git pull"
  print_success "Git pull would be executed (ff-only)"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
# ─── BACKUP SSL CERTIFICATES ─────────────────────────────────────────────────────
echo "🔒 Checking SSL certificates..."
SSL_DIR="nginx/ssl"
if [ -d "$SSL_DIR" ]; then
  if [ -f "$SSL_DIR/fullchain.pem" ] || [ -f "$SSL_DIR/privkey.pem" ]; then
    BACKUP_DIR="backups/ssl-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    echo "📦 Backing up SSL certificates to $BACKUP_DIR..."
    if ! cp -r "$SSL_DIR" "$BACKUP_DIR/"; then
      echo "❌ ERROR: SSL backup failed. Aborting deploy."
      exit 1
    fi
    echo "✅ SSL certificates backed up"
  else
    echo "⚠️  No SSL certificates found in $SSL_DIR (this is expected after P0 changes)"
  fi
else
  echo "⚠️  SSL directory $SSL_DIR does not exist"
fi
git fetch origin main
git checkout main
if ! git pull --ff-only origin main; then
  echo "ERROR: git pull --ff-only failed. Manual merge required."
  exit 1
fi
EOF
  print_success "Git pull completed (ff-only)"
fi

# Step 2: Build nexus-app container only
echo ""
echo "🔨 Step 2: Building nexus-app container only..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping build"
  print_success "Build would execute (nexus-app only, no postgres restart)"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} build nexus-app
EOF
  print_success "nexus-app container built"
fi

# Step 3: Restart nexus-app only (no down, no volumes)
echo ""
echo "🔄 Step 3: Restarting nexus-app (no postgres restart)..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping restart"
  print_success "Restart would execute (up -d --no-deps nexus-app, no down, no volumes)"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} up -d --no-deps nexus-app
EOF
  print_success "nexus-app restarted"
fi

# Step 4: Wait for nexus-app to be healthy
echo ""
echo "⏳ Step 4: Waiting for nexus-app to be healthy..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping health check wait"
  print_success "Health check would execute (120s timeout)"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
timeout 120 bash -c 'until docker compose -f ${COMPOSE_FILE} ps nexus-app | grep -q healthy; do sleep 2; done'
EOF
  print_success "nexus-app is healthy"
fi

# Step 5: Verify deployment
echo ""
echo "🔍 Step 5: Verifying deployment..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping verification"
  print_success "Docker ps would be shown"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} ps
EOF
fi

# Step 6: Health check
echo ""
echo "🏥 Step 6: Health check..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping health check"
  print_success "Health check would execute (curl /api/health)"
else
  HEALTH_CHECK=$(ssh ${SERVER} "curl -s http://localhost:3001/api/health" || echo "failed")
  if [[ $HEALTH_CHECK == *"ok"* ]]; then
    print_success "Health check passed"
  else
    print_error "Health check failed: $HEALTH_CHECK"
    echo ""
    echo "ROLLBACK INSTRUCTIONS:"
    echo "  ssh ${SERVER}"
    echo "  cd ${PROJECT_DIR}"
    echo "  git log --oneline -3"
    echo "  git checkout PREVIOUS_COMMIT_HASH"
    echo "  docker compose -f ${COMPOSE_FILE} build nexus-app"
    echo "  docker compose -f ${COMPOSE_FILE} up -d --no-deps nexus-app"
    exit 1
  fi
fi

# Step 7: Show recent logs
echo ""
echo "📋 Step 7: Recent application logs (last 20 lines)..."

if [ "$DRY_RUN_MODE" = "yes" ]; then
  print_warning "DRY-RUN: Skipping logs"
  print_success "Logs would be shown (last 20 lines)"
else
  ssh ${SERVER} << EOF
cd ${PROJECT_DIR}
docker compose -f ${COMPOSE_FILE} logs --tail=20 nexus-app
EOF
fi

echo ""
print_success "SAFE DEPLOYMENT completed successfully!"
echo "🌐 Application is available at: https://${DOMAIN}"
echo ""
echo "ROLLBACK INSTRUCTIONS (if needed):"
echo "  ssh ${SERVER}"
echo "  cd ${PROJECT_DIR}"
echo "  git log --oneline -3"
echo "  git checkout PREVIOUS_COMMIT_HASH"
echo "  docker compose -f ${COMPOSE_FILE} build nexus-app"
echo "  docker compose -f ${COMPOSE_FILE} up -d --no-deps nexus-app"
