# Canonical Free Assessment Go-Live Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure account-first free-assessment workflow with parent/child traceability, a review-gated Terminale Maths pilot, durable staff notifications, provisional deterministic results, and human-approved final reports.

**Architecture:** Add a `BilanRequest` aggregate in front of the canonical attempt, evidence, report-revision and outbox foundation already present. A request-bound temporary session lets both new and existing-email submissions continue without revealing account existence; a one-time magic link verifies and authenticates the parent before dashboard or final-report access. New writes use only the canonical path, while legacy assessment/report records remain read-only.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zod, Prisma/PostgreSQL, Auth.js v5 JWT sessions, Redis-backed rate limiting, durable PostgreSQL outboxes, Jest, Playwright, Docker Compose.

**Validated design:** `docs/superpowers/specs/2026-07-29-bilan-gratuit-canonical-go-live-design.md`

**Pre-existing worktree changes to preserve:** `__tests__/components/corporate-navbar.test.tsx`, `components/layout/CorporateNavbar.tsx`, `content/pre-rentree-2026/publication-decisions.owner.json`, `lib/campaigns/pre-rentree-2026/navigation.ts`, `lib/campaigns/pre-rentree-2026/release-gate.ts`, `lib/pricing-client.ts`.

---

## File structure

### Domain and persistence

- `lib/bilans/requests/types.ts` — request/account/event enums and public domain types.
- `lib/bilans/requests/schemas.ts` — strict intake, child, draft, submit and team-action schemas.
- `lib/bilans/requests/state-machine.ts` — the only legal request transition matrix.
- `lib/bilans/requests/feature-flags.ts` — fail-closed server-side rollout flags.
- `lib/bilans/requests/tokens.ts` — random token generation, hashing and cookie contracts.
- `lib/bilans/requests/create-request.ts` — idempotent new/existing-parent intake transaction.
- `lib/bilans/requests/attach-child.ts` — verified-parent child selection/creation.
- `lib/bilans/requests/access.ts` — request, temporary-session, parent and team ownership predicates.
- `lib/bilans/requests/events.ts` — append-only event creation with minimized payloads.
- `lib/bilans/auth/consume-magic-link.ts` — one-time token consumption and parent verification.
- `prisma/schema.prisma` — additive request, event, flow-session, magic-link and audience contracts.
- `prisma/migrations/20260729_add_canonical_bilan_requests/migration.sql` — additive SQL and integrity constraints.

### Public workflow

- `app/api/bilan-gratuit/route.ts` — compatibility entrypoint and unconditional anti-enumeration hardening.
- `app/api/bilan-gratuit/v1/requests/route.ts` — create/resume current request.
- `app/api/bilan-gratuit/v1/requests/current/route.ts` — safe request projection.
- `app/api/bilan-gratuit/v1/requests/current/child/route.ts` — authenticated child attach/create.
- `app/api/bilan-gratuit/v1/requests/current/assessment/route.ts` — sanitized question delivery.
- `app/api/bilan-gratuit/v1/requests/current/answers/route.ts` — autosave.
- `app/api/bilan-gratuit/v1/requests/current/submit/route.ts` — immutable submission.
- `app/api/bilan-gratuit/v1/requests/current/result/route.ts` — family-safe provisional result.
- `app/auth/bilan-magic/page.tsx` — consume fragment token, authenticate, strip token and resume.
- `app/bilan-gratuit/BilanStrategiqueClient.tsx` — progressive parent/child/needs flow.
- `app/bilan-gratuit/assessment/page.tsx` — request-bound canonical runner.
- `app/bilan-gratuit/resultat/page.tsx` — provisional result and review state.
- `app/bilan-gratuit/confirmation/page.tsx` — exact next-step messaging.
- `components/bilans/public/BilanIntakeWizard.tsx` — focused accessible intake steps.
- `components/bilans/public/CanonicalAssessmentRunner.tsx` — autosaving canonical assessment UI.
- `components/bilans/public/ProvisionalBilanResult.tsx` — family-safe result.

### Pilot content, scoring and reports

- `content/bilans/maths-terminale-spe-2026-2027/manifest.ts` — official metadata, checksums and review state.
- `content/bilans/maths-terminale-spe-2026-2027/review-decision.json` — owner-controlled pedagogical approval; starts unapproved.
- `lib/bilans/catalog/fixtures/maths-terminale-spe-2026-2027.ts` — server-only canonical pack adapter.
- `lib/bilans/catalog/public-question-dto.ts` — strips solutions, explanations and weights.
- `lib/bilans/scoring/score-canonical-attempt.ts` — deterministic mastery/coverage/evidence scoring.
- `lib/bilans/reports/render-deterministic-report.ts` — three audience-specific deterministic projections.
- `lib/bilans/reports/create-report-revisions.ts` — immutable per-audience revision persistence.
- `lib/bilans/reports/review-report.ts` — coach/admin review and explicit audience publication.

### Durable processing and team workspace

- `lib/bilans/jobs/claim.ts` — CAS lease/heartbeat/retry helpers.
- `lib/bilans/jobs/process.ts` — score and report processors.
- `lib/bilans/notifications/enqueue.ts` — transactional notification projections.
- `lib/bilans/notifications/deliver-email.ts` — minimized staff email delivery.
- `lib/bilans/notifications/templates.ts` — parent and team templates.
- `services/bilans-worker/index.ts` — durable job and email-outbox loop.
- `services/bilans-worker/Dockerfile` — isolated worker image.
- `app/api/bilans/v1/team/requests/route.ts` — paginated team list.
- `app/api/bilans/v1/team/requests/[requestId]/route.ts` — role-projected dossier.
- `app/api/bilans/v1/team/requests/[requestId]/assign/route.ts` — admin/assistante assignment.
- `app/api/bilans/v1/team/requests/[requestId]/review/route.ts` — coach/admin review.
- `app/api/bilans/v1/team/events/route.ts` — authenticated resumable SSE.
- `components/dashboard/bilans/BilanRequestsWorkspace.tsx` — shared filters, counters and timeline.
- `components/dashboard/bilans/BilanRequestReview.tsx` — deterministic result and review controls.
- `app/dashboard/admin/bilans/page.tsx` — admin workspace shell.
- `app/dashboard/assistante/bilans/page.tsx` — operational workspace shell.
- `app/dashboard/coach/bilans/page.tsx` — assignment-scoped review shell.
- `components/navigation/navigation-config.ts` — role-specific links.

### Verification and operations

- `e2e/auth/bilan-gratuit-flow.spec.ts` — replacement public account/assessment flow.
- `e2e/auth/bilan-team-review.spec.ts` — team review and publication.
- `docs/audits/2026-07-29-bilan-gratuit-canonical-go-live.md` — factual audit and verification report.
- `docs/runbooks/BILAN_GRATUIT_CANONICAL_RUNBOOK.md` — flags, migration, worker, incident and rollback.
- `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml` — fail-closed configuration and worker.

## Chunk 1: P0 hardening and canonical request foundation

### Task 1: Close the live account-enumeration and lost-notification defects

**Files:**
- Modify: `app/api/bilan-gratuit/route.ts`
- Modify: `__tests__/api/bilan-gratuit.test.ts`
- Modify: `lib/email.ts`
- Reference only: commit `bbe65d3f6718e200d671fd44dd964c8a7bc19ac5`

- [ ] **Step 1: Add failing compatibility-route tests.**

Add tests proving:

```ts
expect(existingResponse.status).toBe(newResponse.status);
expect(await existingResponse.json()).toEqual(await newResponse.json());
expect(existingResponse.headers.get('set-cookie')).toBe(newResponse.headers.get('set-cookie'));
expect(existingBody).not.toHaveProperty('parentId');
expect(existingBody).not.toHaveProperty('studentId');
expect(mockCaptureContactLead).toHaveBeenCalledTimes(1);
expect(JSON.stringify(mockCaptureContactLead.mock.calls[0][0]))
  .not.toContain(validRequestData.studentFirstName);
```

Cover new account, existing account, transaction failure, invalid Zod payload and honeypot. Only genuine validated submissions notify staff; validation failures and bots do not.

- [ ] **Step 2: Run the tests and verify the current leak.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/api/bilan-gratuit.test.ts --runInBand
```

Expected: FAIL because an existing account returns 400 with an account-specific error and successful responses expose database IDs.

- [ ] **Step 3: Implement the narrow compatibility hardening.**

Use one constant public body:

```ts
const GENERIC_SUCCESS = {
  success: true,
  message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
} as const;
```

Return that body and HTTP 200 for both valid existing and new-account paths. Remove parent/student IDs from the public response. Reuse `captureContactLead` for the three genuine outcomes with parent contact only; do not include minor name, school, level or answers. Send an existing-account continuation email without saying that a duplicate was rejected. Do not copy the branch wholesale; keep current campaign boundary behavior and current user changes intact.

- [ ] **Step 4: Re-run the focused tests and typecheck.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/api/bilan-gratuit.test.ts --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit only the interim hardening.**

```bash
git add app/api/bilan-gratuit/route.ts __tests__/api/bilan-gratuit.test.ts lib/email.ts
git commit -m "fix(bilan-gratuit): neutralize account lookup and notify staff"
```

### Task 2: Define request, verification and event contracts

**Files:**
- Create: `lib/bilans/requests/types.ts`
- Create: `lib/bilans/requests/schemas.ts`
- Create: `lib/bilans/requests/state-machine.ts`
- Create: `lib/bilans/requests/feature-flags.ts`
- Test: `__tests__/lib/bilans/requests/state-machine.test.ts`
- Test: `__tests__/lib/bilans/requests/schemas.test.ts`
- Test: `__tests__/lib/bilans/requests/feature-flags.test.ts`

- [ ] **Step 1: Write failing contract tests.**

The transition table must include:

```ts
expect(transition('NEW', 'READY_FOR_ASSESSMENT', 'SYSTEM')).toBeDefined();
expect(transition('READY_FOR_ASSESSMENT', 'ASSESSMENT_IN_PROGRESS', 'PARENT_FLOW')).toBeDefined();
expect(transition('ASSESSMENT_SUBMITTED', 'SCORED', 'WORKER')).toBeDefined();
expect(transition('REVIEW_PENDING', 'PUBLISHED', 'ASSISTANTE')).toBeUndefined();
expect(transition('REVIEW_PENDING', 'PUBLISHED', 'COACH')).toBeDefined();
expect(transition('REVIEW_PENDING', 'PUBLISHED', 'ADMIN')).toBeDefined();
```

Schemas must reject unknown keys, false consent, invalid phone/email, oversized free text and unrecognized school-year/grade/subject values. Feature flags default to false in production and tests unless explicitly set.

- [ ] **Step 2: Run tests and confirm missing modules.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/requests/state-machine.test.ts \
  __tests__/lib/bilans/requests/schemas.test.ts \
  __tests__/lib/bilans/requests/feature-flags.test.ts \
  --runInBand
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement minimal typed contracts.**

Define separate types:

```ts
type AccountVerificationState = 'UNVERIFIED' | 'VERIFICATION_PENDING' | 'VERIFIED';
type BilanRequestStatus =
  | 'NEW'
  | 'READY_FOR_ASSESSMENT'
  | 'ASSESSMENT_IN_PROGRESS'
  | 'ASSESSMENT_SUBMITTED'
  | 'SCORED'
  | 'REVIEW_PENDING'
  | 'PUBLISHED'
  | 'HUMAN_FOLLOWUP_REQUIRED'
  | 'TECHNICAL_ACTION_REQUIRED'
  | 'CANCELLED';
```

Do not derive account verification from request status. Implement the five environment flags from the design with exact string parsing (`'1'` or `'true'`) and no public/client export.

- [ ] **Step 4: Run contract tests and typecheck.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/requests --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the contracts.**

```bash
git add lib/bilans/requests __tests__/lib/bilans/requests
git commit -m "feat(bilans): define free assessment request contracts"
```

### Task 3: Add additive request, session, magic-link and audience persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260729_add_canonical_bilan_requests/migration.sql`
- Test: `__tests__/db/bilan-request-schema.test.ts`
- Modify: `__tests__/db/canonical-bilans-schema.test.ts`

- [ ] **Step 1: Write failing schema and real-database integrity tests.**

Test the following invariants:

```ts
await expect(createRequestWithSameSubmissionHashTwice()).rejects.toMatchObject({ code: 'P2002' });
await expect(createTwoFlowSessionsWithSameTokenHash()).rejects.toMatchObject({ code: 'P2002' });
await expect(createTwoActiveLinksForSameParentStudent()).rejects.toMatchObject({ code: 'P2002' });
await expect(createTwoArtifactsForSameAttemptAudience()).rejects.toMatchObject({ code: 'P2002' });
await expect(createParentPublicationFromNexusRevision()).rejects.toBeDefined();
await expect(createNotificationWithoutRecipient()).rejects.toBeDefined();
```

Assert no legacy table or column is removed.

- [ ] **Step 2: Run against the disposable test database and verify failure.**

Run:

```bash
npm run test:db:setup
npx jest --config jest.config.db.js \
  __tests__/db/bilan-request-schema.test.ts \
  __tests__/db/canonical-bilans-schema.test.ts \
  --runInBand
```

Expected: FAIL because request/session/audience models are absent. Never point this command at production.

- [ ] **Step 3: Implement additive Prisma and SQL contracts.**

Add:

```prisma
model BilanRequest { ... }
model BilanRequestEvent { ... }
model BilanFlowSession { tokenHash String @unique ... }
model BilanMagicLink { tokenHash String @unique ... }
enum ReportAudience { STUDENT PARENT NEXUS }
```

Extend canonical notification events with `BILAN_REQUEST_CREATED`, `ASSESSMENT_SUBMITTED` and `TECHNICAL_ACTION_REQUIRED`; extend `NotificationChannel` with `EMAIL`. Replace nullable-recipient ambiguity with a non-null `recipientKey`, optional `recipientUserId`, optional `recipientAddress`, and a SQL check requiring the correct destination for the selected channel. Add the unique key `(eventType, sourceEventKey, recipientKey)`.

Add `ReportArtifact.audience` and unique `(assessmentAttemptId, audience)`. Add SQL checks ensuring `currentPublishedRevisionId` points to the same artifact; audience separation is enforced by artifact ownership, not a client filter. Preserve all existing rows with a reviewed data-safe default and document the default in the migration.

Add a partial unique index for non-revoked/non-expired parent-student links if the existing canonical migration does not already provide it. Do not rely only on Prisma schema syntax for partial uniqueness.

- [ ] **Step 4: Generate, migrate and re-run integrity tests.**

Run:

```bash
npx prisma format
npx prisma generate
npx prisma migrate deploy
npx jest --config jest.config.db.js \
  __tests__/db/bilan-request-schema.test.ts \
  __tests__/db/canonical-bilans-schema.test.ts \
  --runInBand
```

Expected: PASS on a fresh DB and on an upgrade DB seeded with a legacy Bilan/Assessment row.

- [ ] **Step 5: Commit schema, SQL and tests together.**

```bash
git add prisma/schema.prisma prisma/migrations/20260729_add_canonical_bilan_requests \
  __tests__/db/bilan-request-schema.test.ts __tests__/db/canonical-bilans-schema.test.ts
git commit -m "feat(bilans): persist requests sessions and audience projections"
```

### Task 4: Implement secure request and event access primitives

**Files:**
- Create: `lib/bilans/requests/tokens.ts`
- Create: `lib/bilans/requests/access.ts`
- Create: `lib/bilans/requests/events.ts`
- Test: `__tests__/lib/bilans/requests/tokens.test.ts`
- Test: `__tests__/lib/bilans/requests/access.test.ts`
- Test: `__tests__/lib/bilans/requests/events.test.ts`

- [ ] **Step 1: Write failing token, ownership and minimization tests.**

Cover raw token entropy, SHA-256 at rest, expiry, revocation, request scope, replay denial and role projection. Assert event payload JSON never contains email, phone, child name, school, free-text need or answers.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/requests \
  --testPathPattern='tokens|access|events' --runInBand
```

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the primitives.**

Use:

```ts
const raw = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
```

The cookie contract is `HttpOnly`, `SameSite=Lax`, `Secure` in production, path-scoped to `/bilan-gratuit`, and short-lived. Access helpers must query ownership in the database predicate; no post-fetch email/name comparison is allowed.

- [ ] **Step 4: Re-run tests and security scanners.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/requests --runInBand
npm run security:repo
```

Expected: PASS.

- [ ] **Step 5: Commit the primitives.**

```bash
git add lib/bilans/requests __tests__/lib/bilans/requests
git commit -m "feat(bilans): secure request sessions and audit events"
```

## Chunk 2: Account-first public intake and durable staff alerts

### Task 5: Create the idempotent new/existing-parent intake transaction

**Files:**
- Create: `lib/bilans/requests/create-request.ts`
- Create: `lib/bilans/requests/attach-child.ts`
- Test: `__tests__/lib/bilans/requests/create-request.test.ts`
- Test: `__tests__/integration/bilan-request-intake.real.test.ts`

- [ ] **Step 1: Write failing service and PostgreSQL tests.**

Prove:

- new email atomically creates parent, parent profile, non-PII child user, student, pending parent link, request, event, flow session, magic link and notification outbox;
- existing email creates a request/flow session/magic link but no duplicate user or child;
- both paths return the same public DTO and cookie contract;
- the same idempotency key returns the same request;
- transaction failure creates nothing;
- child internal email never includes first/last name;
- free-text needs are stored on the request but never copied into events/outbox.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/requests/create-request.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-request-intake.real.test.ts --runInBand
```

Expected: FAIL with missing service.

- [ ] **Step 3: Implement the transaction.**

Normalize email once. Hash the client idempotency key. For existing parents, associate the request internally but expose only request-bound newly supplied data through the flow session. For new parents, use an opaque internal child address such as `child+<cuid>@nexus-student.local`; never derive it from a minor's name.

Create the state event and outbox rows inside the same Prisma transaction. Return only:

```ts
{ success: true, message: GENERIC_SUCCESS_MESSAGE, next: 'ASSESSMENT_OR_EMAIL' }
```

The raw session and magic tokens are returned only to the route/email composition layer, never persisted.

- [ ] **Step 4: Re-run unit/integration tests.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/requests/create-request.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-request-intake.real.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the intake service.**

```bash
git add lib/bilans/requests/create-request.ts lib/bilans/requests/attach-child.ts \
  __tests__/lib/bilans/requests/create-request.test.ts \
  __tests__/integration/bilan-request-intake.real.test.ts
git commit -m "feat(bilans): create traceable parent and child requests"
```

### Task 6: Add parent magic-link authentication and resumption

**Files:**
- Modify: `auth.ts`
- Create: `lib/bilans/auth/consume-magic-link.ts`
- Create: `app/auth/bilan-magic/page.tsx`
- Create: `app/api/auth/bilan-magic/request/route.ts`
- Modify: `lib/bilans/notifications/templates.ts`
- Test: `__tests__/lib/bilans/auth/consume-magic-link.test.ts`
- Test: `__tests__/api/auth.bilan-magic.request.test.ts`
- Test: `__tests__/app/bilan-magic-page.test.tsx`

- [ ] **Step 1: Write failing auth tests.**

Test one-use consumption, expiry, hash-only lookup, concurrent replay, parent-only role, request resumption and generic request-link responses for missing/existing accounts. Assert the raw token is placed in the URL fragment, not query parameters.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/auth/consume-magic-link.test.ts \
  __tests__/api/auth.bilan-magic.request.test.ts \
  __tests__/app/bilan-magic-page.test.tsx \
  --runInBand
```

Expected: FAIL because the provider/service/page do not exist.

- [ ] **Step 3: Implement the Auth.js provider and consume service.**

Add a distinct credentials provider with ID `bilan-magic` accepting only a raw token. Its `authorize` delegates to a transaction that:

1. hashes the token;
2. atomically consumes one unexpired unused `BilanMagicLink`;
3. marks the parent verified/activated;
4. verifies the pending parent-student link when applicable;
5. records `ACCOUNT_VERIFIED`;
6. returns the safe parent user for the JWT session.

The email link uses `/auth/bilan-magic#token=<raw>`. The client reads the fragment, clears it immediately with `history.replaceState`, calls `signIn('bilan-magic', { redirect: false, token })`, then navigates to the request continuation. Apply `Referrer-Policy: no-referrer`.

- [ ] **Step 4: Re-run auth tests and existing credentials tests.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/auth/consume-magic-link.test.ts \
  __tests__/api/auth.bilan-magic.request.test.ts \
  __tests__/app/bilan-magic-page.test.tsx \
  __tests__/api/auth-workflows.test.ts \
  --runInBand
npm run typecheck
```

Expected: PASS; password login behavior is unchanged.

- [ ] **Step 5: Commit the magic-link path.**

```bash
git add auth.ts lib/bilans/auth app/auth/bilan-magic app/api/auth/bilan-magic \
  lib/bilans/notifications/templates.ts __tests__/lib/bilans/auth \
  __tests__/api/auth.bilan-magic.request.test.ts __tests__/app/bilan-magic-page.test.tsx
git commit -m "feat(auth): resume parent bilans with one-time magic links"
```

### Task 7: Expose the versioned intake and child APIs

**Files:**
- Modify: `app/api/bilan-gratuit/route.ts`
- Create: `app/api/bilan-gratuit/v1/requests/route.ts`
- Create: `app/api/bilan-gratuit/v1/requests/current/route.ts`
- Create: `app/api/bilan-gratuit/v1/requests/current/child/route.ts`
- Modify: `lib/rate-limit/index.ts`
- Test: `__tests__/api/bilan-gratuit.v1.requests.test.ts`
- Test: `__tests__/api/bilan-gratuit.v1.child.security.test.ts`
- Modify: `__tests__/api/public-rate-limit.coverage.test.ts`

- [ ] **Step 1: Write failing API and distributed-rate-limit tests.**

Test strict schemas, body size, CSRF, honeypot, generic public contracts, idempotency, current-request projection, temporary-session scope, verified parent child selection, cross-parent denial and unavailable distributed limiter behavior.

- [ ] **Step 2: Run and verify failures.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/api/bilan-gratuit.v1.requests.test.ts \
  __tests__/api/bilan-gratuit.v1.child.security.test.ts \
  __tests__/api/public-rate-limit.coverage.test.ts \
  --runInBand
```

Expected: FAIL because v1 routes and fail-closed distributed mode do not exist.

- [ ] **Step 3: Implement thin routes and fail-closed rate limiting.**

Add `requireDistributed?: boolean` to the async rate-limit options. When true in production and Redis/Upstash is unavailable, return a stable 503 rather than falling back to process memory. Use it on intake, magic-link request and submit endpoints.

The compatibility route delegates to v1 only when `BILAN_CANONICAL_INTAKE_ENABLED`; interim anti-enumeration remains unconditional when the flag is off. Current request GET returns only the request-bound public projection.

- [ ] **Step 4: Re-run route tests and typecheck.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/api/bilan-gratuit.v1.requests.test.ts \
  __tests__/api/bilan-gratuit.v1.child.security.test.ts \
  __tests__/api/public-rate-limit.coverage.test.ts \
  --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit API boundaries.**

```bash
git add app/api/bilan-gratuit lib/rate-limit/index.ts \
  __tests__/api/bilan-gratuit.v1.requests.test.ts \
  __tests__/api/bilan-gratuit.v1.child.security.test.ts \
  __tests__/api/public-rate-limit.coverage.test.ts
git commit -m "feat(bilans): expose secure canonical intake APIs"
```

### Task 8: Deliver durable staff email alerts

**Files:**
- Create: `lib/bilans/notifications/enqueue.ts`
- Create: `lib/bilans/notifications/claim.ts`
- Create: `lib/bilans/notifications/deliver-email.ts`
- Create: `lib/bilans/notifications/templates.ts`
- Create: `services/bilans-worker/index.ts`
- Create: `services/bilans-worker/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`
- Test: `__tests__/lib/bilans/notifications/outbox.test.ts`
- Test: `__tests__/integration/bilan-notification-worker.real.test.ts`

- [ ] **Step 1: Write failing outbox/worker tests.**

Cover lease ownership, expired lease recovery, retry/backoff, idempotent delivery, PII-minimized staff templates, missing-recipient terminal failure and email provider failure. New request, submitted diagnostic and technical action must be the only staff email triggers.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/notifications/outbox.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-notification-worker.real.test.ts --runInBand
```

Expected: FAIL with missing worker modules.

- [ ] **Step 3: Implement the durable email loop.**

Use PostgreSQL outbox as the source of truth. Claim with compare-and-set and a lease expiry; never select then blindly update. Payloads contain request/event IDs and template variables only. Resolve `BILAN_TEAM_NOTIFICATION_EMAIL` with fallback to `pedagogie@nexusreussite.academy`. Do not log addresses or provider payloads.

Add the worker health behavior and Compose service, but do not start or deploy production services.

- [ ] **Step 4: Run worker tests and Compose validation.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/notifications/outbox.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-notification-worker.real.test.ts --runInBand
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: PASS.

- [ ] **Step 5: Commit alerts and worker.**

```bash
git add lib/bilans/notifications services/bilans-worker docker-compose.yml \
  docker-compose.prod.yml .env.example __tests__/lib/bilans/notifications \
  __tests__/integration/bilan-notification-worker.real.test.ts
git commit -m "feat(bilans): deliver durable real-time staff alerts"
```

### Task 9: Replace the long public page with an accessible progressive intake

**Files:**
- Create: `components/bilans/public/BilanIntakeWizard.tsx`
- Modify: `app/bilan-gratuit/BilanStrategiqueClient.tsx`
- Modify: `app/bilan-gratuit/page.tsx`
- Modify: `app/bilan-gratuit/confirmation/page.tsx`
- Modify: `__tests__/lib/bilan-gratuit-form.test.tsx`
- Test: `__tests__/components/bilans/BilanIntakeWizard.test.tsx`

- [ ] **Step 1: Write failing component tests.**

Test one visible step at a time, keyboard progression, server errors, idempotency key reuse, authenticated child selection, new child flow, unsupported subject handoff, no password field, no competing callback form and persistent WhatsApp/phone escape.

- [ ] **Step 2: Run tests and verify the existing single long form fails them.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/components/bilans/BilanIntakeWizard.test.tsx \
  __tests__/lib/bilan-gratuit-form.test.tsx \
  --runInBand
```

Expected: FAIL because the wizard does not exist and the page renders competing forms.

- [ ] **Step 3: Implement the focused wizard.**

Keep the existing luxury tokens and hero. Move form state into the focused component; do not introduce a new palette. Remove the callback form from this page only. Use `aria-live` for errors and progress, focus the first invalid field, preserve fields when navigating back and use the server-provided next action.

Do not touch the user's pre-existing `CorporateNavbar` changes.

- [ ] **Step 4: Re-run component tests and render smoke.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/components/bilans/BilanIntakeWizard.test.tsx \
  __tests__/lib/bilan-gratuit-form.test.tsx \
  --runInBand
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the intake UI.**

```bash
git add components/bilans/public/BilanIntakeWizard.tsx app/bilan-gratuit \
  __tests__/components/bilans/BilanIntakeWizard.test.tsx \
  __tests__/lib/bilan-gratuit-form.test.tsx
git commit -m "feat(bilan-gratuit): add resumable parent and child intake"
```

## Chunk 3: Review-gated Terminale Maths canonical diagnostic

### Task 10: Build the official, review-gated pilot pack

**Files:**
- Create: `content/bilans/maths-terminale-spe-2026-2027/manifest.ts`
- Create: `content/bilans/maths-terminale-spe-2026-2027/review-decision.json`
- Create: `lib/bilans/catalog/fixtures/maths-terminale-spe-2026-2027.ts`
- Modify: `lib/bilans/catalog/service.ts`
- Test: `__tests__/lib/bilans/catalog/maths-terminale-spe-2026-2027.test.ts`
- Reference: `lib/data/assessments/maths_terminale_spe_v1.ts`

- [ ] **Step 1: Write failing pack-gate and golden metadata tests.**

Test exact school year, grade, subject/specialty, official HTTPS source, source checksum, competency/question coverage, reviewer identity/date, golden set and feature flag. Assert the initial unapproved decision resolves to `PACK_NOT_PUBLISHED`.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/catalog/maths-terminale-spe-2026-2027.test.ts \
  --runInBand
```

Expected: FAIL with missing pack.

- [ ] **Step 3: Implement the server-only pack and review artifact.**

Reuse question content only after mapping every item to a competency and the verified 2026/2027 programme. Keep `review-decision.json` as:

```json
{
  "status": "REVIEW_REQUIRED",
  "reviewer": null,
  "reviewedAt": null,
  "evidenceChecksum": null
}
```

Do not fabricate approval or change the status to `PUBLISHED`. Produce a pedagogical review checklist and golden fixture so the named reviewer can approve later in one auditable change.

- [ ] **Step 4: Re-run tests.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/catalog/maths-terminale-spe-2026-2027.test.ts \
  __tests__/lib/bilans/catalog/service.test.ts \
  --runInBand
```

Expected: PASS with the pack blocked pending review.

- [ ] **Step 5: Commit the gated content.**

```bash
git add content/bilans/maths-terminale-spe-2026-2027 \
  lib/bilans/catalog/fixtures/maths-terminale-spe-2026-2027.ts \
  lib/bilans/catalog/service.ts \
  __tests__/lib/bilans/catalog/maths-terminale-spe-2026-2027.test.ts
git commit -m "feat(bilans): prepare review-gated Terminale Maths pack"
```

### Task 11: Prove that correct answers cannot reach the client

**Files:**
- Create: `lib/bilans/catalog/public-question-dto.ts`
- Create: `app/api/bilan-gratuit/v1/requests/current/assessment/route.ts`
- Test: `__tests__/lib/bilans/catalog/public-question-dto.test.ts`
- Test: `__tests__/api/bilan-assessment.questions.security.test.ts`
- Modify: `__tests__/architecture/site-architecture-guards.test.ts`

- [ ] **Step 1: Write failing DTO, route and bundle-boundary tests.**

Recursively scan serialized question responses for `isCorrect`, `correctAnswer`, `explanation`, `weight`, `competencies`, `solution` and server pack imports. Test request-token scope and wrong-request denial.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/catalog/public-question-dto.test.ts \
  __tests__/api/bilan-assessment.questions.security.test.ts \
  __tests__/architecture/site-architecture-guards.test.ts \
  --runInBand
```

Expected: FAIL because no canonical DTO boundary exists.

- [ ] **Step 3: Implement server-only resolution and sanitized DTOs.**

The route resolves the request and eligible published pack server-side, then maps to:

```ts
type PublicQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  position: number;
};
```

Mark pack modules `server-only`; client components may import only DTO types.

- [ ] **Step 4: Re-run security tests and inspect the production build manifest later in Task 18.**

Run the same focused Jest command. Expected: PASS.

- [ ] **Step 5: Commit the question boundary.**

```bash
git add lib/bilans/catalog/public-question-dto.ts \
  app/api/bilan-gratuit/v1/requests/current/assessment/route.ts \
  __tests__/lib/bilans/catalog/public-question-dto.test.ts \
  __tests__/api/bilan-assessment.questions.security.test.ts \
  __tests__/architecture/site-architecture-guards.test.ts
git commit -m "fix(bilans): keep assessment solutions server-only"
```

### Task 12: Add immutable autosave and submission

**Files:**
- Create: `lib/bilans/attempts/create-attempt.ts`
- Create: `lib/bilans/attempts/autosave-attempt.ts`
- Create: `lib/bilans/attempts/submit-attempt.ts`
- Create: `app/api/bilan-gratuit/v1/requests/current/answers/route.ts`
- Create: `app/api/bilan-gratuit/v1/requests/current/submit/route.ts`
- Test: `__tests__/lib/bilans/attempts/lifecycle.test.ts`
- Test: `__tests__/integration/bilan-attempt-lifecycle.real.test.ts`

- [ ] **Step 1: Write failing lifecycle and concurrency tests.**

Cover draft creation, bounded autosave, four answer statuses, no mutation after submit, duplicate submit idempotence, attempt/request ownership, pack/version sealing and transactionally created `SCORE_ATTEMPT` job plus `ASSESSMENT_SUBMITTED` events/outbox.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/attempts/lifecycle.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-attempt-lifecycle.real.test.ts --runInBand
```

Expected: FAIL with missing services/routes.

- [ ] **Step 3: Implement minimal lifecycle services and thin routes.**

Parse JSON fields with Zod on every read/write. Autosave updates only `DRAFT`/`IN_PROGRESS`; submit uses a guarded `updateMany`/transaction and seals curriculum, assessment and scoring versions/checksum. Never call scoring or report generation from the HTTP request.

- [ ] **Step 4: Re-run lifecycle tests.**

Run the two commands from Step 2. Expected: PASS.

- [ ] **Step 5: Commit lifecycle code.**

```bash
git add lib/bilans/attempts app/api/bilan-gratuit/v1/requests/current \
  __tests__/lib/bilans/attempts __tests__/integration/bilan-attempt-lifecycle.real.test.ts
git commit -m "feat(bilans): autosave and seal canonical attempts"
```

### Task 13: Implement deterministic mastery, coverage and evidence scoring

**Files:**
- Create: `lib/bilans/scoring/score-canonical-attempt.ts`
- Create: `__tests__/fixtures/bilans/maths-terminale-golden.ts`
- Test: `__tests__/lib/bilans/scoring/score-canonical-attempt.test.ts`
- Test: `__tests__/integration/bilan-scoring-persistence.real.test.ts`

- [ ] **Step 1: Write failing golden/property tests.**

Test identical input reproducibility, score bounds, domain coverage, evidence links and explicit answer semantics:

```ts
expect(scoreOf('NOT_STUDIED')).not.toEqual(scoreOf('INCORRECT'));
expect(scoreOf('DONT_KNOW')).not.toEqual(scoreOf('INCORRECT'));
expect(result.coverage).toBeLessThanOrEqual(100);
expect(result.evidence.every((item) => item.sourceKey)).toBe(true);
```

An invalid scoring output must persist nothing and move the request to technical action.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/lib/bilans/scoring/score-canonical-attempt.test.ts --runInBand
npx jest --config jest.integration.config.js \
  __tests__/integration/bilan-scoring-persistence.real.test.ts --runInBand
```

Expected: FAIL with missing scorer.

- [ ] **Step 3: Implement deterministic scoring and persistence.**

The pure scorer returns validated data only. The persistence service writes one immutable `ScoreSnapshot`, its `EvidenceItem` rows, the request transition/event and `GENERATE_REPORT` outbox in one transaction. Zod validation failure is fail-closed.

- [ ] **Step 4: Re-run golden and persistence tests.**

Run Step 2 commands. Expected: PASS.

- [ ] **Step 5: Commit scoring.**

```bash
git add lib/bilans/scoring __tests__/fixtures/bilans \
  __tests__/lib/bilans/scoring __tests__/integration/bilan-scoring-persistence.real.test.ts
git commit -m "feat(bilans): score canonical attempts with evidence"
```

### Task 14: Generate and review audience-separated deterministic reports

**Files:**
- Create: `lib/bilans/reports/render-deterministic-report.ts`
- Create: `lib/bilans/reports/create-report-revisions.ts`
- Create: `lib/bilans/reports/review-report.ts`
- Test: `__tests__/lib/bilans/reports/render-deterministic-report.test.ts`
- Test: `__tests__/lib/bilans/reports/review-report.test.ts`
- Test: `__tests__/integration/bilan-report-publication.real.test.ts`

- [ ] **Step 1: Write failing projection and publication tests.**

Assert each artifact has one audience, parent output excludes Nexus evidence internals, student output excludes parent contact/commercial notes, Nexus has no family read route, assistante cannot approve, unassigned coach cannot approve, admin can approve and an unverified parent cannot receive publication.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/reports --runInBand
npx jest --config jest.integration.config.js \
  __tests__/integration/bilan-report-publication.real.test.ts --runInBand
```

Expected: FAIL with missing services.

- [ ] **Step 3: Implement deterministic revisions and explicit publication.**

Generate three separate artifacts/revisions from the immutable score snapshot. Review records a precise revision and motif. Publication updates only the matching artifact pointer and creates its event/outbox transactionally. Do not enable LLM enrichment in this plan; leave the flag false and the interface injectable.

- [ ] **Step 4: Re-run report tests.**

Run Step 2 commands. Expected: PASS.

- [ ] **Step 5: Commit reports.**

```bash
git add lib/bilans/reports __tests__/lib/bilans/reports \
  __tests__/integration/bilan-report-publication.real.test.ts
git commit -m "feat(bilans): publish reviewed audience-safe reports"
```

### Task 15: Process scoring and reports durably

**Files:**
- Create: `lib/bilans/jobs/claim.ts`
- Create: `lib/bilans/jobs/process.ts`
- Modify: `services/bilans-worker/index.ts`
- Test: `__tests__/lib/bilans/jobs/claim.test.ts`
- Test: `__tests__/integration/bilan-worker-crash-recovery.real.test.ts`

- [ ] **Step 1: Write failing two-worker and crash-recovery tests.**

Test one winner for concurrent claims, heartbeat/lease expiry, duplicate delivery, bounded retries, scoring failure, report fallback and terminal intervention state.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/lib/bilans/jobs/claim.test.ts --runInBand
npx jest --config jest.integration.config.js \
  __tests__/integration/bilan-worker-crash-recovery.real.test.ts --runInBand
```

Expected: FAIL with missing processors.

- [ ] **Step 3: Implement the worker registry.**

Dispatch only supported canonical job types. Processors are idempotent against immutable aggregate/version keys. A worker crash leaves a leased row recoverable after expiry. After the configured attempts, create `TECHNICAL_ACTION_REQUIRED` and the staff notification; never lose the score already created.

- [ ] **Step 4: Re-run worker recovery tests.**

Run Step 2 commands. Expected: PASS.

- [ ] **Step 5: Commit processing.**

```bash
git add lib/bilans/jobs services/bilans-worker/index.ts \
  __tests__/lib/bilans/jobs __tests__/integration/bilan-worker-crash-recovery.real.test.ts
git commit -m "feat(bilans): process scoring and reports durably"
```

### Task 16: Add the canonical assessment and provisional-result UI

**Files:**
- Create: `components/bilans/public/CanonicalAssessmentRunner.tsx`
- Create: `components/bilans/public/ProvisionalBilanResult.tsx`
- Modify: `app/bilan-gratuit/assessment/page.tsx`
- Create: `app/bilan-gratuit/resultat/page.tsx`
- Create: `app/api/bilan-gratuit/v1/requests/current/result/route.ts`
- Test: `__tests__/components/bilans/CanonicalAssessmentRunner.test.tsx`
- Test: `__tests__/components/bilans/ProvisionalBilanResult.test.tsx`
- Test: `__tests__/api/bilan-provisional-result.security.test.ts`

- [ ] **Step 1: Write failing UI and projection tests.**

Cover progress, autosave debounce, retry, offline warning, four response statuses, resume, immutable submit, pending scoring, family DTO only and final-report gating.

- [ ] **Step 2: Run tests and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/components/bilans/CanonicalAssessmentRunner.test.tsx \
  __tests__/components/bilans/ProvisionalBilanResult.test.tsx \
  __tests__/api/bilan-provisional-result.security.test.ts \
  --runInBand
```

Expected: FAIL with missing components/route.

- [ ] **Step 3: Implement the focused runner and result.**

Use server DTOs only. Do not reuse `AssessmentRunner` because it belongs to the legacy public-identity contract. The result route accepts either the exact flow session for the current request or a verified owning parent and always returns `Cache-Control: private, no-store`.

- [ ] **Step 4: Re-run UI/security tests.**

Run Step 2 command and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit assessment UI.**

```bash
git add components/bilans/public app/bilan-gratuit/assessment \
  app/bilan-gratuit/resultat app/api/bilan-gratuit/v1/requests/current/result \
  __tests__/components/bilans __tests__/api/bilan-provisional-result.security.test.ts
git commit -m "feat(bilan-gratuit): run and resume canonical diagnostics"
```

## Chunk 4: Team operations, realtime, end-to-end gates and runbook

### Task 17: Expose role-safe team list, detail, assignment and review APIs

**Files:**
- Create: `app/api/bilans/v1/team/requests/route.ts`
- Create: `app/api/bilans/v1/team/requests/[requestId]/route.ts`
- Create: `app/api/bilans/v1/team/requests/[requestId]/assign/route.ts`
- Create: `app/api/bilans/v1/team/requests/[requestId]/review/route.ts`
- Test: `__tests__/api/bilan-team-requests.security.test.ts`
- Test: `__tests__/integration/bilan-team-workflow.real.test.ts`

- [ ] **Step 1: Write failing RBAC/IDOR and pagination tests.**

Test:

- admin sees all;
- assistante sees operational fields but no internal report content/answers;
- coach sees only active assignments;
- assistante/admin can assign;
- only assigned coach/admin can review/publish;
- filters are strict, paginated and bounded;
- all forbidden/not-owned IDs return the same 404 projection.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js __tests__/api/bilan-team-requests.security.test.ts --runInBand
npx jest --config jest.integration.config.js __tests__/integration/bilan-team-workflow.real.test.ts --runInBand
```

Expected: FAIL with missing routes.

- [ ] **Step 3: Implement thin routes over domain services.**

Use `requireAnyRole`, strict Zod query/body schemas and Prisma ownership predicates. The API never returns raw answers to assistante, never returns Nexus projection to family and never accepts actor IDs from the client.

- [ ] **Step 4: Re-run security and DB tests.**

Run Step 2 commands. Expected: PASS.

- [ ] **Step 5: Commit team APIs.**

```bash
git add app/api/bilans/v1/team __tests__/api/bilan-team-requests.security.test.ts \
  __tests__/integration/bilan-team-workflow.real.test.ts
git commit -m "feat(bilans): expose role-safe team workflows"
```

### Task 18: Add authenticated resumable realtime events with polling fallback

**Files:**
- Create: `app/api/bilans/v1/team/events/route.ts`
- Create: `lib/bilans/requests/team-event-projection.ts`
- Test: `__tests__/api/bilan-team-events.stream.test.ts`
- Test: `__tests__/lib/bilans/requests/team-event-projection.test.ts`

- [ ] **Step 1: Write failing stream tests.**

Cover unauthenticated/parent denial, role projections, `Last-Event-ID`, heartbeat, finite connection lifetime, reconnect, no PII, flag-off behavior and polling equivalence.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/api/bilan-team-events.stream.test.ts \
  __tests__/lib/bilans/requests/team-event-projection.test.ts \
  --runInBand
```

Expected: FAIL with missing route/projection.

- [ ] **Step 3: Implement bounded SSE.**

Authenticate inside the route. Query only events accessible to the role, send opaque event IDs, heartbeat comments and close after a bounded interval so the browser reconnects. Honor `Last-Event-ID`; never keep an unbounded database cursor. When the flag is off, return 404.

- [ ] **Step 4: Re-run stream tests.**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit realtime events.**

```bash
git add app/api/bilans/v1/team/events lib/bilans/requests/team-event-projection.ts \
  __tests__/api/bilan-team-events.stream.test.ts \
  __tests__/lib/bilans/requests/team-event-projection.test.ts
git commit -m "feat(bilans): stream role-safe dossier events"
```

### Task 19: Build the shared team workspace and role navigation

**Files:**
- Create: `components/dashboard/bilans/BilanRequestsWorkspace.tsx`
- Create: `components/dashboard/bilans/BilanRequestReview.tsx`
- Create: `app/dashboard/admin/bilans/page.tsx`
- Create: `app/dashboard/assistante/bilans/page.tsx`
- Create: `app/dashboard/coach/bilans/page.tsx`
- Modify: `components/navigation/navigation-config.ts`
- Test: `__tests__/components/dashboard/bilans/BilanRequestsWorkspace.test.tsx`
- Test: `__tests__/components/navigation/bilans-nav.test.ts`

- [ ] **Step 1: Write failing workspace and navigation tests.**

Cover counters, filters, assignment, timeline, reconnect/poll fallback, action visibility by role, review motif, error state and responsive tables/cards.

- [ ] **Step 2: Run and verify failure.**

Run:

```bash
npx jest --config jest.unit.config.js \
  __tests__/components/dashboard/bilans/BilanRequestsWorkspace.test.tsx \
  __tests__/components/navigation/bilans-nav.test.ts \
  --runInBand
```

Expected: FAIL with missing workspace/pages/nav links.

- [ ] **Step 3: Implement shared components and thin page shells.**

Use the existing dashboard visual language. Admin receives review controls; assistante receives assignment/retry controls only; coach controls are assignment-scoped. Reuse one component with server-provided capabilities rather than branching on client-supplied role strings.

- [ ] **Step 4: Re-run component/navigation tests and typecheck.**

Run Step 2 command and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit team UI.**

```bash
git add components/dashboard/bilans app/dashboard/admin/bilans \
  app/dashboard/assistante/bilans app/dashboard/coach/bilans \
  components/navigation/navigation-config.ts \
  __tests__/components/dashboard/bilans __tests__/components/navigation/bilans-nav.test.ts
git commit -m "feat(bilans): add realtime team dossier workspace"
```

### Task 20: Replace skipped E2E coverage with real public and team workflows

**Files:**
- Replace: `e2e/auth/bilan-gratuit-flow.spec.ts`
- Create: `e2e/auth/bilan-team-review.spec.ts`
- Modify: `playwright.config.e2e.ts`
- Modify: `scripts/setup-e2e-db.sh`
- Test fixtures: `e2e/fixtures/bilan.ts`

- [ ] **Step 1: Write E2E scenarios before enabling implementation flags.**

Scenarios:

1. new parent creates child, immediately starts, autosaves and resumes;
2. existing parent receives indistinguishable response and starts only the new request;
3. magic link verifies/authenticates and attaches the request;
4. multiple children are isolated;
5. unsupported subject enters human follow-up;
6. Terminale Maths produces a provisional result when the reviewed fixture pack is enabled in E2E only;
7. assistante assigns but cannot publish;
8. assigned coach or admin reviews/publishes;
9. parent reads only parent publication;
10. mobile has no horizontal overflow and keyboard progression works.

- [ ] **Step 2: Run syntax and focused E2E; confirm failures are meaningful.**

Run:

```bash
npm run check:e2e-syntax
npx playwright test --config playwright.config.e2e.ts \
  e2e/auth/bilan-gratuit-flow.spec.ts \
  e2e/auth/bilan-team-review.spec.ts
```

Expected: tests fail until fixtures/routes/UI are fully wired; no test is skipped.

- [ ] **Step 3: Add deterministic E2E seed/flags and finish selectors.**

Enable the pack only with an E2E-specific reviewed fixture; never mutate the production review decision. Seed parent/admin/assistante/coach assignment data. Use roles/labels and stable `data-testid` only when semantic selectors are insufficient.

- [ ] **Step 4: Re-run headed desktop/mobile and ephemeral stack.**

Run:

```bash
npm run check:e2e-syntax
npm run test:e2e:ephemeral
```

Expected: PASS for public and team workflows, with no skipped Bilan tests.

- [ ] **Step 5: Commit E2E coverage.**

```bash
git add e2e/auth/bilan-gratuit-flow.spec.ts e2e/auth/bilan-team-review.spec.ts \
  e2e/fixtures/bilan.ts playwright.config.e2e.ts scripts/setup-e2e-db.sh
git commit -m "test(bilans): cover account assessment review and publication"
```

### Task 21: Complete security, build, production-artifact and public-render gates

**Files:**
- Modify as findings require: only files in this plan's scope.
- Create: `__tests__/security/bilan-client-bundle.test.ts`
- Update: `__tests__/architecture/site-architecture-guards.test.ts`

- [ ] **Step 1: Run focused suites and fix only new failures.**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/api/bilan-gratuit.test.ts \
  __tests__/api/bilan-gratuit.v1.requests.test.ts \
  __tests__/api/bilan-team-requests.security.test.ts \
  __tests__/lib/bilans \
  __tests__/components/bilans \
  __tests__/components/dashboard/bilans
```

Expected: PASS.

- [ ] **Step 2: Run repository quality gates.**

Run:

```bash
npm run lint
npm run typecheck
npm run test -- --runInBand
npm run test:integration
npm run security:repo
```

Expected: PASS, except any proven pre-existing failure must be recorded with its baseline evidence and must not be worsened.

- [ ] **Step 3: Run database and build gates.**

Run:

```bash
npm run test:db:full
npm run build
npm run artifact:traces
npm run artifact:audit
```

Expected: PASS; no correct-answer marker exists in public chunks or standalone artifacts.

- [ ] **Step 4: Run local production rendering with Playwright.**

Use an ephemeral production stack, then verify `/bilan-gratuit`, assessment, result and the three team pages at 1440×1000, 768×1024 and 375×812. Check HTTP status, H1, focus, overflow, console errors and failed first-party requests.

Expected: no horizontal overflow, no PII in URL, no console error and exact role restrictions.

- [ ] **Step 5: Commit only verification-driven corrections.**

```bash
git add <only files changed to resolve verified failures>
git commit -m "fix(bilans): close canonical go-live verification findings"
```

### Task 22: Write the audit, runbook, retention gate and rollback proof

**Files:**
- Create: `docs/audits/2026-07-29-bilan-gratuit-canonical-go-live.md`
- Create: `docs/runbooks/BILAN_GRATUIT_CANONICAL_RUNBOOK.md`
- Modify: `.env.example`

- [ ] **Step 1: Draft the factual audit from executed evidence.**

Use the AGENTS.md audit structure:

```md
# Bilan gratuit canonique go-live
## Date
## Contexte
## Problèmes observés
## Décisions prises
## Fichiers modifiés
## Tests exécutés
## Résultats
## Risques restants
## Rollback
```

- [ ] **Step 2: Document exact flag, migration and worker procedures.**

The runbook must include initial read-only checks, backup/restore prerequisite, migration status, worker health, queue depth, retry/DLQ, canary, smoke, flag activation order and rollback without data deletion. Do not include production hostnames or secrets.

- [ ] **Step 3: Make retention an explicit owner gate.**

Document configuration points and purge dry-run commands for:

- unverified/abandoned requests;
- raw answers;
- events;
- reports/PDFs;
- notification delivery metadata;
- application logs.

Do not invent legal durations. Mark production activation blocked until the owner/legal policy supplies and approves exact durations.

- [ ] **Step 4: Verify docs, config and clean scope.**

Run:

```bash
npm run check:docs-archive
git diff --check
git status --short
git log --oneline --decorate -25
```

Expected: only intentional Bilan changes plus the preserved pre-existing user changes are present.

- [ ] **Step 5: Commit documentation.**

```bash
git add docs/audits/2026-07-29-bilan-gratuit-canonical-go-live.md \
  docs/runbooks/BILAN_GRATUIT_CANONICAL_RUNBOOK.md .env.example
git commit -m "docs(bilans): document canonical go-live and rollback"
```

## Execution checkpoints

### Checkpoint A — after Chunk 1

Exit criteria:

- live compatibility endpoint no longer enumerates accounts;
- request/session/event contracts and migrations pass on fresh and upgrade databases;
- no production flag enabled.

### Checkpoint B — after Chunk 2

Exit criteria:

- account-first intake is traceable and idempotent;
- new/existing public behavior is indistinguishable;
- parent magic link resumes safely;
- real staff email alert is durable;
- unsupported subjects can go live as human follow-up.

### Checkpoint C — after Chunk 3

Exit criteria:

- pack remains blocked until named pedagogical approval;
- correct answers stay server-only;
- autosave, submit, scoring, evidence, provisional result and reviewed audience publications are canonical and durable.

### Checkpoint D — after Chunk 4

Exit criteria:

- admin/assistante/coach workspace and realtime fallback work;
- no skipped Bilan E2E remains;
- DB, security, build and public-render gates pass;
- owner-approved retention policy and named pedagogical review are the only permissible non-code activation gates.

## Final activation order

1. Apply additive migrations after backup/restore proof.
2. Start worker with all public flags off.
3. Enable canonical intake and team workspace for internal canary.
4. Verify new/existing parent behavior and staff alerts.
5. Enable provisional results.
6. Record named pedagogical approval and checksum for Terminale Maths.
7. Enable the pilot pack for a bounded cohort.
8. Keep LLM enrichment disabled until a separate provider/privacy review.
9. Monitor events, outbox failures, request age and publication latency.
10. Roll back by disabling flags; never delete canonical data.
