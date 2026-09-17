# Account-deletion FK deletion-policy manifest

`account-deletion-fk-manifest.json` is the checked-in, reviewed BUSINESS
classification for every foreign key pointing at `User`/`Student`/
`ParentProfile`/`CoachProfile`. It is verified against real, live
`pg_constraint` data by `scripts/db/check-account-deletion-fk-manifest.ts`
(CI: "Real DB Integration" job) and, as a fast static check with no DB
required, by `__tests__/architecture/account-deletion-fk-inventory.test.ts`
(CI: "Unit Tests" job).

## Scope: what #273 is, and is not

#273 (this manifest, its migrations, and `lib/security/account-deletion-guard.ts`)
prevents a hard `DELETE` from silently cascading through real history,
pedagogical records, or financial data it should never have touched. That is
the full extent of its scope — it is **not** the platform's account-lifecycle
or data-retention architecture.

Nexus serves minors and stores real pedagogical history. A complete
lifecycle needs distinct, deliberately-designed operations beyond "block the
delete":

- **DISABLE_ACCOUNT** — deactivate access without deleting anything (the
  normal way to end a relationship with the platform).
- **ANONYMIZE_PERSON** — strip personally-identifying fields while
  preserving aggregate/historical records that must survive (e.g. for
  compliance or platform-quality analysis) without remaining attributable to
  a specific person.
- **DELETE_DISPOSABLE_PENDING_ACCOUNT** — a genuinely empty, never-activated
  account (no history exists yet to protect) may still be hard-deleted; this
  is the one case #273's "empty account deletes successfully" path already
  covers correctly.
- **LEGAL_RETENTION_PURGE** — a deliberate, audited purge once a defined
  retention period has elapsed, distinct from an ad hoc staff action.

Routine staff UX (Admin/Assistante) must not present destructive hard-delete
as the normal way for someone to leave Nexus — it should read as an
exception path (e.g. "genuinely empty test/duplicate account cleanup"), with
DISABLE_ACCOUNT as the default offboarding action once it exists. Building
DISABLE_ACCOUNT/ANONYMIZE_PERSON/LEGAL_RETENTION_PURGE is out of scope for
#273 and is not implemented here — this note exists so that scope boundary
is explicit rather than silently assumed.

## Manifest fields

- `conname`, `childTable`, `parentTable`, `onDelete` — must match live
  `pg_constraint` data exactly (enforced by the DB-ground-truth checker).
- `category` — one of `PURE_MEMBERSHIP_CASCADE_ALLOWED`,
  `EPHEMERAL_CASCADE_ALLOWED`, `HISTORICAL_RESTRICT`, `FINANCIAL_RESTRICT`,
  `AUDIT_RETAIN`.
- `justification` (present on relations re-reviewed during the #273
  FK-inventory hardening pass; not yet backfilled for every pre-existing
  entry) — `isIdentityMembershipOnly`, `isDerivedRebuildable`,
  `isPedagogicalHistory`, `isAuditRelevant`, `isCommercialEvidence`,
  `retentionRequirement`, and `whyCascadeIsSafe` (only meaningful for a
  `*_CASCADE_ALLOWED` entry).
