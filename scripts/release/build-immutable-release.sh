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

CANONICAL_RELEASES_ROOT="/var/www/nexus-releases"

# ── Input validation ──

SHA="${1:-}"
RELEASES_DIR="${2:-$CANONICAL_RELEASES_ROOT}"

if [[ -z "$SHA" ]]; then
  echo "❌ Usage: $0 <SHA> [releases_dir]" >&2
  exit 1
fi

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "❌ Invalid SHA (must be 40 lowercase hex chars)" >&2
  exit 1
fi

# ── User check: must be exactly nexusapp ──

CURRENT_USER=$(id -un)
if [[ "$CURRENT_USER" != "nexusapp" ]]; then
  echo "❌ Must run as nexusapp (current: $CURRENT_USER)" >&2
  exit 1
fi

# ── Releases dir validation ──

if [[ ! "$RELEASES_DIR" = /* ]]; then
  echo "❌ RELEASES_DIR must be absolute" >&2
  exit 1
fi

# Refuse dangerous roots
case "$RELEASES_DIR" in
  /|/var|/var/www|/tmp|/root|/etc|/home)
    echo "❌ RELEASES_DIR too broad: $RELEASES_DIR" >&2
    exit 1
    ;;
esac

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "❌ RELEASES_DIR does not exist: $RELEASES_DIR" >&2
  exit 1
fi

# Resolve with realpath and verify containment under canonical root
RESOLVED_DIR=$(realpath "$RELEASES_DIR" 2>/dev/null) || {
  echo "❌ Cannot resolve RELEASES_DIR" >&2; exit 1
}
RESOLVED_CANONICAL=$(realpath "$CANONICAL_RELEASES_ROOT" 2>/dev/null) || {
  echo "❌ Cannot resolve canonical root" >&2; exit 1
}

# Containment: resolved dir must be exactly the canonical root or a child
# Use trailing slash to prevent prefix attacks (e.g. /var/www/nexus-releases-evil)
if [[ "$RESOLVED_DIR" != "$RESOLVED_CANONICAL" ]] && \
   [[ "$RESOLVED_DIR" != "$RESOLVED_CANONICAL/"* ]]; then
  echo "❌ RELEASES_DIR outside canonical root" >&2
  exit 1
fi

RELEASE_DIR="${RELEASES_DIR}/${SHA}"

# ── Collision check: reject any existing target (dir, file, symlink, broken symlink) ──

if [[ -e "$RELEASE_DIR" || -L "$RELEASE_DIR" ]]; then
  echo "❌ Target already exists: $RELEASE_DIR" >&2
  exit 1
fi

# ── Temporary directory with cleanup trap ──

TMP_DIR=$(mktemp -d "${RELEASES_DIR}/.build-${SHA:0:12}-XXXXXX")

cleanup() {
  if [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT INT TERM HUP

echo "Building release for SHA: $SHA"

# ── Clone exact SHA ──

git init "$TMP_DIR" --quiet
git -C "$TMP_DIR" remote add origin "https://github.com/cyranoaladin/nexus-project_v0.git"
git -C "$TMP_DIR" fetch --depth=1 origin "$SHA" 2>&1 | tail -2
git -C "$TMP_DIR" checkout --detach FETCH_HEAD --quiet

ACTUAL_SHA=$(git -C "$TMP_DIR" rev-parse HEAD)
if [[ "$ACTUAL_SHA" != "$SHA" ]]; then
  echo "❌ SHA mismatch after checkout: expected $SHA, got $ACTUAL_SHA" >&2
  exit 1
fi

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

# ── Final collision check before move ──

if [[ -e "$RELEASE_DIR" || -L "$RELEASE_DIR" ]]; then
  echo "❌ Target appeared during build (race): $RELEASE_DIR" >&2
  exit 1
fi

# ── Atomic finalize ──

mv "$TMP_DIR" "$RELEASE_DIR"
TMP_DIR=""  # disarm trap

echo ""
echo "RELEASE_BUILD_COMPLETE=true"
echo "RELEASE_DEPLOYED=false"
echo "RELEASE_DIR=$RELEASE_DIR"
echo "RELEASE_SHA=$SHA"
echo "ARTIFACT_VERIFIED=true"
