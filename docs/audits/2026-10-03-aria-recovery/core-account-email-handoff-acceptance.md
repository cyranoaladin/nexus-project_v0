# Core account email handoff: causal defect and acceptance criteria

2026-10-04. Runtime source inspected: `18b56ef8a2c7bc0ebed8d001102bbe87af68538f`.
Status NOT_READY. This is a pending correction, not a delivery claim.

## Proven P1

Core invitation/reset issuance commits before its adapter opens a separate V1
outbox transaction. A crash or V1 failure in between loses the only returned raw
proof; the Core HMAC cannot reconstruct it. Invite retry refuses an open
invitation, while resend/reset issues a different proof and revokes the earlier
one. Existing V1 issuance idempotence protects a repeated transfer, not the
pre-transfer window. CoreV2JobOutbox currently only supports ARIA recovery.

Read-only review confirmed active staff invite/resend and public reset callers.
Four new real-Core tests reproduced the defect against the current runtime:
invitation/resend/reset have zero durable handoff jobs, and missing encryption
configuration does not refuse issuance. All four failed for these intended
causes in `.artifacts/recovery/stage-lead-decision-green-1791150575`; assertions
emit counts/booleans, not returned raw proofs or payloads. The owned disposable
instance was stopped. No production account or provider was used.

## Minimal additive correction

Persist a versioned authenticated encrypted handoff in the same Core transaction
as issuance/audit. Add a dedicated Core job type; existing ARIA workers must keep
filtering their own type. Preserve V1 issuance namespace and upsert semantics.
The handoff worker leases a job, checks current issuance purpose/expiry,
revocation/consumption and user eligibility, transfers to V1, then acknowledges
Core only after V1 commit. A lost acknowledgment replays the same issuance and
preserves the V1 message identity. Retry/lease limits and error codes are bounded;
no plaintext token, recipient or provider secret in job metadata or logs.

Validate encryption configuration before any issuance can commit. Use a
purpose-separated authenticated envelope and explicit key version; test retained
old-key reads during rotation. Never invent or display a production key. Existing
mail configuration can remain the legacy envelope key; an optional explicit
keyring must fail closed when partially configured. Actual key custody/entropy
and operational rotation remain infrastructure gates.

Wire a supervised recovery poller and a post-commit transfer attempt, without
claiming SMTP delivery. A failed transfer must leave durable work, not an
unrecoverable proof or fake success. No historical issuance can be reconstructed
or bulk sent: retain expiry/manual re-invitation behavior, with explicit operator
action if necessary. A command idempotency key for resend is distinct from
issuance idempotence and must be tested separately.

## Required tests and migration evidence

- Atomic rollback before Core commit; missing key and outbox write failure.
- Recoverability after Core commit but before V1 commit.
- Replay after V1 commit but before Core acknowledgment, preserving Message-ID.
- Two competing workers, lease expiration and stale-owner acknowledgment refusal.
- Expired, revoked, consumed or ineligible issuance never transferred.
- Envelope tampering/wrong job binding/unknown key version refused.
- Repeated resend command does not revoke its own first proof.
- Additive migration on empty and existing Core schemas, replay, unchanged old
  rows, compatibility of prior ARIA worker filtering.

No policy duration, actual delivery, production backup, retention approval or
CodeQL disposition follows from this acceptance plan. Any scanner improvement
must result from the real durable workflow change and be verified on the exact
published SHA; no cosmetic source rename or suppression is authorized.

## Writer qualification checkpoint

2026-10-04. Four causal real-PostgreSQL tests are now green; a fifth
verifies SQLSTATE 23514 for a plaintext proof field, without printing the proof.
Migration 0024 SHA-256: `cdcfe6abfd7a5d4d693ac8b50d8e9d7e67765820d82081586ba86f157a8af388`.
It expands the job enum and closed payload constraint, retains the old ARIA
shape and removes no row, column or table. Constraint replacement is atomic.

Private synthetic rehearsal: `.artifacts/recovery/stage-lead-decision-green-1791151783`.
Old Core 23 migrations, native ARIA fixture, interrupted SQL connection rollback,
current 24 migrations, unchanged fixture hash, repeated migrate deploy and all
five account handoff tests passed. The V1 lane also restored its encrypted
synthetic backup and passed its real-database tests. The first Core rehearsal
was refused by the disposable database name guard; the runner name was fixed,
the guard was retained, and the successful full rerun is recorded above.

This does not prove a production backup restoration, a failed Prisma journal
recovery or an operational process-kill recovery. Core fixture preservation is
not a Core backup restoration. Typecheck passed. Worker delivery, cross-database
retry/acknowledgment, scheduling, resend command idempotence and rollout/rollback
remain open. No SMTP or production operation was performed. Status NOT_READY.

## Worker qualification checkpoint

The first missing-module RED run had zero executed tests; it is not claimed as
a causal product regression. Two later real-database regressions reproduced
final-attempt abandonment and transfer after lease expiration: 2 failed, 7
passed in proof `1791151969`. The corrected worker passed 9, then 13 tests.
Current proof `1791152213`: 13 PostgreSQL tests passed, including a slow logical
clock, competing workers, blocked revocation, ineligible issuance, mismatched
proof and lost acknowledgment with a synthetic destination. Audit of completed
transfer is written append-only in the same Core acknowledgment transaction.

Jobs are claimed individually with SKIP LOCKED, fixed lease and capped attempts;
expired final-attempt leases become FAILED_FINAL. Eligibility includes current
recipient, role, purpose, expiry, account status and proof HMAC equality.
Core row locks span only the destination enqueue transaction, never a provider
send; acknowledgment follows destination commit. Processing transactions are
bounded at 20 seconds with 5 seconds maximum wait. Generic redacted failure codes
retain encrypted retry work. Existing ARIA type filtering remains unchanged.

The simulated destination Set proves stable issuance replay, not real V1
Message-ID deduplication or cross-database commit durability. Those tests, runtime
adapter/scheduler/route wiring, shutdown behavior and alerts remain pending.
Activation currently uses invitation-before-user mutation order whereas reset
locks user first: harmonize and test before enabling this worker. No worker is
wired yet. This checkpoint does not close the account delivery P1 or approve a
rollout. NOT_READY.

## Account lock-order correction

The initial contention test had an omitted import (proof 1791152307); that
is a harness failure and not the product RED. After fixing the import, proof
1791152351 reproduced 1 failed / 13 passed: activation and recovery could not
both finish in their expected terminal state under two observed lock waiters.
Account invite, resend, activation and reset now acquire the user lock before
mutating invitations. Activation rereads the invitation after acquiring the
lock. The corrected test passed in proof 1791152400 (14 tests), then the broader
real-Core account and HTTP campaign passed in 1791152437: 6 suites / 70 tests.

The rehearsal runner now captures Core output in memory and persists only
aggregate counts, failure source paths and an output hash. Raw account proof
values are not saved by this lane. No arbitrary sleep was added to production;
the contention test polls actual PostgreSQL lock state with a bounded deadline.
Cross-database destination and runtime recovery wiring are still pending.

## Real cross-database destination checkpoint

Proof 1791152673: 7 related Core suites / 71 tests passed; V1 synthetic encrypted
restore and Core old-schema migration checks also passed. The destination test
commits a real encrypted V1 intent, simulates loss of Core acknowledgment, then
replays it and verifies one row, identical ciphertext and identical Message-ID
using boolean assertions. It never contacts SMTP or a provider. A preceding
test (1791152625) failed because the adapter kicked the sender inside the Core
processing scope; the durable destination now defers that kick. Existing direct
adapter callers retain their kick semantics. V1 enqueue transactions explicitly
use 2-second maximum wait / 5-second timeout, below the Core 20-second bound.

The source manifest records HEAD, working diff digest and individual runtime/test
file digests. The runner verifies identity remained stable through this campaign;
these are precommit source proofs, not a replacement for final-SHA CI. Targeted
unit/architecture checks: 2 suites / 41 tests passed; typecheck and targeted lint
passed. Runtime scheduler/route wiring and resend command idempotence remain open.
No provider delivery, deployment, real data or production backup is claimed.

## Runtime wiring checkpoint

2026-10-04. Staff invite/resend and Core password reset now commit encrypted
handoff work before returning QUEUED; they do not claim provider delivery.
The supervised poller is automatic in HYBRID/V2_ONLY, disabled in V1_ONLY,
and refuses startup when the exact completed 0024/0025 migrations, enum or
validated constraint are missing. It coalesces drains and uses bounded retries.
Five scheduler unit tests pass, including missing schema and deferred sender
kick. Typecheck and targeted lint pass. HTTP fixtures initially omitted the
synthetic admin email (401); that harness error was corrected without weakening
authentication. The full real-database rerun 1791153537 passed eight suites /
78 tests with source identity stable and the owned disposable instance stopped.

V1 has an independent sender: deferring this worker's kick is not a global
send barrier. A revocation after transfer may produce an unusable link but
must not restore rights. Operational monitoring, process-kill recovery, actual
SMTP delivery, production restoration and rollback are not qualified. Resend
command retry identity remains a separate open item. NOT_READY.

## Resend command identity checkpoint

Three causal RED tests: proof 1791153907, 3 failed / 78 passed. After correction,
proof 1791154204 passed 8 real-Core suites / 85 tests, including concurrent
identical commands, different-account collision, revocation, expiration, final
failure and changed recipient. An independent UI RED had one failed test:
missing command header. UI retry then passed with the same key on unknown
network outcome and a new key only after a confirmed success/refusal.
The command key is scoped to the actor and validated as UUID; User row locking
serializes same-account retries. The existing encrypted intent supplies the
same issuance on replay only while all current eligibility checks still pass.
No extra audit or issuance is created by a replay.

Legacy callers omitting a key intentionally request a new issuance. The UI key
is held during the mounted action; a reload/remount loses that pending identity.
Key retention and encrypted-envelope retention must cover the guaranteed retry
window. These operational and multi-tab scenarios are not declared qualified.
No delivery, production operation or complete final-SHA CI is claimed.
