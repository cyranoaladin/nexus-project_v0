# Core v2 — authoritative recovery implementation plan

## Context and authorization

The authoritative handoff authorizes corrections, atomic commits, push, qualification,
merge, production canary, deployment, rollback exercise and stabilization. The parent
agent is the only writer; independent agents review in read-only mode. No intermediate
approval is required by this handoff. The initial state is NO_GO, not an accepted release.

Verified initial PR SHA: `994b8f0b45f54942374686ceb6df5774fefe89a5`.
Verified main SHA: `75ec08fd64c43910561c83819450c74ba44f9025`.
The PR worktree was clean at the initial snapshot. It now contains the integrator's
uncommitted corrections. The main workspace and its 18 stashes are preserved.
GitHub reports 51 successful checks on the PR head, 11 required checks and no unresolved
review threads. This does not qualify the outstanding application/security gates.

## Architecture

Keep V1_ONLY: V1 owns credentials and global identity state. Add an immutable,
transactional first-ADMIN attestation bound to a unique database instance, migration
head, full release SHA and immutable V1 identity. Share its lock and validator between
bootstrap, sync and roster migration. Sync cannot create/promote/demote an ADMIN or
override a Core suspension. Historical credential bootstrap refuses at the service.

Invitation authority is one server-side primitive. Resolve target/household/year and
current relations from the database, never from email or client claims. The current
schema has no assistant delegation relation: add an explicit, audited household/year
grant rather than inventing one. Bind the intention to issuer, target, operation,
scope revision, recipient and generation. Revalidate before issuance and SMTP delivery
with transaction/lease fencing. Absent, ambiguous and denied targets share one refusal.

No historical migration is modified. No deployment occurs before the final head,
security gates, independent review, Phase Zero and canary are qualified.

## Execution sequence

Each correction uses small steps: add a regression test, observe the expected failure,
implement the minimum correction, rerun the relevant tests, review the diff, commit.
Use the existing isolated PR worktree and a separately owned disposable PostgreSQL.

- [x] Read instructions; verify repository, ownership, PR/rules/checks and public health.
- [x] Independent policy derived before reading guards; compare guards and data authorities.
- [ ] Complete and hash initial CI artifacts/logs and sanitized production snapshot.
- [ ] Bootstrap: extend `core-v2/prisma/schema.prisma` with unique DB identity and
  immutable attestation; additive migration; export manifest validation; implement
  locked atomic bootstrap and fail-closed verify in `lib/core-v2/accounts/`.
- [ ] Sync: test refusal before bootstrap/ADMIN injection/case/concurrency/idempotence;
  restrict `scripts/core-v2/sync-staff-actors.ts` to non-ADMIN and preserve Core state;
  refuse historical bootstrap in `lib/core-v2/services/staff-account.ts`.
- [ ] Backfill: remove V1 credentials under V1_ONLY in `migration/transform.ts` and
  `apply.ts`; recognize only staff linked to verified sync receipts.
- [ ] Scope: add central primitive and authoritative grants; call from invite/resend;
  bind intent and idempotency; revalidate in provisioning and V1 email workers.
- [ ] Test real concurrent requests, revocations and reassignments; prove zero writes
  for refusals and generic responses for missing/foreign/ambiguous targets.
- [ ] Repair response/log privacy boundary and horizontal error oracle.
- [ ] Core upload AV: scan clear bytes before any persistence, fail closed, guarantee
  cleanup; real ClamAV/EICAR/timeout/unavailable/unknown verdict verification.
- [ ] Reconcile all 1,866 historical test paths with actual lane collection, deduplicated
  union and result artifacts; blocking guard; no skip/todo/only or silent exclusions.
- [ ] Replace access-policy regex claims with actual handler execution evidence;
  retain mechanical inventory; name all eight meta-invariants without stale claims.
- [ ] Refresh compatible security patches and image digests using official sources;
  scan/SBOM with fresh databases and independent analyses; per-CVE digest-bound VEX
  only when supplier evidence establishes NOT_AFFECTED; harden ephemeral CI services.
- [ ] Qualify worker launch/restart/lease/fencing/crash recovery/backlog/metrics.
- [ ] Full final qualification: two Prisma clients; forward-only migrations first
  deploy, second no-op and zero diff; lint/typecheck/build/all test lanes/security.
- [ ] Atomic commits; refresh main; push same PR; all checks on final SHA.
- [ ] Rebuild sealed Phase Zero from the clean final SHA, with pinned artifacts and
  offline execution; backup/restore/privileges/bootstrap/scope/rollback/roll-forward.
- [ ] Independent final review; ready PR; merge only qualified SHA with restored
  ruleset. Use only the narrowly authorized fallback if technically required.
- [ ] Build immutable release from merged main; pin runtime; source/tree/digest/SBOM.
- [ ] Fresh encrypted V1 backup and actual restoration; provision private Core DB,
  volume, distinct limited roles and migration identity; close bootstrap/migrator LOGIN.
- [ ] Mechanically enforce migrations → bootstrap dry/apply/verify → attested ADMIN
  → close bootstrap → sync dry/execute/no-op → idempotent approved roster backfill.
- [ ] Recompute INCLUDE/DEFER/EXCLUDE from a fresh authoritative V1 snapshot; protect
  nominative evidence in 0600, outside Git and logs; preserve every DEFER V1 journey.
- [ ] Isolated canary of the exact artifact; all roles/handlers/flows/dependencies;
  real rollback gate/release and roll-forward; no residual synthetic production data.
- [ ] Durable internal and independent public monitoring; atomic/progressive cutover,
  immediate smokes and automatic rollback on two concordant failed cycles.
- [ ] Intensive 30min, extended 2h, 24h and 72h monitoring; truthful intermediate/final
  verdicts; cleanup only after stabilization and retention-safe rollback preservation.

## Validation and evidence

Preserve raw evidence in the operator evidence directory with 0700 directory/0600
files. Publish only sanitized hashes, counts, version/digest metadata and test results.
Never print credentials, nominative roster data, tokens, database URLs or raw payloads.
Every new commit invalidates the previous final qualification and Phase Zero.

## Risks and rollback

Initial independent reviews identify first-ADMIN bypass/adoption, missing invitation
scope, credential-copying backfill, Core suspension override, pre-scan Core persistence,
worker fencing gaps and incomplete test evidence. All remain blocking until verified.
Current production remains on its previous release. No rollback-sensitive asset is
removed before 72h stabilization. Application rollback never down-migrates Core.

## Intermediate recovery evidence — 2026-10-13

Status remains `NO_GO — RELEASE_CANDIDATE_CI_GREEN_BUT_SECURITY_AND_CUTOVER_GATES_INCOMPLETE`.
No new qualified SHA, commit, push, merge, ruleset change or production mutation has
occurred. All results below are targeted diagnostics of the uncommitted worktree;
they do not replace final qualification, HTTP canary evidence or Phase Zero.

- Exclusive bootstrap, non-ADMIN sync, V1_ONLY backfill, immutable DB identity,
  session-bound promotion and central invitation scope now have application and
  additive DB protections. There are 33 Core migrations (28–33 are new); historical
  migrations remain unchanged. Full limited-role deployment and strict operator
  ordering, including verified bootstrap closure before sync, remain to be qualified.
- The current mechanical inventory finds 86 handlers across 76 route files,
  430 role decisions and eight explicitly retained meta-invariants. Resolver and
  policy regression tests total 494 passing assertions; this is not an executed
  86-by-five HTTP canary matrix.
- Targeted real-DB and transport tests cover scope/session/PIN revocation, clock
  cutoffs, suspension, clear-byte antivirus, encrypted persistence and original
  V1 cookies. Full clean-source collection and execution remain outstanding.
- The native evidence registry contains 50 lanes: 47 CI and three rehearsal lanes.
  Twenty-four producers own the 47 CI lanes exactly once. Original native reports
  bind clean source SHA/tree, collection, invocation, run/attempt and external
  challenge; API artifact IDs/digests and a single matching verified OIDC/SLSA
  statement are required before decryption and aggregation. CI wiring is written
  but has not run on GitHub. Rehearsal target binding remains outstanding.
- The full native-protocol diagnostic run passed 221 tests without skips/todos.
  Subsequent retained-descriptor fixes passed 91 transport/archive tests, including
  a real GPG import, directory replacement and later API refusal; the complete
  protocol must be rerun after these latest changes. ARIA workflow governance
  passed 35 tests and the ARIA script TypeScript project passed.
- Raw reports and attachments use bounded private archives encrypted to the
  operator and a dedicated CI evidence recipient. The temporary GitHub environment
  `core-v2-proof-346` is limited to this PR merge ref and main. Its encryption-only
  key has a 14-day lifetime and must be replaced by a durable, scoped arrangement
  before final freeze; it is not a production secret. No broad shell permission
  was added.
- Compatible Node/OpenSSL/SQLite/zlib and npm security builds exist only as
  preliminary artifacts. Four minimal service images have preliminary independent
  scans; the complete builder, remaining images, fresh databases, reproducibility,
  digest publication, per-CVE qualifications and production artifact remain open.
- Host-memory failures prevented a successful full TypeScript run. No timeout,
  assertion, retry or collection gate was relaxed to hide this limitation.
- Independent review identified a crash boundary after SMTP acceptance but before
  the V1 DB acknowledgement that could cause automatic redelivery. A real process
  interruption/restart test and durable uncertain-delivery fencing are required.

The last read-only production snapshot served source
`093f538e949f5262dad645fde34274eaa8a88182`; public and loopback health were successful.
Core remained disabled (`V1_ONLY`, no Core DB URL). No production incident is inferred
from operator-memory or scanner-cache failures. No cleanup affecting rollback has run.
