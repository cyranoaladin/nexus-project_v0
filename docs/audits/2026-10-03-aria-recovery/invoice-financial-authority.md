# Explicit invoice financial authority — 4 October 2026

## Acceptance and direction decision

Family membership, beneficiary identity and matching email do not establish a payer. Students receive no financial data. A parent reads only a non-DRAFT invoice as its explicit payer or through an active, unrevoked invoice-specific financial delegation. Existing ADMIN financial management and ASSISTANTE PAYMENT READ permissions remain distinct from family ownership. Unknown/support/coach/student roles are denied.

## Change

The canonical list and individual invoice scope uses payerUserId or a delegation filtered before the database read by delegate identity, start, strict expiry and revocation. The legacy email-only scope helper now denies parents. This is a deliberate strengthening of the current contract; old permissive unit expectations were replaced, not weakened to satisfy obsolete behavior.

Payment validation assigns the payer from the canonical Payment.userId inside the same transaction as invoice creation, payment state and entitlements. The beneficiary remains separate. Payer assignment adds an append-only financial access event with a payment-specific idempotency key. No payer is inferred from an email or parent-child link.

## Additive migration

`20261004170000_invoice_financial_authority/migration.sql` adds nullable payer authority, a foreign key, an invoice-payer unique key and index, explicit delegated-access records, and financial access audit records. A composite foreign key prevents delegation attribution to another payer and prevents silently cascading a payer change to existing grants. Expiry must follow start and self-delegation is rejected. A narrow trigger rejects audit update/delete. No predecessor invoice is deleted or rewritten and no ambiguous identity is backfilled. New fields/tables are additive; the old application ignores them.

## Evidence

- New authority regression: 3 failed / 4 passed before change; initial seven pass after change; final nine pass, including fixed server-clock boundaries and empty-identity refusal.
- Invoice neighboring scope/API/library suites: 22 suites / 328 tests passed.
- Payment payer regression: one failed before assignment; two payment suites / 24 tests passed after assignment.
- Real PostgreSQL predecessor constraint tests: 10 passed. The isolated schema includes predecessor invoices; an interrupted initial DDL is rolled back, then the exact versioned migration is applied. Unknown legacy payers remain NULL. Wrong payer, duplicate key, invalid expiry, self-delegation, payer change under an existing delegation and audit update/delete are rejected.
- Schema validation and client generation succeeded. PostgreSQL tests execute within a transaction and roll back their own isolated schema; no existing fixture or production table is altered.

## Remaining qualification

These tests are not proof of full migrations from an entire old application database, a backup restoration, production rollback, delegated-access UI/service lifecycle, administrative payer assignment, invoice/download append-only auditing or sandbox provider reconciliation. Those gates remain open. No legacy invoice is automatically exposed; identifying its payer requires independent evidence and an audited workflow. The delegation schema is a contract, not a claim that the delegation feature is delivered. No production migration or deployment has occurred.

### Legacy ownership guard and rollback gate — 4 October 2026

The shared `requireParentOwnsInvoice` guard now consumes the canonical payer/delegation predicate before its database read. A beneficiary relationship alone is refused, including when a legacy parent/child row exists. Three regression tests failed before the correction; the corrected guard and neighboring guards/authority tests pass (5 suites, 57 tests). No runtime caller of this legacy helper was established by the read-only review; the change removes an unsafe alternate contract.

Application rollback compatibility is not merely schema compatibility: a release using the old family/email invoice authorization would reintroduce the exposure. No production rollback target is qualified until it enforces the same restrictive financial policy, or financial endpoints remain closed by a reviewed server-side control. The old release must not be described as a safe rollback on the basis of additive DDL alone.
