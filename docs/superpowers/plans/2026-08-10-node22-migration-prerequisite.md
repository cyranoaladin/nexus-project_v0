# Node 22 and Network Migration Prerequisite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the production Docker build with Node 22 and prove the #116 migration and application runtime on an isolated SCRAM-authenticated clone without changing production.

**Architecture:** The committed change is deliberately limited to `Dockerfile.prod`, its deployment contract, and an evidence report. Operational verification uses a schema-only PostgreSQL 15 clone plus Prisma registry metadata, an isolated internal network, temporary secrets and a Node 22 runner canary.

**Tech Stack:** Docker/BuildKit, Node 22.23.1 Alpine, npm 10.9.8, Next.js 15 standalone, Prisma 6.19.3, PostgreSQL 15/pgvector, Redis 7, Jest.

---

## Chunk 1: Versioned alignment

### Task 1: Lock `Dockerfile.prod` to Node 22

**Files:**
- Modify: `__tests__/config/deploy-contract.test.ts`
- Modify: `Dockerfile.prod`

- [ ] **Step 1: Write the failing deployment contract**

Require exactly three occurrences of the canonical pinned image, require
`COPY package.json package-lock.json .npmrc ./`, and reject `node:20`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx --yes npm@10.9.8 test -- --runInBand __tests__/config/deploy-contract.test.ts`

Expected: FAIL because `Dockerfile.prod` still contains three Node 20 bases and
does not copy `.npmrc`.

- [ ] **Step 3: Apply the minimal Dockerfile change**

Use the exact Node 22.23.1 Alpine digest already present in `Dockerfile`,
`Dockerfile.e2e` and `Dockerfile.dependencies` for `deps`, `builder` and
`runner`. Add `.npmrc` only to the dependency-stage copy.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2.

Expected: all deployment-contract tests pass.

- [ ] **Step 5: Commit**

Commit only the test and `Dockerfile.prod`.

### Task 2: Build and inspect both production targets

**Files:**
- Verify: `Dockerfile.prod`

- [ ] **Step 1: Build the `migrator` target**

Build with an explicit local evidence tag and no production environment.

- [ ] **Step 2: Verify migrator runtime versions**

Run `node --version`, `npm --version` and Prisma CLI version inside the image.

Expected: Node 22.23.1, npm 10.9.8, Prisma 6.19.3.

- [ ] **Step 3: Build the `runner` target**

Use the exact branch commit as `RELEASE_SHA`; neutralize build-time outbound
providers and keep candidate libre disabled.

- [ ] **Step 4: Verify runner runtime versions**

Expected: Node 22.23.1 and npm 10.9.8.

## Chunk 2: Ephemeral PostgreSQL and canary proof

### Task 3: Create the schema-only production clone

**Files:**
- Temporary only: protected directory outside the repository

- [ ] **Step 1: Capture production baseline read-only**

Record runtime identity, health and absence of migration #116 without
persisting infrastructure identifiers.

- [ ] **Step 2: Stream a schema-only custom dump**

Use the read-only administration channel to export the schema without owners or
privileges. Export the Prisma migration registry separately.

- [ ] **Step 3: Create isolated Docker resources**

Create an isolated internal network, an ephemeral PostgreSQL 15 clone and a
strong random credential for the migration administrator, stored securely
outside Git.

- [ ] **Step 4: Restore schema and registry metadata**

Restore with `--no-owner --no-privileges`, keeping all business tables empty.

- [ ] **Step 5: Record Canonical invariants before migration**

Hash the schema of `canonical_*` relations and count all append-only/scoring
rows.

### Task 4: Prove network Prisma migration

**Files:**
- Verify: `prisma/migrations/20260809090000_deferred_parent_email/migration.sql`

- [ ] **Step 1: Prove SCRAM network authentication**

Prove from the migrator that the expected role and database are reached through
the clone's internal network, without recording their identifiers.

- [ ] **Step 2: Run first `prisma migrate deploy`**

Expected: only `20260809090000_deferred_parent_email` is applied.

- [ ] **Step 3: Verify resulting schema**

Assert nullable `users.email`, nullable `users.phoneNormalized`, preserved
`users_email_key`, and present `users_phoneNormalized_idx`.

- [ ] **Step 4: Run second `prisma migrate deploy`**

Expected: no pending migrations.

- [ ] **Step 5: Recheck invariants**

Canonical schema hash and all append-only/scoring counts must equal the
pre-migration values.

### Task 5: Run the isolated Node 22 canary

**Files:**
- Temporary only: canary environment outside the repository

- [ ] **Step 1: Start isolated Redis and seed synthetic auth data**

Create only a synthetic ADMIN account in the clone with a known temporary
password. Do not copy production users.

- [ ] **Step 2: Start runner on an isolated local endpoint**

Use clone PostgreSQL/Redis, random auth/rate-limit secrets, disabled SMTP,
disabled workers, disabled LLM and temporary storage.

- [ ] **Step 3: Verify HTTP and Prisma**

Require `/api/health` 200 and a DB-backed request without server errors.

- [ ] **Step 4: Verify Credentials authentication**

Obtain a CSRF token, submit the synthetic credentials, retain the session
cookie and require an authenticated staff route response.

- [ ] **Step 5: Verify Sharp and PDFKit**

Load both native/runtime libraries inside the runner, create in-memory output,
and require non-empty buffers without writing documents.

- [ ] **Step 6: Capture canary logs**

Require no Prisma engine, native module, SMTP, worker or LLM error.

### Task 6: Destroy all ephemeral resources

**Files:**
- Temporary only

- [ ] **Step 1: Stop and remove canary, Redis and PostgreSQL containers**
- [ ] **Step 2: Remove the dedicated network and evidence images**
- [ ] **Step 3: Remove dump, registry and credential files**
- [ ] **Step 4: Prove zero residual container, network, endpoint and file**
- [ ] **Step 5: Recheck production baseline unchanged**

## Chunk 3: Evidence and publication

### Task 7: Record the audit evidence

**Files:**
- Create: `docs/audits/2026-08-10-node22-network-migration-prerequisite-phase-b.md`

- [ ] **Step 1: Document root causes and versioned changes**
- [ ] **Step 2: Document clone/canary commands in redacted form and results**
- [ ] **Step 3: Document the proposed production rotation mechanism**
- [ ] **Step 4: State all prohibited production actions remained unperformed**
- [ ] **Step 5: Commit the report**

### Task 8: Run final verification and publish the PR

**Files:**
- Verify all changed files

- [ ] **Step 1: Run focused test, full unit suite, lint and typecheck**
- [ ] **Step 2: Run `git diff --check` and inspect the complete diff**
- [ ] **Step 3: Confirm branch is clean and based on `main` after #116**
- [ ] **Step 4: Push the dedicated branch**
- [ ] **Step 5: Open a draft PR to `main` and request `abenrhouma`**
- [ ] **Step 6: Report and stop before any production credential rotation**
