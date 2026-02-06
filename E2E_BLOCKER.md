# E2E Test Blocker: next-auth/middleware Edge Runtime Incompatibility

## Issue
E2E tests cannot run because `next-auth/middleware` is incompatible with Next.js Edge Runtime.

## Error
```
EvalError: Code generation from strings disallowed for this context
at <unknown> (.next/server/middleware.js:1150)
```

## Root Cause
- `withAuth` from `next-auth/middleware` uses code that triggers eval() or new Function()
- Next.js Edge Runtime explicitly disallows dynamic code generation for security
- This is a fundamental incompatibility between next-auth v4 and Next.js 15 Edge Runtime

## Attempted Solutions
1. ✗ Simplified middleware to remove Pino logger - still fails
2. ✗ Removed rate limiting - still fails  
3. ✗ Set E2E environment variables - still fails
4. ✓ Temporarily removed middleware - tests can run but lose auth protection

## Workarounds Tested
1. **Remove middleware entirely** (current workaround)
   - Pros: Server runs, some tests pass (4/33)
   - Cons: No route protection, auth tests fail
   
2. **Use production build** (working for now)
   - Pros: Middleware compiled once at build time
   - Cons: Slower dev cycle, still has Edge Runtime issues in dev mode

## Test Results Without Middleware
- **4 passed** (navigation, public pages)
- **28 failed** (authentication required, protected routes)
- **1 skipped**

## Recommended Solution  
**Upgrade to next-auth v5 (Auth.js)**
- next-auth v5 has better Edge Runtime support
- Provides middleware that's Edge-compatible
- Migration required but solves the root issue

## Temporary E2E Test Strategy
1. Run production build: `npm run build`
2. Start production server: `npm start`  
3. Run E2E tests: `npm run test:e2e`
4. Note: Middleware works in production build but fails in dev mode

## Files Modified
- `middleware.ts` - Simplified but still incompatible
- `playwright.config.ts` - Disabled webServer (manual start required)

## Next Steps
1. Evaluate next-auth v5 migration effort
2. OR: Implement custom middleware without next-auth/middleware
3. OR: Run E2E tests only against production builds
