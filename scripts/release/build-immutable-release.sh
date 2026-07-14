#!/usr/bin/env bash
set -euo pipefail

# build-immutable-release.sh — Canonical release builder for PM2 deployments.
#
# Creates a verified, immutable release artifact from a given SHA.
# Does NOT deploy or switch the symlink — that is a separate step.
#
# Usage:
#   ./scripts/release/build-immutable-release.sh <SHA> [releases_dir]
#
# Example:
#   ./scripts/release/build-immutable-release.sh a1192c8dc /var/www/nexus-releases
#
# Requirements:
#   - git, node, npm available
#   - Run as nexusapp (not root)
#   - RELEASE_SHA set or passed as $1

SHA="${1:?Usage: $0 <SHA> [releases_dir]}"
RELEASES_DIR="${2:-/var/www/nexus-releases}"
RELEASE_DIR="${RELEASES_DIR}/${SHA}"

if [ -d "$RELEASE_DIR" ]; then
  echo "❌ Release directory already exists: $RELEASE_DIR"
  exit 1
fi

echo "Building release for SHA: $SHA"
echo "Target: $RELEASE_DIR"

# 1. Clone
git clone --depth 1 --branch main "https://github.com/cyranoaladin/nexus-project_v0.git" "${RELEASE_DIR}.tmp"
cd "${RELEASE_DIR}.tmp"

ACTUAL_SHA=$(git rev-parse HEAD)
if [ "$ACTUAL_SHA" != "$SHA" ]; then
  echo "❌ SHA mismatch: expected $SHA, got $ACTUAL_SHA"
  rm -rf "${RELEASE_DIR}.tmp"
  exit 1
fi

# 2. Install + build + verify + smoke
npm ci --ignore-scripts
npx prisma generate
RELEASE_SHA="$SHA" npm run release:build

# 3. Verify manifest
if [ ! -f release-manifest.json ]; then
  echo "❌ release-manifest.json not generated — build gate failed"
  rm -rf "${RELEASE_DIR}.tmp"
  exit 1
fi

MANIFEST_SHA=$(node -e "console.log(require('./release-manifest.json').RELEASE_SHA)")
MANIFEST_VERIFIED=$(node -e "console.log(require('./release-manifest.json').ARTIFACT_VERIFIED)")

if [ "$MANIFEST_SHA" != "$SHA" ]; then
  echo "❌ Manifest RELEASE_SHA mismatch: $MANIFEST_SHA != $SHA"
  rm -rf "${RELEASE_DIR}.tmp"
  exit 1
fi

if [ "$MANIFEST_VERIFIED" != "true" ]; then
  echo "❌ ARTIFACT_VERIFIED is not true"
  rm -rf "${RELEASE_DIR}.tmp"
  exit 1
fi

# 4. Finalize
cd /
mv "${RELEASE_DIR}.tmp" "$RELEASE_DIR"

echo ""
echo "✅ Release built and verified: $RELEASE_DIR"
echo "   SHA: $SHA"
echo "   Manifest: ARTIFACT_VERIFIED=true"
echo ""
echo "To deploy:"
echo "  ln -snf $RELEASE_DIR /var/www/nexus-project_v0"
echo "  pm2 reload nexus-prod"
