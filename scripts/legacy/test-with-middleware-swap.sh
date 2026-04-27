#!/bin/bash
# Swap middleware for E2E tests to avoid Edge runtime eval() issues

# Backup original middleware
mv middleware.ts middleware.prod.ts 2>/dev/null || true

# Use E2E-compatible middleware  
cp middleware.e2e.ts middleware.ts

# Run tests
npx playwright test "$@"
TEST_EXIT=$?

# Restore original middleware
mv middleware.prod.ts middleware.ts

exit $TEST_EXIT
