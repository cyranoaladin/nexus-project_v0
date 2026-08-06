# Canonical Parent-Student Consent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit, idempotent parent consent that turns the legacy parent-child relation into a verified Canonical `ParentStudentLink` without granting access at registration time.

**Architecture:** One domain service owns ownership checks and link transitions. Existing child-creation transactions prepare pending links, a parent-only route and UI perform explicit consent, and a single-record CLI reconciles historical children through the same service. Report authorization is hardened to require both current legacy ownership and a verified Canonical link.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, NextAuth, Zod, React, Jest/Testing Library.

---

## Chunk 1: Domain behavior and API

### Task 1: Transactional consent service

**Files:**
- Create: `lib/bilans/parent-student-consent.ts`
- Test: `__tests__/bilans/parent-student-consent.test.ts`

- [ ] Write failing tests for legacy ownership, pending creation, active-link idempotence, a revoked historical link, another parent's child, and two concurrent preparations converging on exactly one active `PENDING_PARENT_CONSENT` link without an uncontrolled error or any `VERIFIED` link.
- [ ] Run `npm run test -- --runInBand __tests__/bilans/parent-student-consent.test.ts`; expect failure because the module does not exist.
- [ ] Implement `withParentStudentConsentTransaction(prisma, callback)`. The wrapper opens the interactive Prisma transaction and passes a callback-scoped context whose operations close over the real `TransactionClient`. Implement pending preparation on that context; verify ownership through `ParentProfile.userId` and `Student.parentId`, lock the student row, revoke active links for former parents, and create only `PENDING_PARENT_CONSENT`.
- [ ] Run the focused test; expect pass.
- [ ] Add failing tests for `verifyParentStudentConsent`: pending to verified, timestamps, one transaction, repeated-call idempotence, new active link after revoked/expired, no write for another parent, stale parent after reassignment, and revocation winning over a late compare-and-set update.
- [ ] Run and observe the expected missing-behavior failures.
- [ ] Implement the minimal transition plus `getParentStudentConsentStatus`, rechecking ownership under `SELECT ... FOR UPDATE` and updating only a still-pending row.
- [ ] Replace mocked concurrency with a PostgreSQL integration test using two independent interactive transactions. Run unit and isolated integration tests; expect one active pending link and no verified link.
- [ ] Commit explicitly:

```bash
git add -- lib/bilans/parent-student-consent.ts __tests__/bilans/parent-student-consent.test.ts
git commit -m "feat(bilans): service de consentement parent-enfant Canonical"
```

### Task 2: Parent-only consent endpoint

**Files:**
- Create: `app/api/parent/children/[studentId]/canonical-consent/route.ts`
- Create: `__tests__/api/parent-canonical-consent.route.test.ts`

- [ ] Write failing tests for `GET` state and strict `POST { consent: true }`.
- [ ] Assert unauthenticated, non-parent and another-parent requests receive `404`; missing, false or extra consent fields receive `400`; cross-origin POST is refused without writes; success returns only `{ state: 'VERIFIED' }`.
- [ ] Run `npm run test -- --runInBand __tests__/api/parent-canonical-consent.route.test.ts`; expect module-not-found failure.
- [ ] Implement the route using `auth`, the repository CSRF/same-origin guard, strict Zod parsing and the domain service. Mask every access refusal as `404`; log no PII or body.
- [ ] Rerun; expect pass.
- [ ] Commit explicitly:

```bash
git add -- app/api/parent/children/[studentId]/canonical-consent/route.ts __tests__/api/parent-canonical-consent.route.test.ts
git commit -m "feat(bilans): endpoint de consentement parental Canonical"
```

## Chunk 2: Registration and human surface

### Task 3: Prepare pending links during child creation

**Files:**
- Modify: `app/api/bilan-gratuit/route.ts`
- Modify: `app/api/parent/children/route.ts`
- Modify: `__tests__/api/parent.children.route.test.ts`
- Modify or create: focused `/api/bilan-gratuit` route test located by repository convention.

- [ ] Add failing tests proving each route prepares a pending link inside its existing transaction with server-resolved ids.
- [ ] Assert neither route creates `VERIFIED`, accepts a link state from the body, or commits a child when pending-link preparation fails.
- [ ] Run the focused route suites; expect failure because no Canonical link is prepared.
- [ ] Add only the two transactional service calls. Preserve response and email behavior.
- [ ] Rerun; expect pass.
- [ ] Commit the four paths explicitly with message `feat(bilans): préparer le lien Canonical à l'inscription`.

### Task 4: Explicit parent consent card

**Files:**
- Create: `app/dashboard/parent/enfant/[studentId]/canonical-consent-card.tsx`
- Modify: `app/dashboard/parent/enfant/[studentId]/page.tsx`
- Create: `__tests__/bilans/parent-canonical-consent-card.test.tsx`

- [ ] Write failing UI tests: checkbox unchecked, button disabled until checked, no POST on load, exact `{ consent: true }`, verified state after success, and failed request remaining unverified.
- [ ] Run `npm run test -- --runInBand __tests__/bilans/parent-canonical-consent-card.test.tsx`; expect module-not-found failure.
- [ ] Implement and mount the card using existing tokens/components. Explain the association and report visibility without exposing pack or answer data.
- [ ] Rerun; expect pass.
- [ ] Commit the three paths explicitly with message `feat(bilans): consentement explicite dans l'espace parent`.

## Chunk 3: Historical reconciliation and report authorization

### Task 5: Single-record reconciliation command

**Files:**
- Create: `scripts/bilans/reconcile-parent-student-link.ts`
- Create: `__tests__/scripts/reconcile-parent-student-link.test.ts`

- [ ] Write failing tests requiring exactly one `--student-id`, `--parent-email` and `--confirm PREPARER_CONSENTEMENT_PARENT`.
- [ ] Assert refusal on email/legacy ownership mismatch, absence of cohort queries, one-record idempotence, output with technical ids/state but no email, and state remaining `PENDING_PARENT_CONSENT`.
- [ ] Run `npm run test -- --runInBand __tests__/scripts/reconcile-parent-student-link.test.ts`; expect module-not-found failure.
- [ ] Implement injectable `main`, exact email lookup and pending-link preparation only. Never verify consent, scan users, create accounts or accept wildcards.
- [ ] Rerun; expect pass.
- [ ] Commit both paths explicitly with message `feat(bilans): réconcilier un lien parent-enfant consenti`.

### Task 6: Report authorization across link states

**Files:**
- Create: `__tests__/integration/bilans-parent-link-report-access.test.ts`
- Modify: `lib/bilans/api/get-report.ts` after the expected stale-parent test failure.

- [ ] Seed one published, materialized report and parents representing current-owner verified, current-owner pending, current-owner revoked, unrelated verified, and stale verified after legacy reassignment.
- [ ] Call the real GET report handler. Expect `200` only when both the verified link and current legacy ownership match; expect `404`, never `403`, otherwise.
- [ ] Run `npm run test -- --runInBand __tests__/integration/bilans-parent-link-report-access.test.ts`; expect the stale verified former-parent case to fail because the existing guard omits current legacy ownership.
- [ ] Require simultaneously a current `Student.parentId` ownership match and a current `ParentStudentLink` in `VERIFIED` state. Return `404`, never `403`, for every mismatch; rerun and expect pass.
- [ ] Run all V1 focused suites together; expect pass and no V1 skip.
- [ ] Commit the access test explicitly with message `test(bilans): verrouiller l'accès parent par état du lien`.

## Chunk 4: V1 gates and decision

### Task 7: Full verification and V1 GO/NO-GO

**Files:**
- Modify only paths proven necessary by failures introduced by V1.

- [ ] Run `npm run lint`; expect exit 0.
- [ ] Run `npm run typecheck`; expect exit 0.
- [ ] Run `npm run test -- --runInBand`; expect exit 0 and no skipped V1 test.
- [ ] Run `npm run build` with the established clean-build procedure that temporarily moves local `.env*` files without reading them and restores them through a trap.
- [ ] Confirm Next trace validation and artifact audit pass and `.next/standalone` contains no `.env` file.
- [ ] Inspect scope:

```bash
git status --short
git diff --check
git diff --name-only origin/docs/bilans-kit-integration...HEAD
```

- [ ] Push V1 commits only after every gate is green:

```bash
git push origin docs/bilans-kit-integration
```

- [ ] Report V1 GO/NO-GO with exact evidence. Do not begin V2 unless every V1 invariant is green.
