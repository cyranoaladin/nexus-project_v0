#!/usr/bin/env bash
set -euo pipefail
umask 077

# build-immutable-release.sh — Canonical release builder for PM2 deployments.
#
# Creates a verified, immutable release artifact from an exact SHA.
# Does NOT deploy, switch symlinks, or reload PM2.
#
# Usage:
#   ./scripts/release/build-immutable-release.sh <SHA> [releases_dir]

# ── Input validation ──

SHA="${1:-}"
RELEASES_DIR="${2:-/var/www/nexus-releases}"

if [[ -z "$SHA" ]]; then
  echo "❌ Usage: $0 <SHA> [releases_dir]" >&2
  exit 1
fi

# SHA must be exactly 40 hex chars
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "❌ Invalid SHA (must be 40 hex chars): ${SHA:0:10}..." >&2
  exit 1
fi

# Releases dir must be absolute
if [[ ! "$RELEASES_DIR" = /* ]]; then
  echo "❌ RELEASES_DIR must be absolute" >&2
  exit 1
fi

# Refuse dangerous roots
case "$RELEASES_DIR" in
  /|/var|/var/www|/tmp|/root)
    echo "❌ RELEASES_DIR too broad: $RELEASES_DIR" >&2
    exit 1
    ;;
esac

# Refuse root
if [[ "$(id -un)" = "root" ]]; then
  echo "❌ Refusing to build as root. Run as nexusapp." >&2
  exit 1
fi

RELEASE_DIR="${RELEASES_DIR}/${SHA}"

if [[ -d "$RELEASE_DIR" ]]; then
  echo "❌ Release already exists: $RELEASE_DIR" >&2
  exit 1
fi

# ── Temporary directory with cleanup trap ──

TMP_DIR=$(mktemp -d "${RELEASES_DIR}/.build-${SHA:0:12}-XXXXXX")

cleanup() {
  if [[ -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
    echo "🧹 Cleaned up temp dir"
  fi
}
trap cleanup EXIT INT TERM HUP

echo "Building release for SHA: $SHA"
echo "Temp: $TMP_DIR"

# ── Clone exact SHA (not just branch head) ──

git init "$TMP_DIR" --quiet
git -C "$TMP_DIR" remote add origin "https://github.com/cyranoaladin/nexus-project_v0.git"
git -C "$TMP_DIR" fetch --depth=1 origin "$SHA" 2>&1 | tail -2
git -C "$TMP_DIR" checkout --detach FETCH_HEAD --quiet

ACTUAL_SHA=$(git -C "$TMP_DIR" rev-parse HEAD)
if [[ "$ACTUAL_SHA" != "$SHA" ]]; then
  echo "❌ SHA mismatch after checkout: expected $SHA, got $ACTUAL_SHA" >&2
  exit 1
fi
echo "✅ Checked out exact SHA: $SHA"

# ── Build ──

cd "$TMP_DIR"
npm ci --ignore-scripts 2>&1 | tail -3
npx prisma generate 2>&1 | tail -1
RELEASE_SHA="$SHA" npm run release:build

# ── Verify manifest ──

if [[ ! -f release-manifest.json ]]; then
  echo "❌ release-manifest.json not generated" >&2
  exit 1
fi

MANIFEST_SHA=$(node -e "console.log(require('./release-manifest.json').RELEASE_SHA)")
MANIFEST_VERIFIED=$(node -e "console.log(require('./release-manifest.json').ARTIFACT_VERIFIED)")

if [[ "$MANIFEST_SHA" != "$SHA" ]]; then
  echo "❌ Manifest SHA mismatch: $MANIFEST_SHA != $SHA" >&2
  exit 1
fi

if [[ "$MANIFEST_VERIFIED" != "true" ]]; then
  echo "❌ ARTIFACT_VERIFIED != true" >&2
  exit 1
fi

# ── Verify target doesn't exist (race check) ──

if [[ -d "$RELEASE_DIR" ]]; then
  echo "❌ Release appeared during build (race): $RELEASE_DIR" >&2
  exit 1
fi

# ── Atomic finalize ──

mv "$TMP_DIR" "$RELEASE_DIR"
# Disarm the trap — TMP_DIR no longer exists
TMP_DIR=""

echo ""
echo "RELEASE_BUILD_COMPLETE=true"
echo "RELEASE_DEPLOYED=false"
echo "RELEASE_DIR=$RELEASE_DIR"
echo "RELEASE_SHA=$SHA"
echo "ARTIFACT_VERIFIED=true"
