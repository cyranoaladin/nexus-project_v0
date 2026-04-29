#!/bin/bash
set -e

# Security check: ensure no private keys are tracked in the repository
# This script fails if:
# - Files matching privkey.pem, *.key are tracked
# - Files containing "BEGIN .*PRIVATE KEY" are tracked (except in docs/)

echo "🔒 Checking for private keys in repository..."

# Check 1: Track private key filenames
if git ls-files | grep -E "(privkey\.pem|\.key$)" > /dev/null 2>&1; then
  echo "❌ FAIL: Private key files found in git:"
  git ls-files | grep -E "(privkey\.pem|\.key$)"
  exit 1
fi

# Check 2: Track private key content (except in docs/ and this script)
if git grep -n "BEGIN .*PRIVATE KEY" -- . ':!docs/**' ':!scripts/security/check-no-private-keys.sh' > /dev/null 2>&1; then
  echo "❌ FAIL: Private key content found in files:"
  git grep -n "BEGIN .*PRIVATE KEY" -- . ':!docs/**' ':!scripts/security/check-no-private-keys.sh'
  exit 1
fi

# Check 3: nginx/ssl should only contain .gitkeep
SSL_FILES=$(git ls-files nginx/ssl/ 2>/dev/null || echo "")
if [ -n "$SSL_FILES" ]; then
  # Allow only .gitkeep, reject everything else
  SSL_NON_GITKEEP=$(echo "$SSL_FILES" | grep -v "^nginx/ssl/\.gitkeep$" || true)
  if [ -n "$SSL_NON_GITKEEP" ]; then
    echo "❌ FAIL: Unexpected files in nginx/ssl/:"
    echo "$SSL_NON_GITKEEP"
    echo "Expected: only nginx/ssl/.gitkeep or nothing"
    exit 1
  fi
fi

echo "✅ PASS: No private keys tracked in repository"
echo "✅ nginx/ssl/ is clean (only .gitkeep or empty)"
echo "✅ No private key content in code"
