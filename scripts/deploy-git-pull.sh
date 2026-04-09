#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="root@88.99.254.59"
REMOTE_DIR="/opt/nexus"
PM2_PROCESS="nexus-prod"

echo "🚀 Déploiement Nexus Réussite — $(date)"

ssh "$REMOTE_HOST" "set -e
  git config --global --add safe.directory $REMOTE_DIR
  cd $REMOTE_DIR
  echo 'Avant : \$(git rev-parse --short HEAD)'
  git checkout main
  git pull origin main
  echo 'Après : \$(git rev-parse --short HEAD)'
  npm ci
  npm run build
  pm2 restart $PM2_PROCESS
  sleep 3
  pm2 list
  echo '✅ Déploiement terminé'
"
