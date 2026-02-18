# PR: fix(rag-client): guarantee timeout cleanup via finally

## Summary

Ensures `clearTimeout(timeoutId)` is **always** called in `ragSearch()` and `ragHealthCheck()`, regardless of execution path. Previously, if `fetch()` threw before the inline `clearTimeout`, the timer leaked (kept ticking until it fired `controller.abort()` on a dead request).

**Fix**: hoist `controller`/`timeoutId` above `try`, move `clearTimeout` into `finally`.

**Scope**: 1 source file + 1 new test file. Zero scope creep.

Historically observed failures in UI suites appear unrelated to this change. This PR adds targeted tests for `lib/rag-client.ts` only and does not touch UI/theme suites. Full audit suite remains green per `docs/QA_REPORT.md`.

---

## Files changed

| File | Change |
|---|---|
| `lib/rag-client.ts` | `ragSearch()`: hoist AbortController + setTimeout above try, clearTimeout moved to finally. `ragHealthCheck()`: same pattern (remove duplicate clearTimeout from try/catch, single finally). |
| `__tests__/lib/rag-client.test.ts` | **New** — 8 tests: 6 for ragSearch (success, HTTP error, network error, AbortError, json() throw, graceful degradation) + 2 for ragHealthCheck (healthy, network failure). All assert `clearTimeout` is called. |

---

## How to verify

```bash
# 1. Build (0 TS errors expected)
npx next build

# 2. Run PR-scoped tests (8/8 expected)
npx jest --config jest.config.js --no-coverage __tests__/lib/rag-client.test.ts

# 3. Run full audit suite (391+ expected, 28 suites)
npx jest --config jest.config.js --no-coverage \
  __tests__/components/ui/ \
  __tests__/lib/aria.test.ts \
  __tests__/lib/rag-client.test.ts \
  tests/ui/theme.test.ts \
  __tests__/lib/theme.tokens.test.ts

# 4. E2E roles (requires running dev server + seeded DB)
node scripts/e2e-smoke-roles.mjs http://localhost:3000
```

---

## Evidence

Full evidence with build logs, test output, E2E role verification, and smoke page status:
→ **[docs/QA_REPORT.md](./QA_REPORT.md)**

PR-scoped test output:

```
 PASS  __tests__/lib/rag-client.test.ts
  ragSearch
    ✓ clears timeout on successful response
    ✓ clears timeout on HTTP error (non-ok response)
    ✓ clears timeout on network error (fetch throws)
    ✓ clears timeout on AbortError (timeout triggered)
    ✓ clears timeout when response.json() throws
    ✓ returns empty array gracefully (never throws)
  ragHealthCheck
    ✓ clears timeout on healthy response
    ✓ clears timeout on network failure

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

---

## No prompt/document leakage statement

Verified by code review of `lib/rag-client.ts` error paths:

- **`ragSearch()` catch**: logs only `"RAG search failed: {status} {statusText}"` or `"RAG search timeout after {timeout}ms"` or `"RAG search error: {error}"` (Error object, not query/document content)
- **`ragHealthCheck()` catch**: silent (`return false`), no logging
- **`buildRAGContext()`**: pure function, no logging

**No `options.query`, `hit.document`, or context string is ever logged.**

---

## Standalone assets impact

**None.** This PR does not modify:
- `Dockerfile`
- `scripts/copy-public-assets.js`
- `package.json` build script
- Any file under `public/` or `.next/`

---

## Brand Pack impact

**None.** This PR does not modify:
- `lib/theme/tokens.ts`
- `app/globals.css`
- `tailwind.config.mjs`
- Any component under `components/ui/`

---

## P2 backlog (noted, not in scope)

| Item | Ref |
|---|---|
| `buildRAGContext()` cap (maxChars global + per-doc) | Lead recommendation §4.1 |
| Formalize log policy (never log query/doc/context) | Lead recommendation §4.2 |
| Consolidate `lib/rag-client.ts` (low-level) vs `lib/ai/retriever.ts` (orchestrator) | Lead recommendation §4.3 |
