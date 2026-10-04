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
