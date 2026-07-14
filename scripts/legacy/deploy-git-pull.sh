#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="root@88.99.254.59"
REMOTE_DIR="/opt/nexus"

echo "🚀 Déploiement Nexus Réussite — $(date)"

ssh "$REMOTE_HOST" "set -e
  git config --global --add safe.directory $REMOTE_DIR
  cd $REMOTE_DIR
  echo 'Avant : \$(git rev-parse --short HEAD)'
  git checkout main
  git stash --include-untracked || true
  git pull origin main
  git stash pop || true
  echo 'Après : \$(git rev-parse --short HEAD)'
  npm ci
  npx prisma migrate deploy
  npx prisma generate
  NODE_OPTIONS='--max-old-space-size=8192' npm run build
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  chown -R nexus:nexus .next
  systemctl restart nexus-app
  sleep 3
  systemctl is-active nexus-app
  echo '✅ Déploiement terminé'
"
