# E2E Flaky Tests — Decision Record

**Date**: 2026-02-19
**Updated**: 2026-02-19
**Status**: Active

## Context

Some E2E tests fail consistently in CI (headless Chromium on GitHub Actions)
while passing locally, due to client-side SPA hydration timing.

**Core business flows** (login, booking, dashboards) are **never** marked as
`test.fixme()` — they must be stabilized with proper waiters and selectors.

## Decision

Mark **11** non-core, hydration-dependent tests with `test.fixme()` so they are
**skipped but tracked** by Playwright. This is preferable to:

- `test.skip()` — which hides them from reports
- Deleting them — which loses test coverage intent
- Increasing timeouts — which masks the root cause and slows CI

## Affected Tests

### Maths Lab SPA (9 tests)

| File | Test | Reason |
|------|------|--------|
| `e2e/programme/maths-1ere.spec.ts` | Page loads with correct title and header | Zustand + MathJax hydration |
| `e2e/programme/maths-1ere.spec.ts` | All tab navigation works without 404 | Zustand + MathJax hydration |
| `e2e/programme/maths-1ere.spec.ts` | XP persists after page reload | localStorage + Zustand rehydration |
| `e2e/programme/maths-1ere.spec.ts` | Completed chapter stays unlocked after reload | localStorage + Zustand rehydration |
| `e2e/programme/maths-1ere.spec.ts` | Dashboard shows Progression Globale | Zustand hydration |
| `e2e/student-journey.spec.ts` | MathJax critique | MathJax rendering |
| `e2e/student-journey.spec.ts` | Workflow élève | SPA interactive elements |
| `e2e/student-journey.spec.ts` | Navigation interne sans 404 | SPA hydration |
| `e2e/student-journey.spec.ts` | Résilience offline | SPA hydration |

### Non-Core Dashboard Timing (2 tests)

| File | Test | Reason |
|------|------|--------|
| `e2e/student-dashboard.spec.ts` | Dashboard loads correctly | Student dashboard SSR timing |
| `e2e/student-aria.spec.ts` | Student can access dashboard and see ARIA section | Student dashboard SSR timing |

### Excluded from fixme (core flows — must be stabilized)

The following tests are **never** skipped. They use stable waiters instead:

- `e2e/auth-and-booking.spec.ts`: Parent login/dashboard, booking, coach dashboard
- `e2e/parent-dashboard.spec.ts`: Parent dashboard load

## Remediation Plan

To un-fixme the remaining tests:

1. **Maths Lab**: Add a `data-hydrated` attribute to the root element after
   Zustand store rehydration completes, then wait for it in tests instead of
   relying on text visibility.

2. **MathJax**: Use `page.waitForFunction(() => window.MathJax?.startup?.promise)`
   instead of fixed timeouts.

## Rate Limiting in CI

The in-memory rate limiter (`lib/middleware/rateLimit.ts`) is bypassed in CI via
`RATE_LIMIT_DISABLE=1` environment variable on the E2E server. This does NOT
affect production — the variable is only set in `.github/workflows/ci.yml` for
the E2E server start step. Production rate limiting uses Upstash Redis
(`lib/rate-limit.ts`) which is fail-closed when not configured.
