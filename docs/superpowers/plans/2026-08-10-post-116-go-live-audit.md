# Post-#116 Go-Live Proof and Audit Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete test matrix on `e15c8418e0`, exclude genuine Auth.js regressions, and inventory duplicate/orphan/dead/hardcoded assets without changing production.

**Architecture:** Run every executable test family in disposable Node 22/PostgreSQL 15/Playwright environments derived from the exact main SHA. Keep production access read-only and redact all infrastructure, credentials, hashes, and PII from versioned evidence. Treat static-analysis output as leads that require source-level confirmation before inclusion in the audit report.

**Tech Stack:** Next.js 15, Node 22.23.1, npm 10.9.8, Jest, Prisma 6, PostgreSQL 15, Playwright 1.58.1, Docker, Bash, TypeScript.

---

## Chunk 1: Test proof

### Task 1: Map every test and skip mechanism

**Files:**
- Read: `package.json`
- Read: `jest.unit.config.js`
- Read: `jest.integration.config.js`
- Read: `jest.config.db.js`
- Read: `playwright.config.ts`
- Read: `.github/workflows/*.yml`
- Create: `.audit-artifacts/test-inventory/*` (ignored, local evidence only)

- [ ] Enumerate Jest, Playwright, and Python test files and map each to a runner.
- [ ] Search for `.skip`, `.todo`, `.only`, `xit`, `xdescribe`, `fit`, `fdescribe`, `fixme`, and environment-conditional skips.
- [ ] Run each runner in list mode and compare discovered files/tests to the filesystem inventory.
- [ ] Classify every exclusion as structural, unjustified, or an actual skipped test.

### Task 2: Run unit, integration, real-DB, and E2E suites

**Files:**
- Read: `docker-compose.test.yml`
- Read: `docker-compose.e2e.yml`
- Read: `Dockerfile.e2e`
- Read: `scripts/setup-e2e-db.sh`
- Create: `.audit-artifacts/test-results/*` (ignored, local evidence only)

- [ ] Build a disposable Node 22.23.1/npm 10.9.8 dependency image from the exact SHA.
- [ ] Start a uniquely named PostgreSQL 15 instance on an isolated Docker network and apply every migration.
- [ ] Run unit Jest with no path/name filter and capture JSON/JUnit evidence.
- [ ] Run integration and every `*.real.test.*` suite against the disposable DB, with no filter.
- [ ] Run the DB/concurrency/transaction suite against the same disposable DB, with no filter.
- [ ] Run all Playwright projects/specs against an isolated app and DB, with no grep and no skip environment.
- [ ] Record exact suites/tests/passed/failed/pending/todo/runtime counts.
- [ ] Destroy only the disposable containers, volumes, and network after evidence is captured.

## Chunk 2: Authentication proof

### Task 3: Attribute Auth.js errors and validate role logins

**Files:**
- Read: `auth.ts`
- Read: `auth.config.ts`
- Read: `lib/auth/credentials-authorize.ts`
- Read: production PM2 logs (read-only, redacted)
- Create: `.audit-artifacts/auth/*` (local redacted evidence only)

- [ ] Locate the exact two `JWTSessionError` records and correlate them with Codex smoke timing and cause.
- [ ] Confirm no other Auth.js error exists before or after those records in the deployment window.
- [ ] Exercise Credentials login for seeded ASSISTANTE, PARENT, and ELEVE accounts in the isolated stack.
- [ ] Verify session projection, protected-page access, and a clean Auth.js log window for all three roles.
- [ ] Perform read-only production session/health checks without manufacturing invalid tokens.

## Chunk 3: Repository and storage audit

### Task 4: Audit duplicate logic and dead/orphaned code

**Files:**
- Read: `lib/bilans/**/*`
- Read: `lib/contact/**/*`
- Read: `lib/auth/**/*`
- Read: `app/api/**/*`
- Read: `prisma/schema.prisma`
- Read: `prisma/migrations/**/*`

- [ ] Compare every scoring entry point to the canonical scoring implementation.
- [ ] Compare report rendering, phone normalization, and parent-contact normalization paths.
- [ ] Run lint/typecheck unused checks and a dead-export scan; manually validate framework entry points and false positives.
- [ ] Compare Prisma migrations, schema models/columns, generated client use, and source references for orphaned database objects.
- [ ] Record only confirmed findings with severity, exact file/line, impact, and recommendation.

### Task 5: Audit hardcoding and Docker metadata

**Files:**
- Read: `Dockerfile*`
- Read: `docker-compose*.yml`
- Read: `.env*.example`
- Read: `scripts/security/*`
- Read: application configuration and storage modules

- [ ] Run repository secret and public-infrastructure guards without weakening them.
- [ ] Search executable code for hardcoded URLs, paths, ports, thresholds, identifiers, and credential-like values.
- [ ] Distinguish legitimate product constants/test fixtures from runtime configuration debt.
- [ ] Inspect Nexus Docker image config/history on production in read-only mode, reporting only key names and risk classification, never values.

### Task 6: Diagnose the 19 storage files

**Files:**
- Read: storage root resolution and document persistence modules
- Read: production filesystem and database metadata (read-only)
- Create: `.audit-artifacts/storage/*` (local redacted evidence only)

- [ ] Reproduce the storage-root warning from source and identify every scanned root.
- [ ] Inventory the 19 files by opaque identifier, type, size, date, ownership, and checksum prefix without exposing family PII.
- [ ] Cross-reference each file with document/invoice database records and current canonical storage paths.
- [ ] Determine likely origin (legacy release path, upload, generated report, invoice, or orphan).
- [ ] Recommend attach/migrate/delete/retain for human arbitration; perform no mutation.

## Chunk 4: Report and final verification

### Task 7: Write and verify the audit report

**Files:**
- Create: `docs/audits/2026-08-10-post-116-go-live-proof.md`

- [ ] Write exact test totals, commands, runtimes, and skip classification.
- [ ] Document Auth.js attribution and role-login evidence.
- [ ] List duplicate/orphan/dead/hardcoded findings by P0/P1/P2 with exact locations.
- [ ] Provide a decision table for all 19 storage files without PII.
- [ ] Run lint/typecheck/security guards on any versioned documentation changes.
- [ ] Verify branch/worktree state and confirm production SHA/state did not change during the audit.
- [ ] Do not commit, push, deploy, or open a correction PR before responsible arbitration.
