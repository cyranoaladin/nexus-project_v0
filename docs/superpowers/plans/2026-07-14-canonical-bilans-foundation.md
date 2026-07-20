# Canonical Pedagogical Bilans Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the secure, versioned and reviewable foundation through which any Nexus subject pack can create a validated pedagogical bilan.

**Architecture:** Introduce a `lib/bilans` domain layer that owns canonical contracts, catalogue resolution, state transitions, scoring snapshots, report revisions and notification outbox events. Prisma persists immutable attempts and revisions; Next.js routes remain thin adapters protected by existing Auth.js/RBAC guards; a Redis/BullMQ worker executes durable scoring, report generation and WhatsApp delivery.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma/PostgreSQL, Zod, Auth.js, BullMQ/Redis, Jest, Playwright.

---

This is plan 1 of 3. It deliberately delivers the reusable workflow and migrates no new subject content. Plan 2 ports and validates the Maths/NSI pilot packs; plan 3 adds the four remaining priority packs (Physique-Chimie, Français, SVT and SES) one reviewed pack at a time. A pack is never enabled before its programme mapping, golden set and pedagogical review are complete.

## Target file structure

| Path | Responsibility |
| --- | --- |
| `lib/bilans/core/types.ts` | Stable domain types, statuses, error codes and event names. |
| `lib/bilans/core/schemas.ts` | Zod boundary schemas for packs, commands, score snapshots and report revisions. |
| `lib/bilans/core/state-machine.ts` | The only legal lifecycle transitions and actor checks. |
| `lib/bilans/catalog/service.ts` | Resolve a published, eligible and versioned assessment pack. |
| `lib/bilans/catalog/fixtures/maths-nsi.v1.ts` | Temporary adapter of the current Maths/NSI definitions, isolated from runtime routes. |
| `lib/bilans/attempts/submit-attempt.ts` | Transactional draft submission, source events and durable scoring dispatch record. |
| `lib/bilans/scoring/score-attempt.ts` | Deterministic scoring adapter that creates the immutable score snapshot. |
| `lib/bilans/reports/create-revision.ts` | Deterministic fallback, optional structured generation and immutable report revisions. |
| `lib/bilans/reports/review-revision.ts` | Transactional coach decision, current-publication pointer and outbox creation. |
| `lib/bilans/access/parent-student-link.ts` | Parent-link state and parent access assertion. |
| `lib/bilans/jobs/queue.ts` | Queue names, Redis connection and idempotent enqueue helpers. |
| `lib/bilans/jobs/processor.ts` | Worker handlers and retry/error mapping. |
| `lib/bilans/notifications/outbox.ts` | Transactional domain/job/notification outbox creation and safe WhatsApp payload projection. |
| `app/api/bilans/v1/attempts/route.ts` | Authenticated create/submit endpoint; never performs generation inline. |
| `app/api/bilans/v1/attempts/[attemptId]/route.ts` | Authenticated draft autosave and neutral student status endpoint. |
| `app/api/bilans/v1/attempts/[attemptId]/submit/route.ts` | Authenticated immutable submission endpoint that only persists and enqueues. |
| `app/api/coach/students/[studentId]/bilans/[artifactId]/review/route.ts` | Coach validation, refusal and explicit regeneration request. |
| `app/api/parent/children/[studentId]/bilans/[artifactId]/route.ts` | Parent read endpoint restricted to a verified link and published revision. |
| `app/api/bilans/v1/parent-links/route.ts` | Student-initiated parent-link request. |
| `app/api/bilans/v1/parent-links/[linkId]/route.ts` | Parent acceptance and authorized revocation request. |
| `app/api/admin/bilans/v1/parent-links/[linkId]/verify/route.ts` | Nexus verification or revocation after the minor-account control. |
| `prisma/schema.prisma` | Canonical models/enums and relations; legacy tables remain untouched in this increment. |
| `prisma/migrations/20260714_add_canonical_bilans_foundation/migration.sql` | Additive migration with constraints, indexes and no destructive changes. |
| `services/bilans-worker/Dockerfile` and `services/bilans-worker/src/index.ts` | Dedicated worker process; no Next.js request process executes jobs. |
| `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example` | Worker/Redis configuration and explicit required variables. |

## Chunk 1: Canonical domain, catalogue and persistence

### Task 1: Lock lifecycle contracts before implementation

**Files:**
- Create: `lib/bilans/core/types.ts`
- Create: `lib/bilans/core/schemas.ts`
- Create: `lib/bilans/core/state-machine.ts`
- Test: `__tests__/lib/bilans/core/state-machine.test.ts`

- [ ] **Step 1: Write failing state-machine tests.**

```ts
expect(canTransition('SUBMITTED', 'SCORED', 'WORKER')).toBe(true);
expect(canTransition('DRAFT', 'SUBMITTED', 'STUDENT')).toBe(true);
expect(canTransition('SCORING_FAILED', 'SUBMITTED', 'WORKER')).toBe(true);
expect(canTransition('REPORT_PENDING_REVIEW', 'PUBLISHED', 'COACH')).toBe(false);
expect(canTransition('COACH_REJECTED', 'REPORT_PENDING_REVIEW', 'COACH')).toBe(false);
expect(canTransition('COACH_VALIDATED', 'PUBLISHED', 'COACH')).toBe(true);
for (const edge of legalTransitions) expect(canTransition(edge.from, edge.to, edge.actor)).toBe(true);
for (const edge of illegalTransitions) expect(canTransition(edge.from, edge.to, edge.actor)).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify it fails because the domain module does not exist.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/core/state-machine.test.ts --runInBand`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the smallest typed contract.**

```ts
export type AttemptStatus = 'DRAFT' | 'SUBMITTED' | 'SCORED' | 'SCORING_FAILED';
export type ReportRevisionStatus = 'REPORT_PENDING_REVIEW' | 'COACH_VALIDATED' | 'COACH_REJECTED' | 'PUBLISHED' | 'REPORT_GENERATION_FAILED';
export type LifecycleActor = 'STUDENT' | 'COACH' | 'WORKER';

export function canTransition(from: string, to: string, actor: LifecycleActor) {
  return transitions.some((edge) => edge.from === from && edge.to === to && edge.actor === actor);
}
```

Define the complete legal transition table: draft submission; worker scoring; scoring failure and retry; report creation; coach validation, refusal and explicit regeneration of a new revision; and publication of only the validated revision. Define Zod schemas for `CatalogRef`, `AttemptSubmission`, `ScoreSnapshot`, `EvidenceItem`, `ReportRevision` and `NotificationEvent`; reject unknown keys and use stable error-code literals.

- [ ] **Step 4: Re-run focused tests and static typing.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/core/state-machine.test.ts --runInBand && npm run typecheck`  
Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit the contract.**

```bash
git add lib/bilans/core __tests__/lib/bilans/core/state-machine.test.ts
git commit -m "feat(bilans): add canonical lifecycle contracts"
```

### Task 2: Add a published-pack catalogue resolver

**Files:**
- Create: `lib/bilans/catalog/service.ts`
- Create: `lib/bilans/catalog/fixtures/maths-nsi.v1.ts`
- Test: `__tests__/lib/bilans/catalog/service.test.ts`
- Reference: `lib/diagnostics/definitions/index.ts`, `lib/assessments/questions/loader.ts`

- [ ] **Step 1: Write failing eligibility and version-pinning tests.**

```ts
await expect(resolveEligiblePack({ grade: 'TERMINALE', subject: 'NSI', schoolYear: '2026-2027' }))
  .rejects.toMatchObject({ code: 'PACK_NOT_PUBLISHED' });
await expect(resolveEligiblePack({ grade: 'SECONDE', subject: 'NSI', schoolYear: '2026-2027' }))
  .rejects.toMatchObject({ code: 'PACK_NOT_ELIGIBLE' });
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/catalog/service.test.ts --runInBand`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement catalogue resolution.**

```ts
export async function resolveEligiblePack(selection: PackSelection): Promise<PublishedAssessmentPack> {
  const pack = allPacks.find((candidate) => matchesSelection(candidate, selection));
  if (!pack) throw new BilansDomainError('PACK_NOT_ELIGIBLE');
  if (pack.status !== 'PUBLISHED') throw new BilansDomainError('PACK_NOT_PUBLISHED');
  return structuredClone(pack);
}
```

The initial fixture imports the current Maths/NSI definitions as `REVIEW_REQUIRED`, not `PUBLISHED`: they become usable only in plan 2 after the official-reference record, programme mapping, golden set and named pedagogical review are supplied. Normalize subject, grade, curriculum version, pack version, scoring policy version, report pack version, corpus manifest version and checksum. Require the official source URL/identifier, consultation date, effective date, source checksum and reviewer identity; validate competency IDs, question references, minimum coverage and an acyclic prerequisite graph before a pack can become `PUBLISHED`. Do not let routes read `lib/diagnostics/definitions` or `lib/assessments/questions` directly.

- [ ] **Step 4: Re-run focused tests.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/catalog/service.test.ts --runInBand`  
Expected: PASS, including unpublished, unsupported-subject, wrong-school-year, missing-regulatory-metadata and cyclic-prerequisite rejection cases.

- [ ] **Step 5: Commit the catalogue boundary.**

```bash
git add lib/bilans/catalog __tests__/lib/bilans/catalog/service.test.ts
git commit -m "feat(bilans): resolve versioned eligible packs"
```

### Task 3: Add additive canonical persistence and access-link models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260714_add_canonical_bilans_foundation/migration.sql`
- Test: `__tests__/db/canonical-bilans-schema.test.ts`

- [ ] **Step 1: Write a database-contract test for immutability references and unique outbox delivery.**

```ts
await expect(createReportRevision({ reportArtifactId, reportPackVersion: '1.0.0' })).resolves.toBeDefined();
await expect(createReportReview({ reportRevisionId, coachId, decision: 'VALIDATED' })).resolves.toBeDefined();
await expect(createJobOutbox({ type: 'SCORE_ATTEMPT', sourceEventKey: attemptId })).resolves.toBeDefined();
await expect(createJobOutbox({ type: 'SCORE_ATTEMPT', sourceEventKey: attemptId })).rejects.toMatchObject({ code: 'P2002' });
await expect(createOutbox({ eventType: 'ATTEMPT_SUBMITTED', sourceEventKey: attemptId, recipientUserId })).resolves.toBeDefined();
await expect(createOutbox({ eventType: 'ATTEMPT_SUBMITTED', sourceEventKey: attemptId, recipientUserId })).rejects.toMatchObject({ code: 'P2002' });
```

- [ ] **Step 2: Run against the disposable test database and verify it fails.**

Run: `npm run test:db:setup && npx jest --config jest.config.db.js __tests__/db/canonical-bilans-schema.test.ts --runInBand`  
Expected: FAIL because the canonical models and constraints are absent.

- [ ] **Step 3: Add models and a hand-reviewed additive SQL migration.**

Add `ParentStudentLink`, `CanonicalAssessmentAttempt`, `ScoreSnapshot`, `EvidenceItem`, `ReportArtifact`, `ReportRevision`, `ReportReview`, `JobOutbox` and `NotificationOutbox`. Model parent-link states `PENDING_PARENT_CONSENT`, `VERIFIED`, `REVOKED`, `EXPIRED`; enforce one active link per parent/student pair; link attempts to `Student`; link revisions to artifacts; link immutable review decisions to revisions. `CanonicalAssessmentAttempt` must store curriculum, assessment-pack and scoring-policy identifiers/versions plus pack checksum. `ReportRevision` must store score-snapshot ID, report-pack and corpus-manifest identifiers/versions, prompt revision and context checksum. `JobOutbox` stores job type, aggregate ID, deterministic idempotency key, lease and delivery state. `NotificationOutbox` stores a non-null `sourceEventKey` (`attemptId` for submission, `reportRevisionId` otherwise). Add unique constraints for a job idempotency key and `(eventType, sourceEventKey, recipientUserId)`, indexes for worker status scans and foreign keys with non-destructive deletion policies. Keep legacy `Assessment`, `Diagnostic`, `Bilan` and `GeneratedPedagogicalReport` unchanged.

- [ ] **Step 4: Generate Prisma client, deploy migration to test DB and rerun the test.**

Run: `npx prisma generate && npx prisma migrate deploy && npx jest --config jest.config.db.js __tests__/db/canonical-bilans-schema.test.ts --runInBand`  
Expected: PASS; migration is additive, no legacy table is dropped, report reviews are traceable, version references are mandatory and duplicate active parent links/outbox events are rejected.

- [ ] **Step 5: Commit schema and migration together.**

```bash
git add prisma/schema.prisma prisma/migrations/20260714_add_canonical_bilans_foundation __tests__/db/canonical-bilans-schema.test.ts
git commit -m "feat(bilans): persist canonical attempts and revisions"
```

### Task 4: Enforce verified-parent and strict coach access in the new domain

**Files:**
- Create: `lib/bilans/access/parent-student-link.ts`
- Modify: `lib/rbac/coach-student-access.ts`
- Test: `__tests__/lib/bilans/access/parent-student-link.test.ts`
- Test: `__tests__/rbac/coach-student-access.test.ts`

- [ ] **Step 1: Add failing access tests.**

```ts
await expect(assertVerifiedParentCanAccessStudent({ parentUserId, studentId })).rejects.toMatchObject({ code: 'PARENT_LINK_NOT_VERIFIED' });
await expect(assertCanonicalCoachCanAccessStudent({ coachUserId, studentId })).rejects.toMatchObject({ code: 'COACH_NOT_ASSIGNED' });
```

- [ ] **Step 2: Run focused tests and verify failure.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/access/parent-student-link.test.ts __tests__/rbac/coach-student-access.test.ts --runInBand`  
Expected: FAIL because the new strict guards do not exist.

- [ ] **Step 3: Implement canonical guards without changing legacy fallback behaviour.**

```ts
export async function assertCanonicalCoachCanAccessStudent(input: AccessInput) {
  const assigned = await prisma.coachStudentAssignment.findFirst({ where: activeAssignmentFor(input) });
  if (!assigned) throw new BilansDomainError('COACH_NOT_ASSIGNED');
}
```

The canonical path must not use the legacy `SessionBooking` fallback in `isCoachAssignedToStudent`. Parent access must query only `ParentStudentLink` in `VERIFIED` state.

- [ ] **Step 4: Re-run tests.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/access/parent-student-link.test.ts __tests__/rbac/coach-student-access.test.ts --runInBand`  
Expected: PASS, including revoked/expired parent links and unassigned coach denial.

- [ ] **Step 5: Commit strict domain authorization.**

```bash
git add lib/bilans/access lib/rbac/coach-student-access.ts __tests__/lib/bilans/access __tests__/rbac/coach-student-access.test.ts
git commit -m "feat(bilans): enforce verified family and coach access"
```

## Chunk 2: Processing, review, delivery and secure API

### Task 5: Build deterministic scoring and report-revision services

**Files:**
- Create: `lib/bilans/scoring/score-attempt.ts`
- Create: `lib/bilans/reports/create-revision.ts`
- Test: `__tests__/lib/bilans/scoring/score-attempt.test.ts`
- Test: `__tests__/lib/bilans/reports/create-revision.test.ts`
- Reference: `lib/assessments/scoring/index.ts`, `lib/diagnostics/bilan-renderer.ts`

- [ ] **Step 1: Write failing golden tests with a fixed Maths fixture.**

```ts
expect(scoreAttempt(attempt, pack)).toMatchObject({ globalScore: 70, evidence: expect.arrayContaining([expect.objectContaining({ competencyId: 'ALG-1' })]) });
expect(createRevision({ attempt, scoreSnapshot, pack, generator: unavailable })).toMatchObject({ source: 'FALLBACK', status: 'REPORT_PENDING_REVIEW' });
```

- [ ] **Step 2: Run tests and verify they fail.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/scoring/score-attempt.test.ts __tests__/lib/bilans/reports/create-revision.test.ts --runInBand`  
Expected: FAIL with missing services.

- [ ] **Step 3: Implement deterministic-first services.**

`scoreAttempt` must consume the pinned pack, produce validated `ScoreSnapshot`/`EvidenceItem` data and never call a model. `createRevision` must render the deterministic three-audience fallback first, optionally accept validated JSON from a generator, then persist a new immutable revision with versions/checksum. A model failure yields fallback output and a stable generation error code, never an unpublished empty record.

- [ ] **Step 4: Re-run the golden tests.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/scoring/score-attempt.test.ts __tests__/lib/bilans/reports/create-revision.test.ts --runInBand`  
Expected: PASS for deterministic score, fallback and schema-rejection cases.

- [ ] **Step 5: Commit scoring and report services.**

```bash
git add lib/bilans/scoring lib/bilans/reports __tests__/lib/bilans/scoring __tests__/lib/bilans/reports
git commit -m "feat(bilans): generate reviewable deterministic reports"
```

### Task 6: Make processing and WhatsApp notification delivery durable

**Files:**
- Modify: `package.json`
- Create: `lib/bilans/jobs/queue.ts`
- Create: `lib/bilans/jobs/processor.ts`
- Create: `lib/bilans/notifications/outbox.ts`
- Modify: `lib/bilans/scoring/score-attempt.ts`
- Modify: `lib/bilans/reports/create-revision.ts`
- Modify: `lib/whatsapp.ts`
- Create: `services/bilans-worker/src/index.ts`
- Create: `services/bilans-worker/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`
- Test: `__tests__/lib/bilans/jobs/processor.test.ts`
- Test: `__tests__/lib/bilans/notifications/outbox.test.ts`

- [ ] **Step 1: Write failing job idempotence and payload-minimization tests.**

```ts
await enqueueAttemptSubmitted(attempt.id);
await enqueueAttemptSubmitted(attempt.id);
expect(queue.add).toHaveBeenCalledTimes(1);
expect(await claimJobOutbox(jobOutboxId, workerA)).toBe(true);
expect(await claimJobOutbox(jobOutboxId, workerB)).toBe(false);
await expect(submitAttempt(transactionInput)).resolves.toMatchObject({ attemptStatus: 'SUBMITTED', jobOutboxCreated: true, notificationOutboxCreated: true });
expect(createOutboxForAttemptSubmitted({ attempt, coach })).toMatchObject({ eventType: 'ATTEMPT_SUBMITTED' });
expect(createOutboxForReportReady({ revision, coach })).toMatchObject({ eventType: 'REPORT_READY_FOR_REVIEW' });
expect(createOutboxForReportPublished({ revision, parent })).toMatchObject({ eventType: 'REPORT_PUBLISHED' });
expect(projectWhatsAppMessage(event)).toEqual({ template: 'BILAN_AVAILABLE', variables: { securePath: expect.any(String) } });
```

- [ ] **Step 2: Run tests and verify they fail.**

Run: `npx jest --config jest.unit.config.js __tests__/lib/bilans/jobs/processor.test.ts __tests__/lib/bilans/notifications/outbox.test.ts --runInBand`  
Expected: FAIL with missing queue/outbox modules.

- [ ] **Step 3: Add BullMQ and implement transactional enqueue/delivery.**

Add `bullmq` and the Redis connection configuration. Use a deterministic job id per attempt/revision/event, `attempts` with exponential backoff and a failed-job queue. Add a transactional domain outbox: every state-changing service writes its state transition plus the required job and notification outbox rows in the same Prisma transaction. `submitAttempt` writes `SCORE_ATTEMPT` plus `ATTEMPT_SUBMITTED`; the scoring/report transaction writes `GENERATE_REPORT_REVISION` plus `REPORT_READY_FOR_REVIEW`; publication writes `REPORT_PUBLISHED`. A dispatcher leases unsent job-outbox rows and enqueues BullMQ; if Redis is unavailable it leaves the row retryable, so a scanner safely re-enqueues it after recovery. The notification worker similarly claims rows, invokes the approved WhatsApp provider adapter, and records only provider status/error code. The processor must create events for `ATTEMPT_SUBMITTED` (assigned coach), `REPORT_READY_FOR_REVIEW` (assigned coach), and `REPORT_PUBLISHED` (each verified parent and the student). Before delivery it must require an opted-in preference, verified WhatsApp number and active recipient; otherwise it marks the row `SKIPPED_CONTACT_POLICY` without retry. Extend `lib/whatsapp.ts` only with a server-only adapter; retain `buildWhatsAppUrl` for public click-to-chat. The worker also expires pending parent links at their configured expiry time.

- [ ] **Step 4: Start the test stack and rerun tests.**

Run: `npm run test:db:setup && npx jest --config jest.integration.config.js __tests__/lib/bilans/jobs/processor.test.ts __tests__/lib/bilans/notifications/outbox.test.ts --runInBand`  
Expected: PASS; duplicate events create one queued delivery, Redis downtime leaves a recoverable job-outbox record, each source transition creates its coach/family event atomically, and provider failure leaves the report published.

- [ ] **Step 5: Commit worker and notification infrastructure.**

```bash
git add package.json package-lock.json lib/bilans/jobs lib/bilans/notifications lib/bilans/scoring/score-attempt.ts lib/bilans/reports/create-revision.ts lib/whatsapp.ts services/bilans-worker docker-compose.yml docker-compose.prod.yml .env.example __tests__/lib/bilans
git commit -m "feat(bilans): process reports and alerts durably"
```

### Task 7: Expose authenticated submit, review and read APIs

**Files:**
- Create: `app/api/bilans/v1/attempts/route.ts`
- Create: `app/api/bilans/v1/attempts/[attemptId]/route.ts`
- Create: `app/api/bilans/v1/attempts/[attemptId]/submit/route.ts`
- Create: `lib/bilans/attempts/submit-attempt.ts`
- Create: `app/api/bilans/v1/parent-links/route.ts`
- Create: `app/api/bilans/v1/parent-links/[linkId]/route.ts`
- Create: `app/api/admin/bilans/v1/parent-links/[linkId]/verify/route.ts`
- Create: `app/api/coach/students/[studentId]/bilans/[artifactId]/review/route.ts`
- Create: `app/api/parent/children/[studentId]/bilans/[artifactId]/route.ts`
- Create: `lib/bilans/reports/review-revision.ts`
- Test: `__tests__/api/bilans/v1/attempts.test.ts`
- Test: `__tests__/api/bilans/v1/review.security.test.ts`
- Test: `__tests__/api/bilans/v1/parent-access.security.test.ts`
- Test: `__tests__/lib/bilans/reports/review-revision.test.ts`
- Test: `__tests__/lib/bilans/attempts/submit-attempt.test.ts`

- [ ] **Step 1: Write route tests before route code.**

```ts
expect((await POST(studentSession, validSubmission)).status).toBe(201);
expect((await PATCH(studentSession, attemptId, draftAnswers)).status).toBe(200);
expect((await submit(studentSession, attemptId)).status).toBe(202);
expect((await POST(anonymousSession, validSubmission)).status).toBe(401);
expect((await review(unassignedCoach, artifactId, { action: 'VALIDATE' })).status).toBe(403);
expect((await parentRead(unverifiedParent, studentId, artifactId)).status).toBe(403);
expect((await adminVerify(assistantSession, linkId)).status).toBe(403);
await expect(reviewRevision({ action: 'VALIDATE', artifactId, revisionId, coachId })).resolves.toMatchObject({ outboxCreated: true });
```

- [ ] **Step 2: Run route tests and verify failure.**

Run: `npx jest --config jest.integration.config.js __tests__/api/bilans/v1/attempts.test.ts __tests__/api/bilans/v1/review.security.test.ts __tests__/api/bilans/v1/parent-access.security.test.ts __tests__/lib/bilans/reports/review-revision.test.ts __tests__/lib/bilans/attempts/submit-attempt.test.ts --runInBand`  
Expected: FAIL because v1 routes do not exist.

- [ ] **Step 3: Implement thin protected routes.**

`POST /attempts` requires `ELEVE`, resolves an eligible pack server-side and creates only `DRAFT`. `PATCH /attempts/[attemptId]` is the sole autosave route and rejects any mutation after submission. `POST /attempts/[attemptId]/submit` delegates to `submit-attempt.ts`, which in one transaction seals answers, changes the attempt to `SUBMITTED`, creates the `SCORE_ATTEMPT` job outbox event and the coach `ATTEMPT_SUBMITTED` notification outbox event. Student GET verifies ownership and returns a neutral pre-publication status without scores, evidence or report text. The parent-link request route permits only the student initiating a request; its detail route permits only the invited authenticated parent to accept and the linked parties to request revocation. The admin verification route requires `ADMIN`, verifies the minor-account proof and transitions accepted links to `VERIFIED` or `REVOKED`; the worker expires stale pending links. The coach route permits only `VALIDATE`, `REJECT`, or explicit `REGENERATE` using the strict assignment guard. It delegates to `review-revision.ts`, which in one Prisma transaction records `ReportReview`, updates the artifact's published-revision pointer only for `VALIDATE`, and creates the relevant outbox rows. The parent read route returns only the current published revision after `assertVerifiedParentCanAccessStudent`.

- [ ] **Step 4: Re-run route tests.**

Run: `npx jest --config jest.integration.config.js __tests__/api/bilans/v1/attempts.test.ts __tests__/api/bilans/v1/review.security.test.ts __tests__/api/bilans/v1/parent-access.security.test.ts __tests__/lib/bilans/reports/review-revision.test.ts __tests__/lib/bilans/attempts/submit-attempt.test.ts --runInBand`  
Expected: PASS, including horizontal-access and unpublished-report denials.

- [ ] **Step 5: Commit APIs.**

```bash
git add app/api/bilans/v1 app/api/admin/bilans/v1 app/api/coach/students/[studentId]/bilans app/api/parent/children/[studentId]/bilans lib/bilans/attempts/submit-attempt.ts lib/bilans/reports/review-revision.ts __tests__/api/bilans/v1 __tests__/lib/bilans/attempts/submit-attempt.test.ts __tests__/lib/bilans/reports/review-revision.test.ts
git commit -m "feat(bilans): expose authenticated reviewed workflow"
```

### Task 8: Verify full path and document cutover rules

**Files:**
- Create: `e2e/canonical-bilans-workflow.spec.ts`
- Create: `docs/bilans/CUTOVER_RULES.md`
- Modify: `scripts/migrate-bilans.ts`
- Test: `__tests__/scripts/migrate-canonical-bilans.test.ts`

- [ ] **Step 1: Write a failing end-to-end scenario and an idempotent migration test.**

```ts
test('student submission remains private until assigned coach validates it', async ({ page }) => {
  // student submits; parent receives 403 before review; coach validates; parent sees published revision.
  // Redis is unavailable during submit; after recovery, JobOutbox dispatches scoring exactly once.
});
expect(await migrateLegacyBatch(fixture)).toMatchObject({ imported: 1, skipped: 0 });
expect(await migrateLegacyBatch(fixture)).toMatchObject({ imported: 0, skipped: 1 });
```

- [ ] **Step 2: Run the focused tests and verify failure.**

Run: `npx jest --config jest.unit.config.js __tests__/scripts/migrate-canonical-bilans.test.ts --runInBand && npx playwright test e2e/canonical-bilans-workflow.spec.ts`  
Expected: FAIL until fixtures, route wiring and test setup exist.

- [ ] **Step 3: Implement only the required fixtures, migration provenance and cutover document.**

The migration must support dry-run, source identifiers, per-pack one-way cutover, and rollback of an uncommitted import batch; it must never double-write or delete canonical data. `CUTOVER_RULES.md` names the canonical writer/read source for each pack and documents the legacy read-only adapter. The E2E fixture must use verified parent, assigned coach, and a mocked WhatsApp provider.

- [ ] **Step 4: Run the complete foundation verification.**

Run: `npm run typecheck && npm run test:unit && npm run test:integration && npx playwright test e2e/canonical-bilans-workflow.spec.ts`  
Expected: PASS. If the local browser or test database is unavailable, record the exact blocked command and run all available unit tests; do not claim E2E success without output.

- [ ] **Step 5: Commit verification and cutover safeguards.**

```bash
git add e2e/canonical-bilans-workflow.spec.ts docs/bilans/CUTOVER_RULES.md scripts/migrate-bilans.ts __tests__/scripts/migrate-canonical-bilans.test.ts
git commit -m "test(bilans): verify secure canonical workflow"
```

## Execution acceptance gate

- No legacy route is deleted in this plan.
- No public report token is added or retained in new routes.
- No score or pedagogical detail is placed in a WhatsApp payload.
- The worker owns retries; HTTP requests only persist and enqueue.
- The foundation is ready for plan 2 only after all Task 8 verification commands have evidence recorded.
