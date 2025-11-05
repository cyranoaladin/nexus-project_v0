# Testing Inventory & Quality Gate Plan

## 1. Capability-to-Test Mapping

| Capability Area | Intended Test Types | Current Coverage | Gaps / Actions |
|-----------------|---------------------|------------------|----------------|
| Authentication & Access Control (NextAuth callbacks, middleware, role guards) | Unit (NextAuth callbacks, helpers), Integration (session/user API routes), Playwright (login, logout, role redirects) | None in Jest/Playwright; Python API covers guards partially | Add Jest unit/integration specs for `lib/auth.ts`, middleware, API handlers; fix Playwright login loop and expand journeys. |
| ELEVE Dashboard UI (widgets, hooks, navigation) | React unit/component tests, Playwright flows | No React unit tests; Playwright spec blocked | Introduce component tests for dashboard widgets, deterministic fixtures, unblock and extend E2E paths. |
| Coach/Parent/Admin dashboards | React unit tests, Playwright persona journeys | No automated coverage | Define personas, add smoke tests after auth fix. |
| RAG Search UI | Unit tests for search utilities, Playwright flows | No UI tests; Playwright blocked | Create unit tests for search result parsing and load states; after auth fix, assert search + doc view. |
| RAG API | Pytest (FastAPI) | ✅ `tests/test_rag_router.py` | Ensure CI runs pytest; add coverage reporting. |
| Planner / Tasks / Agents services | Pytest services | ✅ existing pytest suite | Add regression coverage for new flows as they appear. |
| Marketing pages & forms | React unit tests, Playwright smoke | ✅ rich Jest and Playwright coverage | Keep updated as UI evolves. |
| Ingestion jobs & scripts (`tmp/`, cron jobs) | Pytest/CLI smoke tests | Not covered | Add CLI smoke tests and mocking for external services. |
| Prisma schema & database migrations | Prisma e2e/unit, migration smoke | Limited (manual) | Add migration dry-run in CI, add Prisma client unit tests. |
| DevOps scripts (scripts/*.js, Docker, deployment workflows) | Unit/lint tests, pipeline smoke | Not covered | Add targeted Jest tests or shellcheck; include docker build smoke in CI. |
| Type safety / build integrity | `tsc --noEmit`, Next build | Lint only; E2E job builds Next | Add `pnpm tsc --noEmit`; consider `next build` in tests workflow. |
| Python API integration with DB | Pytest | ✅ collected 20 tests | Run pytest (with coverage) in CI. |

## 2. Health Checks (2025-11-02)

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm test -- --listTests` | ❌ no tests detected | Jest config filters to `__tests__/lib`. Current suites under different paths; need refactor/config update. |
| `pnpm test:coverage -- --passWithNoTests` | ❌ same issue | Restore Jest suite or relax patterns. |
| `/home/alaeddine/nexus-project_v0/.venv/bin/python -m pytest --collect-only` | ✅ 20 tests collected | Pytest suite ready; integrate into automation. |

## 3. CI Enforcement Roadmap

1. **Restore Jest discovery**: align `testMatch` patterns or relocate tests so unit/integration projects execute again.
2. **Extend `.github/workflows/tests.yml`**:
   - Add `pnpm tsc --noEmit` stage.
   - Run `pnpm test -- --passWithNoTests` once discovery fixed.
   - Run `pnpm test:coverage -- --passWithNoTests` and enforce thresholds (e.g., lines ≥70%) after coverage gains.
   - Add Python job: set up venv, install deps, start Postgres service, run `python -m pytest --maxfail=1 --disable-warnings --cov=apps/api/apps/api`.
3. **Update `.github/workflows/e2e.yml`**:
   - Reuse shared DB seed script before Playwright runs.
   - After auth fixes, widen scenarios to include ELEVE dashboard smoke.
4. **Artifacts & Reporting**:
   - Publish Jest + pytest coverage reports.
   - Summaries in `GITHUB_STEP_SUMMARY` for quick status.

## 4. Immediate Action Items

1. Fix NextAuth login (unit/integration tests + Playwright) to unblock dashboard automation.
2. Repair Jest configuration so existing tests execute; relocate marketing/component tests under `__tests__/lib` or adjust `testMatch`.
3. Add CI stages for `pytest`, `tsc --noEmit`, and coverage once Jest suite is back.
4. After stabilization, iteratively add tests per capability roadmap above.

## 5. Next Up

With the inventory locked, the next sprint should focus on:
- Writing unit tests for `lib/auth.ts` callbacks and `middleware.ts` logic.
- Creating an integration spec for `/api/auth/session`.
- Updating the Playwright dashboard test once auth passes.
- Wiring pytest (and coverage) into CI.

All subsequent feature areas (dashboard widgets, RAG UI, DevOps scripts) can build on this foundation.
