# PR #318 Core v2 ARIA Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR B honest and safe: canonical tier/scoped entitlements, enrollment-backed pins, capability-aware UI, and no Core v2 use of legacy chat until PR C.

**Architecture:** A pure Core v2 grant adapter feeds the existing canonical ARIA entitlement kernel, preserving feature contexts for course authorization and an aggregate context for tier capabilities. The cockpit contract exposes deployment availability independently from commercial tier capabilities; Core v2 renders unavailable states and omits every chat entry point while V1 remains unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma Core v2/PostgreSQL, Jest/Testing Library, Playwright.

---

## Chunk 1: Canonical Core v2 entitlement model

### Task 1: Add non-null `ariaTier` to Core v2 grants

**Files:**
- Modify: `core-v2/prisma/schema.prisma`
- Modify: `core-v2/prisma/migrations/0018_core_v2_aria_foundation/migration.sql`
- Modify: `lib/core-v2/aria/access-grants.ts`
- Modify: `__tests__/core-v2/aria/aria-cockpit-native.test.ts`

- [ ] Add failing tests creating AUTONOMIE, SUIVI, and ACCOMPAGNEE grants and asserting the persisted tier/default.
- [ ] Run `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx jest --config jest.core-v2.config.js --runInBand __tests__/core-v2/aria/aria-cockpit-native.test.ts`; expected RED is the missing `ariaTier` field/type.
- [ ] Add `CoreV2AriaTier` with the three exact values and `ariaTier @default(ARIA_AUTONOMIE)` non-null.
- [ ] Update grant input to accept the generated enum and persist it without nullable fallback.
- [ ] Run `npx prisma generate --schema=core-v2/prisma/schema.prisma` and `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx prisma validate --schema=core-v2/prisma/schema.prisma`.
- [ ] Recreate the dedicated disposable PR database, deploy migrations, and rerun the exact focused Jest command to green.
- [ ] Commit: `feat(aria): model Core v2 access tiers`

### Task 2: Build and test the pure canonical adapter

**Files:**
- Modify: `lib/core-v2/aria/access-grants.ts`
- Create or modify: `__tests__/core-v2/aria/access-grants.test.ts`
- Modify: `__tests__/core-v2/aria/aria-cockpit-native.test.ts`

- [ ] Write failing pure tests for global AUTONOMIE, global SUIVI, scoped ACCOMPAGNEE, multiple active grants selecting the highest tier, expired ignored, revoked ignored, and no grant/no capabilities.
- [ ] Assert the exact `AriaEntitlementRecord` mapping: product code, status, dates, non-null tier, and GLOBAL versus COURSE scopes.
- [ ] Add a repository-level counter-example proving production loads `id`, `featureKey`, `courseScopes`, `status`, `startsAt`, `endsAt`, and `ariaTier` for ACTIVE/EXPIRED/REVOKED rows without prefiltering validity.
- [ ] Run `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx jest --config jest.core-v2.config.js --runInBand __tests__/core-v2/aria/access-grants.test.ts __tests__/core-v2/aria/aria-cockpit-native.test.ts`; expected RED is the feature-only select and missing scope/tier/status/date data.
- [ ] Implement `adaptCoreV2AriaAccessGrant(s)` as a pure mapper and pass its records only to `buildCanonicalAriaEntitlementContext`.
- [ ] Change the repository query to filter only by `studentId`; do not filter status/startsAt/endsAt in Prisma. The canonical kernel is the sole validity filter.
- [ ] Build aggregate and per-`featureKey` canonical contexts without copying date rules, status rules, tier ranking, or capability matrices.
- [ ] Use `resolveAriaCapabilities(aggregate.tier)` for commercial tier capabilities.
- [ ] Rerun the exact command to green and refactor names/types.
- [ ] Commit: `fix(aria): adapt Core v2 grants to canonical entitlements`

### Task 3: Enforce feature and course scopes in the cockpit curriculum

**Files:**
- Modify: `lib/aria/curriculum/resolver.ts`
- Modify: `app/api/v2/aria/cockpit/route.ts`
- Modify: `__tests__/core-v2/aria/aria-cockpit-native.test.ts`
- Modify: `__tests__/lib/aria/aria-curriculum-resolver.test.ts`

- [ ] Add failing tests: global grant unlocks matching-feature enrolled courses; one-course grant leaves another relevant course locked; two grants union correctly; wrong feature never unlocks the course; legacy feature strings cannot override a scoped Core v2 denial.
- [ ] Replace the ambiguous optional inputs with `access: { kind: 'LEGACY_FEATURES'; featureKeys: readonly string[] } | { kind: 'CANONICAL_BY_FEATURE'; contexts: ReadonlyMap<AriaFeatureKey, CanonicalAriaEntitlementContext> }` (or an equivalent discriminated shape).
- [ ] Compute `commerciallyEntitled` from the course's `requiredFeature` context and the canonical global/course scope decision.
- [ ] Wire Core v2 route to the canonical contexts; do not flatten grants to feature strings.
- [ ] Run `npx jest --config jest.config.js --runInBand __tests__/lib/aria/aria-curriculum-resolver.test.ts` plus the Core v2 command from Task 2; expected GREEN with no bypass path.
- [ ] Commit: `fix(aria): enforce Core v2 course scopes`

## Chunk 2: Enrollment truth and UI honesty

### Task 4: Validate pins against real Core v2 enrollments

**Files:**
- Modify: `lib/core-v2/aria/cockpit-profile.ts`
- Modify: `lib/curriculum/legacy-migration-map.ts` only if a pure reverse mapping helper is missing
- Modify: `app/api/v2/aria/cockpit/profile/route.ts`
- Modify: `__tests__/core-v2/aria/aria-cockpit-native.test.ts`

- [ ] Add failing route tests for unenrolled maths expertes refusal, unenrolled maths complémentaires refusal, enrolled option acceptance, enrolled specialty acceptance, and wrong-grade refusal.
- [ ] Add a read-side failing test: pin an enrolled option, remove its `StudentCourseEnrollment`, reload profile/cockpit, and assert the stale pin is filtered and never academically relevant/actionable.
- [ ] Run the focused Core v2 command; expected RED includes acceptance of unenrolled theoretical options and retention of the stale pin.
- [ ] Pass `academicEnrollments` into the Core v2 profile validation context.
- [ ] Derive the exact allowed cockpit keys from current enrollments plus valid required core/track courses; never infer option enrollment from the catalogue.
- [ ] Retain the existing known-key and grade/track checks as defense in depth.
- [ ] Apply the same pure allowed-pin filter on GET/cockpit reads so stale persisted pins fail closed without inventing an enrollment.
- [ ] Rerun the exact focused command to green.
- [ ] Commit: `fix(aria): validate pins against course enrollments`

### Task 5: Add chat deployment capability and suppress Core v2 legacy chat

**Files:**
- Modify: `lib/aria/cockpit/contracts.ts`
- Modify: `lib/aria/cockpit/builder.ts`
- Modify: `app/api/v2/aria/cockpit/route.ts`
- Modify: `app/dashboard/eleve/aria/page.tsx`
- Modify: `components/aria/cockpit/AriaCockpitShell.tsx`
- Modify: `components/aria/cockpit/AriaAgentPanel.tsx`
- Modify: `components/aria/cockpit/AriaCourseWorkspace.tsx`
- Modify: `__tests__/components/aria/cockpit-agent-panel.test.tsx`
- Modify: `__tests__/components/aria/cockpit-shell.test.tsx`
- Create: `__tests__/app/dashboard/eleve/aria-page.test.tsx`

- [ ] Add failing component tests and a page-level test that mocks a CORE_V2 session/cockpit, spies on `AriaChatLauncher`, and proves `chat=false` mounts no launcher and renders no active “ouvrir/démarrer le chat” control; add the V1 `chat=true` counterpart.
- [ ] Add an exact request denylist assertion for `/api/aria/chat`, `/api/aria/conversations`, `/api/aria/conversations/**/messages`, `/api/aria/turns/**`, and `/api/aria/feedback`.
- [ ] Run `npx jest --config jest.config.js --runInBand __tests__/app/dashboard/eleve/aria-page.test.tsx __tests__/components/aria/cockpit-agent-panel.test.tsx __tests__/components/aria/cockpit-shell.test.tsx`; expected RED is a mounted launcher/active chat CTA for CORE_V2.
- [ ] Add `chat` to `AriaCockpitCapabilitiesDTO`; set V1 true and Core v2 false.
- [ ] Make chat callbacks optional/gated and render a neutral unavailable state instead of subscription/empty wording when chat is false.
- [ ] Conditionally mount `AriaChatLauncher` only when `cockpit.capabilities.chat` is true.
- [ ] Rerun the exact command to green; the page-level denylist must observe zero forbidden requests.
- [ ] Commit: `fix(aria): disable chat for Core v2 foundation`

### Task 6: Render unavailable capabilities distinctly from empty data

**Files:**
- Modify: `components/aria/cockpit/AriaTrajectoryPanel.tsx`
- Modify: `components/aria/cockpit/AriaResourcesPanel.tsx`
- Modify: `components/aria/cockpit/AriaAssessmentsPanel.tsx`
- Modify: `components/aria/cockpit/AriaTodayPanel.tsx`
- Modify: `components/aria/cockpit/AriaAgentPanel.tsx`
- Modify: `components/aria/cockpit/AriaCourseWorkspace.tsx`
- Modify: `__tests__/components/aria/cockpit-shell.test.tsx`
- Modify: `__tests__/components/aria/cockpit-agent-panel.test.tsx`
- Create or modify: `__tests__/components/aria/cockpit-capabilities.test.tsx`

- [ ] Add a table-driven failing matrix for `trajectory`, `resources`, `assessments`, `nextSession`, and `conversationHistory`: false renders “Fonction non encore disponible pour ce profil” and suppresses every corresponding empty label/count (including both conversation counters and course-workspace assessments/resources).
- [ ] Add the inverse matrix: capability true plus empty/null payload renders the existing AVAILABLE_EMPTY labels.
- [ ] Run `npx jest --config jest.config.js --runInBand __tests__/components/aria/cockpit-capabilities.test.tsx __tests__/components/aria/cockpit-agent-panel.test.tsx __tests__/components/aria/cockpit-shell.test.tsx`; expected RED is false capabilities rendered as real empty data.
- [ ] Add one reusable neutral unavailable component/constant; avoid duplicating copy.
- [ ] Rerun the exact component command to green.
- [ ] Commit: `fix(aria): distinguish unavailable cockpit features`

## Chunk 3: Browser proof and final gates

### Task 7: Add Core-v2-only and V1 chat E2E coverage

**Files:**
- Create: `e2e/auth/core-v2-aria-foundation.spec.ts`
- Modify: `scripts/seed-e2e-db.ts` to create a named Core-v2-only ELEVE identity, CURRENT enrollment, real specialty/option `StudentCourseEnrollment`, scoped `AriaAccessGrant` with explicit tier, and empty initial cockpit profile; do not create a legacy Student row for that identity

- [ ] Add a failing Core-v2-only browser test: real login; assert `/api/auth/session` returns `authority: CORE_V2`; assert cockpit/profile requests use only `/api/v2/aria/**` and never `/api/aria/cockpit**`; verify correct school profile, onboarding, permitted course pin, reload persistence, unavailable capability copy, and no chat control.
- [ ] Observe all requests and assert none match `/api/aria/chat`, `/api/aria/conversations`, `/api/aria/conversations/**/messages`, `/api/aria/turns/**`, or `/api/aria/feedback`.
- [ ] Add a V1 spot-check asserting the existing launcher/chat trigger remains visible and usable.
- [ ] Run `npx playwright test e2e/auth/core-v2-aria-foundation.spec.ts --config=playwright.auth.config.ts --project=chromium`; expected RED before Tasks 4–6 and GREEN after them.
- [ ] Run `npm run check:e2e-ownership && npm run check:e2e-syntax`, then `npm run test:aria:e2e:desktop` for the V1 spot-check.
- [ ] Commit: `test(aria): prove honest Core v2 foundation state`

### Task 8: Verification, documentation, push, and fresh review

**Files:**
- Create or modify: `docs/audits/2026-09-23-pr318-core-v2-aria-hardening.md`

- [ ] Run the exact targeted Core v2 and component commands from Tasks 2, 4, 5, and 6.
- [ ] Run `npm run test:aria:unit`, `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx jest --config jest.core-v2.config.js --runInBand --ci`, and `npm run test:aria:architecture`.
- [ ] Run `npx jest --config jest.config.js --runInBand __tests__/architecture/core-v2-legacy-guards.test.ts __tests__/architecture/core-v2-client-authority-guard.test.ts`.
- [ ] Run `npx prisma generate --schema=core-v2/prisma/schema.prisma`, `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx prisma validate --schema=core-v2/prisma/schema.prisma`, deploy migrations to a fresh disposable database, and run the CI migration drift command against that database.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run check:e2e-ownership`, and `npm run check:e2e-syntax`.
- [ ] Run `npx playwright test e2e/auth/core-v2-aria-foundation.spec.ts --config=playwright.auth.config.ts --project=chromium` and `npm run test:aria:e2e:desktop`.
- [ ] Run every remaining check required by the PR CI matrix; record exact command/output for environmental exceptions.
- [ ] Review the full diff for V1 regression, grant semantics, PII, and accidental PR C scope.
- [ ] Request internal spec and code-quality reviews; resolve all Important/Critical findings.
- [ ] Push the branch; record local and remote SHA and require equality.
- [ ] Wait until every required GitHub check is green on that exact SHA.
- [ ] Only then post `@codex review`; require a fresh automated review tied to that exact SHA and resolve every applicable P1/P2 before calling it acceptable.
- [ ] Do not request or preserve human approval until exact-head CI is green and the fresh automated review is acceptable.
- [ ] Record CI conclusions, SHA, and review URL in the audit report.
