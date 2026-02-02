# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: b6f63b2c-caa6-4854-9343-caac52ddd5e7 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: b36786d4-cf45-4c2f-b27f-6acf0d36f8ad -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: b9169e0c-1da5-4808-9e1f-f19447f7aace -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Tasks

### [x] Step: Pre-Merge Preparation
<!-- chat-id: 7a7ecba3-e267-4c3f-ad68-86b8fec43477 -->

Prepare the main branch for consolidation.

**Tasks:**
- [x] Audit all 7 worktree branches for uncommitted changes (`git status`)
- [x] Verify all plan.md files show completion status ([x] marks)
- [x] Navigate to main project directory: `/home/alaeddine/Bureau/nexus-project_v0`
- [x] Checkout main branch: `git checkout main`
- [x] Pull latest changes: `git pull origin main`
- [x] Create safety backup tag: `git tag pre-consolidation-backup`
- [x] Document current main branch commit hash

**Verification:**
- ✅ All worktrees have clean status (no uncommitted changes)
- ✅ Main branch is up-to-date with remote
- ✅ Backup tag created successfully

**Main branch state before consolidation:**
- Commit: a6e7f6dcaa90e149070d609cbfa790a53b2d2d37
- Message: "refactor: update color scheme and add new pages"
- Date: 2026-02-02 15:12:41 +0100
- Tag: pre-consolidation-backup

**Estimated time:** 30 minutes

### [x] Step: Merge Branch 1 - Project Configuration
<!-- chat-id: 7474b800-63af-4bb3-9286-387466933d0f -->

Merge `set-up-project-config-e738` (commit: 57c55ddf).

**Tasks:**
- [x] Merge with: `git merge --no-ff set-up-project-config-e738 -m "chore: merge set-up-project-config-e738 - Project configuration setup"`
- [x] Resolve conflicts if any
- [x] Create checkpoint tag: `git tag merge-checkpoint-config`

**Verification:**
- [x] Run `npm run typecheck` (must pass)
- [x] Run `npm run lint` (must pass)
- [x] Run `npm run test:unit` (must pass)

**Expected conflicts:** None (configuration foundation)
**Estimated time:** 10 minutes
**Actual result:** ✅ Merge successful with no conflicts. All verification tests passed (227 tests passed, 3 skipped).

### [ ] Step: Merge Branch 2 - Tailwind Theme Configuration

Merge `configurer-les-fondations-tailwi-aae7` (commit: e686ace1).

**Tasks:**
- [ ] Merge with: `git merge --no-ff configurer-les-fondations-tailwi-aae7 -m "chore: merge configurer-les-fondations-tailwi-aae7 - Tailwind v4 theme configuration"`
- [ ] Resolve conflicts in `app/globals.css` if any (preserve theme CSS variables)
- [ ] Create checkpoint tag: `git tag merge-checkpoint-theme`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify theme tests pass (36 tests in `__tests__/ui/theme.test.ts`)

**Expected conflicts:** Potential conflicts in `app/globals.css`
**Estimated time:** 15 minutes

### [ ] Step: Merge Branch 3 - Database Schema Optimization

Merge `optimisation-et-securisation-du-d5ee` (commit: b72911b3) - **CRITICAL**.

**Tasks:**
- [ ] Merge with: `git merge --no-ff optimisation-et-securisation-du-d5ee -m "chore: merge optimisation-et-securisation-du-d5ee - Database schema optimization"`
- [ ] Verify `prisma/schema.prisma` contains:
  - [ ] 9 performance indexes
  - [ ] Foreign key constraints with onDelete strategies
  - [ ] Nullable fields (`Session.coachId`, `StudentReport.coachId`)
- [ ] Create checkpoint tag: `git tag merge-checkpoint-database`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify database schema test passes (`__tests__/database/schema.test.ts`)

**Expected conflicts:** None (database schema changes isolated)
**Estimated time:** 20 minutes

### [ ] Step: Merge Branch 4 - Enhanced UI Components

Merge `developpement-des-composants-ui-2353` (commit: 9b1a8069).

**Tasks:**
- [ ] Merge with: `git merge --no-ff developpement-des-composants-ui-2353 -m "chore: merge developpement-des-composants-ui-2353 - Enhanced UI components"`
- [ ] Resolve conflicts in `app/globals.css` (combine theme vars + component animations)
- [ ] Verify enhanced components:
  - [ ] `components/ui/button.tsx` (~2984 bytes, loading states)
  - [ ] `components/ui/input.tsx` (~2901 bytes, validation)
  - [ ] `components/ui/dialog.tsx` (~4796 bytes, size variants)
  - [ ] `components/ui/skeleton.tsx` (~4523 bytes, new patterns)
- [ ] Create checkpoint tag: `git tag merge-checkpoint-ui`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify 209 component tests pass (button, input, dialog, skeleton)

**Expected conflicts:** `app/globals.css` (three-way merge with theme + components)
**Estimated time:** 20 minutes

### [ ] Step: Merge Branch 5 - Monitoring and Error Logging

Merge `implementation-du-systeme-de-mon-0ac8` (commit: f7ca7964).

**Tasks:**
- [ ] Merge with: `git merge --no-ff implementation-du-systeme-de-mon-0ac8 -m "chore: merge implementation-du-systeme-de-mon-0ac8 - Monitoring and error logging"`
- [ ] Verify new files exist:
  - [ ] `lib/logger.ts`
  - [ ] `components/error-boundary.tsx`
  - [ ] Enhanced `lib/api/errors.ts`
- [ ] Create checkpoint tag: `git tag merge-checkpoint-monitoring`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify logger and error boundary tests pass

**Expected conflicts:** None (new files)
**Estimated time:** 15 minutes

### [ ] Step: Merge Branch 6 - API Security and Rate Limiting

Merge `renforcement-de-la-securite-des-99f7` (commit: 30824942).

**Tasks:**
- [ ] Merge with: `git merge --no-ff renforcement-de-la-securite-des-99f7 -m "chore: merge renforcement-de-la-securite-des-99f7 - API security and rate limiting"`
- [ ] Resolve conflicts in `lib/api/errors.ts` if any (combine logging + security)
- [ ] Verify new middleware files:
  - [ ] `lib/middleware/pino-logger.ts`
  - [ ] `lib/middleware/security-headers.ts`
  - [ ] `lib/middleware/rate-limit.ts`
- [ ] Verify enhanced `middleware.ts`
- [ ] Create checkpoint tag: `git tag merge-checkpoint-security`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify middleware tests pass (3 test files)

**Expected conflicts:** Potential conflicts in `lib/api/errors.ts` and `middleware.ts`
**Estimated time:** 20 minutes

### [ ] Step: Merge Branch 7 - Dynamic Navigation System

Merge `systeme-de-navigation-dynamique-ce16` (commit: 96f478b0).

**Tasks:**
- [ ] Merge with: `git merge --no-ff systeme-de-navigation-dynamique-ce16 -m "chore: merge systeme-de-navigation-dynamique-ce16 - Dynamic navigation system"`
- [ ] Verify `components/navigation/` directory exists with:
  - [ ] `nav-container.tsx`
  - [ ] `nav-item.tsx`
  - [ ] `nav-dropdown.tsx`
  - [ ] `role-based-nav.tsx`
  - [ ] `mobile-nav.tsx`
  - [ ] Additional navigation utilities (6-8 files total)
- [ ] Create checkpoint tag: `git tag merge-checkpoint-navigation`

**Verification:**
- [ ] Run `npm run typecheck` (must pass)
- [ ] Run `npm run lint` (must pass)
- [ ] Run `npm run test:unit` (must pass)
- [ ] Verify navigation role access tests pass

**Expected conflicts:** None (depends on UI components, merged earlier)
**Estimated time:** 15 minutes

### [ ] Step: Full System Verification

Run complete verification suite after all merges.

**Tasks:**
- [ ] Install/update dependencies: `npm install`
- [ ] Regenerate Prisma client: `npx prisma generate`
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Run linter: `npm run lint`
- [ ] Run all unit tests: `npm run test:unit`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Build project: `npm run build:base`
- [ ] Test database migration on dev DB: `npx prisma migrate dev`

**Verification:**
- All commands must pass without errors
- Expected test count increase: ~300+ new tests
- Build size increase should be < 15%
- No TypeScript errors
- No lint errors (warnings acceptable)

**Estimated time:** 1-2 hours

### [ ] Step: Critical File Verification

Verify critical files reflect latest changes.

**Tasks:**
- [ ] Compare `prisma/schema.prisma` with optimization branch:
  ```bash
  diff prisma/schema.prisma \
    /home/alaeddine/.zenflow/worktrees/optimisation-et-securisation-du-d5ee/prisma/schema.prisma
  ```
  - [ ] Confirm 9 indexes present
  - [ ] Confirm foreign key constraints with onDelete strategies
  - [ ] Confirm nullable fields
- [ ] Compare `components/ui/` with development branch:
  ```bash
  diff -r components/ui/ \
    /home/alaeddine/.zenflow/worktrees/developpement-des-composants-ui-2353/components/ui/
  ```
  - [ ] Check button.tsx file size (~2984 bytes)
  - [ ] Check input.tsx file size (~2901 bytes)
  - [ ] Check dialog.tsx file size (~4796 bytes)
  - [ ] Check skeleton.tsx file size (~4523 bytes)
- [ ] Verify all expected new files exist (checklist from spec section 3.1)

**Verification:**
- No differences found in critical files
- All expected files present

**Estimated time:** 30 minutes

### [ ] Step: Finalization and Documentation

Complete consolidation with tagging and documentation.

**Tasks:**
- [ ] Create consolidation tag: `git tag v0.1.0-consolidated-2026-02-02`
- [ ] Push main branch to remote: `git push origin main`
- [ ] Push all tags: `git push origin --tags`
- [ ] Document merge completion (record commit hashes, test results)
- [ ] Update plan.md with final verification results

**Verification:**
- Consolidation tag created and pushed
- Main branch pushed successfully
- All merges documented

**Optional cleanup:**
- [ ] Consider removing merged worktrees to save disk space
- [ ] Keep worktrees if further work might be needed

**Estimated time:** 30 minutes

---

## Verification Results

Record verification results here after each merge:

### Branch 1 (Config):
- Typecheck: [x] PASS
- Lint: [x] PASS (warnings only)
- Tests: [x] PASS (227 passed, 3 skipped)

### Branch 2 (Theme):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Branch 3 (Database):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Branch 4 (UI Components):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Branch 5 (Monitoring):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Branch 6 (Security):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Branch 7 (Navigation):
- Typecheck: [ ] PASS / [ ] FAIL
- Lint: [ ] PASS / [ ] FAIL
- Tests: [ ] PASS / [ ] FAIL

### Final System Verification:
- npm install: [ ] PASS / [ ] FAIL
- prisma generate: [ ] PASS / [ ] FAIL
- typecheck: [ ] PASS / [ ] FAIL
- lint: [ ] PASS / [ ] FAIL
- test:unit: [ ] PASS / [ ] FAIL
- test:integration: [ ] PASS / [ ] FAIL
- build:base: [ ] PASS / [ ] FAIL
- prisma migrate dev: [ ] PASS / [ ] FAIL

---

**Total estimated time:** 4.5 - 6 hours
**Critical success criteria:** All 7 branches merged, all tests pass, critical files verified
