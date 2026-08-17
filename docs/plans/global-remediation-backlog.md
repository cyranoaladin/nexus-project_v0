# Global remediation backlog

## Date and constraints

2026-07-31. This plan is documentary. It authorizes no Prisma implementation,
worker, route, production migration, deployment, secret change or feature-flag
activation. C2 code remains prohibited by D0.

The objective is a bounded sequence of at most eight functional PRs. Each PR
must remain independently reviewable; stacked bases are permitted only where a
schema or contract dependency makes them unavoidable.

## Integration prerequisite

Before D1–D8 functional work is merged:

1. close the exact-head review of #91 without simulated approval;
2. integrate #88 into #87 and requalify #87;
3. obtain human review and merge #87 to main;
4. retarget and requalify #89, then #90, then #91;
5. keep #93 draft and invalid until a new authorized synthetic benchmark;
6. never force-push shared branches.

## D1 — Canonical email transport and transactional outbox

- **BASE:** qualified main after canonical intake prerequisites; stack on #87
  only if its outbox contract has not reached main.
- **FILES:** new `lib/notifications/email/` boundary, versioned templates,
  email-trigger call sites, outbox dispatcher tests, email runbook.
- **MODELS:** reuse `JobOutbox` only after a capability matrix; add the smallest
  notification/attempt records needed for deduplication, provider ID and audit.
- **MIGRATIONS:** versioned additive migration only if existing outbox cannot
  carry notification state; fresh and upgrade paths required.
- **RISKS:** duplicate delivery, false sent status, PII logs, token invalidation
  before delivery, migration overlap with #87/#89.
- **TESTS:** Mailpit, SMTP 4xx/5xx, retry/backoff/dead-letter, deduplication,
  template escaping/checksum, no raw recipient in logs, fresh/upgrade DB.
- **ROLLBACK:** stop dispatcher; retain queued/audit records; disable new
  enqueueing by documented non-production-tested flag only if needed; no data
  deletion.
- **DEPENDENCIES:** SMTP identity/DNS owner decision and #87 outbox inventory.
- **OWNER_APPROVAL:** infrastructure/email owner for identities, credentials and
  retry thresholds.
- **ACCEPTANCE:** one transport, zero false-success paths, provider message ID
  retained, delivery failure truthfully observable.

## D2 — Registration and identity onboarding integrity

- **BASE:** main plus merged D1 contracts.
- **FILES:** free-bilan, stage and staff onboarding routes; normalized identity
  service; state machine; idempotency and merge policy tests.
- **MODELS:** explicit onboarding state and immutable transition audit; reuse
  User/ParentProfile/Student/ContactLead rather than duplicate identities.
- **MIGRATIONS:** additive states/indexes/normalized unique key only after
  collision report and owner-approved merge policy.
- **RISKS:** identity collision, child linked to wrong parent, lead loss,
  accidental activation, public ID exposure.
- **TESTS:** concurrent duplicate submissions, Unicode/case normalization,
  transaction rollback, orphan prevention, parent/child IDOR, public DTOs.
- **ROLLBACK:** disable new intake path; retain transition/outbox history;
  compensating migration only.
- **DEPENDENCIES:** D1 and product decision for candidate-libre/stage legacy
  merging.
- **OWNER_APPROVAL:** product/identity owner for merge semantics and data
  retention.
- **ACCEPTANCE:** persisted lifecycle, zero new orphan/duplicate normalized
  identities, no raw internal IDs in public response.

## D3 — Authentication/session revocation and token lifecycle

- **BASE:** main plus D2 normalized identity contract.
- **FILES:** `auth.ts`, `auth.config.ts`, token services, activation/reset routes,
  rate limits, security runbook.
- **MODELS:** token/session version and hashed one-time activation/reset token
  records with expiry, consumed/revoked state and audit.
- **MIGRATIONS:** additive session/token lifecycle fields/tables; no plaintext
  tokens; upgrade characterization against existing users.
- **RISKS:** mass logout, replay, account enumeration, brute force, stale role,
  lockout and reset-secret rotation.
- **TESTS:** role/suspension revocation, concurrent consume, replay, multiple
  reset requests, distributed rate limit, CSRF/body bounds, cookie policy.
- **ROLLBACK:** keep previous verification compatible for a bounded migration
  window, stop issuance of new format if required, never restore consumed token.
- **DEPENDENCIES:** dedicated reset secret and Redis/Upstash.
- **OWNER_APPROVAL:** security owner for TTL, password work factor and session
  invalidation policy.
- **ACCEPTANCE:** stale sessions invalidated, one-time tokens, distributed
  brute-force protection and unified role policy input.

## D4 — Dashboard route policy and parent report UX

- **BASE:** main with #89 and D3 policy contracts.
- **FILES:** typed route-role policy, middleware, server guards, navigation,
  `/dashboard/bilans-canoniques`, family report renderer and accessibility tests.
- **MODELS:** none expected.
- **MIGRATIONS:** none expected.
- **RISKS:** role escape, valid-role redirect loop, IDOR, leakage of staff/model
  metadata, broken deep links.
- **TESTS:** ADMIN/ASSISTANTE/COACH/PARENT/ELEVE matrix, deep links,
  callbackUrl, parent A/B IDOR, keyboard/mobile, loading/error/revocation states.
- **ROLLBACK:** revert route-policy consumption and hide nav entry; API guards
  remain authoritative.
- **DEPENDENCIES:** #89 and D3.
- **OWNER_APPROVAL:** product owner for student audience and PDF availability.
- **ACCEPTANCE:** zero inaccessible allowed routes, zero role escapes, no raw
  technical family payload.

## D5 — Questionnaire disciplinary validation and calibration

- **BASE:** main with canonical corpus and assessment engine.
- **FILES:** review packages, hash-bound approval manifests, validation tools,
  calibration specification; source content only through named human changes.
- **MODELS:** no Prisma copy of the corpus; optional approval workflow state
  only if consumed and audited.
- **MIGRATIONS:** none for editorial corpus; any approval DB state requires a
  separate justified additive migration.
- **RISKS:** AI-fabricated approval, content drift after approval, invalid
  thresholds, unsupported report claims, cross-discipline assignment.
- **TESTS:** 408 item reviews, 17 module hashes, approval invalidation on change,
  unapproved assignment refusal, calibration pending prevents publication.
- **ROLLBACK:** revoke affected approvals by hash/status; preserve review
  history; disable assignments.
- **DEPENDENCIES:** named subject reviewers, pedagogical owner and sufficient
  pilot data for psychometrics.
- **OWNER_APPROVAL:** mandatory subject, pedagogical-owner and publication
  approvals; thresholds require separate owner decision.
- **ACCEPTANCE:** no unreviewed/ambiguous/incorrect item and all intended rollout
  modules approved; no invented Physique-Chimie Seconde module.

## D6 — OpenRouter async worker, budget ledger and provenance

- **BASE:** main after #90/#91, D3 and approved model/privacy policies. Code is
  not authorized by D0; a later owner gate must explicitly authorize it.
- **FILES:** only after authorization: queue adapter, worker, immutable context
  snapshot, invocation provenance, budget ledger, generation service and
  operational metrics.
- **MODELS:** additive invocation/job/revision provenance linked to existing
  ReportArtifact/ReportRevision; first prove whether `JobOutbox` is reusable.
- **MIGRATIONS:** additive versioned migration; fresh/upgrade/concurrency tests;
  no `prisma db push`.
- **RISKS:** budget race, duplicate call, unknown outcome replay, PII leakage,
  provider concentration, transaction-held network call, silent fallback.
- **TESTS:** fake OpenRouter, leases, delayed retry/dead-letter, atomic budget,
  no network in Prisma transaction, schema/grounding fail-closed, provenance.
- **ROLLBACK:** `BILAN_REPORT_GENERATION_MODE=DISABLED`, stop worker, keep jobs,
  invocations and revisions for audit; compensating DB migration only.
- **DEPENDENCIES:** #91 merged and approved; new valid parent benchmark/model
  policy, valid privacy attestation, owner budget, Redis, D5 final calibration.
- **OWNER_APPROVAL:** model policy, privacy/legal notice, budgets and accepted
  single-provider pilot risk.
- **ACCEPTANCE:** OpenRouter-only canonical provider, no Mistral dual write,
  immutable provenance and no final result after failed generation.

## D7 — Report publication notifications and parent delivery

- **BASE:** main with D1, D4, D5 and D6.
- **FILES:** human-review decisions, audience-scoped publication service,
  notification templates/events, parent delivery UI and revocation workflow.
- **MODELS:** reuse ReportRevision/Publication; additive immutable review/edit
  history only where existing schema is insufficient.
- **MIGRATIONS:** additive, fresh/upgrade tested, publication uniqueness and
  audience constraints.
- **RISKS:** automatic publication, wrong audience, stale revision, duplicate
  notification, revoked content remaining accessible.
- **TESTS:** approve/reject/regenerate/human-edit history, idempotent concurrent
  publish, parent A/B, notification dedup, Mailpit, revocation and cache purge.
- **ROLLBACK:** stop new publication/notifications, revoke affected publications,
  preserve revisions and audit.
- **DEPENDENCIES:** D1/D4/D5/D6 and human-review workflow.
- **OWNER_APPROVAL:** publication roles, parent/student audience and notification
  wording.
- **ACCEPTANCE:** approved final-calibration revision only, human review cannot
  be bypassed, automatic publication count zero.

## D8 — Production preflight, migrations, smoke and rollout

- **BASE:** release candidate containing qualified D1–D7 and a reduced PR
  stack.
- **FILES:** private-safe preflight scripts, deployment/runbook, observability
  thresholds, smoke and rollback scripts; no secrets in Git.
- **MODELS:** no new business model unless a D1–D7 migration explicitly owns it.
- **MIGRATIONS:** `prisma migrate deploy` in authorized window after verified
  backup and fresh/upgrade clone; no destructive rollback.
- **RISKS:** config drift, partial migration, missing worker, SMTP/Redis/provider
  outage, unmonitored dead letter, host port exposure.
- **TESTS:** exact-release build, SBOM/audit, migration clone, SMTP verify and
  owner-recipient delivery, Redis fail-closed, synthetic OpenRouter preflight,
  full E2E, production smoke and rollback smoke.
- **ROLLBACK:** generation disabled, workers stopped, publication halted,
  previous release retained, compensating DB migration only, immutable records
  retained.
- **DEPENDENCIES:** all prior PRs merged/approved; secrets, DNS, backups,
  connectors/alerts and authorized maintenance window.
- **OWNER_APPROVAL:** release, secrets, migration window, pilot module/audience,
  SMTP live recipient and progressive flag activation.
- **ACCEPTANCE:** exact release SHA deployed, all gates green, smoke and rollback
  proven, monitoring connected and acknowledged.

## Sequencing rationale

```text
D1 email foundation
 └─ D2 identity ─ D3 auth ─ D4 route/UX
              └─ D5 pedagogy/calibration
#90/#91 + approved policy + D3/D5 ─ D6 generation
D1 + D4 + D5 + D6 ─ D7 delivery
D1–D7 + external configuration ─ D8 rollout
```

D5 can begin human review in parallel with D1–D4, but its approval outputs must
not be consumed for production assignment until hash-bound tooling and human
signatures are complete. D6 code must not begin until a later owner decision
explicitly lifts the D0 prohibition.

## Debt handling rule

No remaining item may be hidden in a source `TODO`. Every deferred finding is
owned by the PR above, with a named approval dependency and measurable
acceptance test. New findings discovered while implementing a PR must be added
to its description or the next bounded PR before merge.
