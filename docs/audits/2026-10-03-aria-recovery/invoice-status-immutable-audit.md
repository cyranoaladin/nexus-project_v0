# Immutable invoice status evidence

2026-10-04. Parent source: `81baf60b773e6d536386b4ad45c88dc5989415d8`.

## Defect and correction

The status route retained mutable JSON events but did not append its accepted
transition to `InvoiceFinancialAccessAudit`. Each successful MARK_SENT, MARK_PAID
or CANCEL now records respectively INVOICE_SENT, INVOICE_PAID or INVOICE_CANCELLED
with the canonical actor and invoice, inside the same transaction as the
state-conditional update. The evidence contains no payment reference, note,
email, token or document. No-op retries do not generate duplicate evidence;
losing snapshot races fail before recording an accepted transition.

Both terminal and non-terminal transitions use a transaction. An audit failure
rolls back status, token revocation and transactional entitlement changes.
Existing JSON events remain for compatibility, not as the immutable authority.

## Additive migration

`20261004200000_invoice_status_audit/migration.sql` expands the existing action
CHECK vocabulary without rewriting or removing data. SHA-256:
`364a549be3174f1f5c7457ff58950e00684acd9a22f9ea607cbcca0ae084edb4`.
The append-only trigger and foreign keys remain. No backfill is attempted:
historical JSON cannot prove an immutable historical event. Apply the migration
before this application version. Old applications remain schema-compatible,
but versions lacking this audit must not regain financial mutation access.
Constraint replacement takes a table lock; production duration/lock impact and
a restored representative financial dataset remain unqualified.

## Tests and limits

- Initial test mock omitted the real event helpers (3 failed, 1 passed); it was
  corrected before attributing the defect to production.
- Valid reproduction: all four targeted tests failed before implementation.
- Corrected code: 11 suites / 140 unit/API tests passed.
- Disposable PostgreSQL: all 130 migrations applied, replay had no pending
  migration, and three suites / 13 tests passed. One audit per accepted racing
  decision and no duplicate on retry are verified.
- A missing audit actor FK forces failure after the attempted status write;
  actual PostgreSQL preserves SENT, retains the unrevoked token and records
  zero audit rows. No trigger is disabled to clean up evidence.
- Minimal predecessor rehearsal passed; this is not a production backup restore.
- Typecheck, targeted lint, credential scan and diff-check passed.

Private evidence: `.artifacts/recovery/invoice-status-audit-red-final.log`,
`invoice-status-audit-green.log`, and
`invoice-status-green-1791135497/` beneath that private artifact directory.
Invoice creation, financial delegation lifecycle and all other financial writers
still require their own complete immutable audit qualification.

## Full predecessor-schema follow-up

On committed source `326c73598`, a second owned tmpfs PostgreSQL instance applied
the exact 129 predecessor migrations, recorded their file hashes, then created
one synthetic SENT invoice (total 1000) and one immutable PDF_READ audit. Deploying
migration 130 and replaying migrations preserved that status, total and old audit
count. A deliberately interrupted transaction creating INVOICE_SENT rolled back
without changing the count; a subsequent operation recorded the new action.
The same three real-DB suites passed again (13 tests). Private evidence:
`.artifacts/recovery/invoice-status-predecessor-1791135808/`.
The temporary instance was stopped only after ownership label and tmpfs checks;
it had no persistent volume. This strengthens synthetic old-schema compatibility,
but still does not establish production lock duration or backup restoration.
