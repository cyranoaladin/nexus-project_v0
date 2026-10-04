# Atomic immutable evidence of invoice creation

2026-10-04. Parent source: `add695ad7`.

Invoice creation previously stored only mutable JSON events. The invoice and its
nested items now commit with an `INVOICE_CREATED` entry in
`InvoiceFinancialAccessAudit`, using the authorized canonical actor. PDF work
starts after that transaction commits, and never starts when audit creation
fails. No customer detail, document path, token or payment reference is copied
into this immutable evidence.

## Migration and compatibility

`20261004203000_invoice_creation_audit/migration.sql` expands the existing action
CHECK to include INVOICE_CREATED and preserves all previous actions. SHA-256:
`cbfac991866d8cf6f43d67a719d4c24154a7d28c01ab13c8dd219f01b4f4ff33`.
No rows, columns, foreign keys or triggers are removed. No historical backfill
is invented. Apply the migration before the application. Schema-compatible old
applications lacking the audit must not regain financial write access.
Production table-lock impact and actual restored data remain operational gates.

## Evidence

- Both reproduction tests failed before correction.
- Initial green attempt exposed an incomplete PDF error-class mock; it was
  corrected without changing production exception handling.
- Final unit/API campaign: 11 suites, 132 tests passed.
- First real-DB campaign: 14 passed, 1 failed because the fixture incorrectly
  expected the actor's total audit count to be zero despite the prior successful
  case. Fixed using an unchanged baseline and exact new-invoice count, without
  deleting immutable evidence.
- Renewed real-DB campaign: four suites, 15 tests passed; all 131 migrations
  and replay succeeded. A deliberately failed audit rolls back invoice/items,
  preserves the audit baseline and avoids PDF preparation. A new successful
  operation produces one invoice and one creation audit.
- Full predecessor exercise: exact 130 old migrations plus a synthetic SENT
  invoice and old PDF_READ audit, then migration131. Status, total and history
  remain unchanged; an interrupted new-action transaction rolls back and a
  subsequent operation succeeds. Four suites, 15 tests pass again.
- Typecheck, targeted lint, credential scan and diff-check passed.

Private evidence under `.artifacts/recovery/`:
`invoice-create-audit-red.log`, `invoice-create-audit-green-final.log`,
`invoice-status-green-1791136790/`, and
`invoice-creation-predecessor-1791136807/`. Owned temporary PostgreSQL instances
were stopped after label/tmpfs checks; no persistent volume or real data was used.

## Still-open creation risks

This lot does not qualify the complete creation flow. Canonical payer assignment,
idempotent creation and reprenable PDF generation remain necessary. A PDF failure
can still leave an audited DRAFT, and an unkeyed retry can create another draft.
Automatic number allocation stays atomic and non-reusable; a failed transaction
can leave an intentional gap. Do not expose unqualified financial writes in a
pilot. Full final-SHA CI and staging/production checks remain mandatory.
