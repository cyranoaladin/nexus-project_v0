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

### Foreign-key retention inventory — 4 October 2026

The `6a8b2baac` Real DB Integration job applied all migrations successfully, then refused three unclassified user FKs before running tests. This was a missing classification introduced by the additive authority migration, not a database migration failure. The manifest now classifies invoice payer and financial delegate as FINANCIAL_RESTRICT, audit actor as AUDIT_RETAIN, all ON DELETE RESTRICT. No retention duration or erasure permission is invented. The unchanged static inventory checker reproduced 4 failures / 109 successes before correction and passes all 113 tests afterward. The live PostgreSQL manifest check remains subject to the next exact-SHA CI.

### Invoice email recipient boundary — 4 October 2026

The administrative send endpoint formerly created a bearer link addressed to `customerEmail`, without proving a payer identity or verified email channel. Two synthetic regression cases demonstrated this unauthorized recipient selection. The endpoint now selects the invoice's explicit payer and verified email before creating a token or enqueuing a message; absent/ambiguous payer and unverified/missing email fail closed. The positive test deliberately keeps a different legacy customer email and verifies delivery selection uses only the canonical payer's verified address. ORM errors are reduced to a fixed log marker. No real message was sent.

This is recipient selection hardening, not complete communications qualification: bearer recipient binding/revocation, send concurrency and append-only access audit remain to be qualified. The sender queues delivery; historical `INVOICE_SENT_EMAIL` entries must not be used as proof of provider delivery. All financial and external communication capabilities remain PARTIEL.

### Queue acceptance is not delivery — 4 October 2026

A successful administrative send request now returns HTTP 202 with `deliveryStatus: QUEUED` and appends `INVOICE_EMAIL_QUEUED`, not an unobserved `INVOICE_SENT_EMAIL`. The existing rate limit counts both queued intents and historical sent events, preventing the semantic correction from opening a throttle bypass. Two route regressions failed before the change; the route and neighboring event/throttle tests now pass (3 suites, 46 tests). Actual SMTP delivery remains a distinct outbox/provider event. No UI caller of this invoice send endpoint was found in the application source; API clients must distinguish queue acceptance from delivery.

### Awaited append-only download evidence — 4 October 2026

Authorized session PDF and receipt responses now await a dedicated `InvoiceFinancialAccessAudit` insert after artifact reading/rendering and before HTTP 200. Actor, invoice, action and a server-generated UUID request key are the only new audit fields; no raw token, URL or client payload is recorded. This means authorized response preparation, not a claim that a client received every byte. The receipt's asynchronous JSON read-modify-write was removed. Audit failure preserves the opaque refusal contract and yields no PDF success.

Regression: 4 failures / 2 successes on the uncorrected routes, after correcting the test fixture's old JSON-event mock. Final route suite: 26 tests in 3 suites pass, including deterministic deferred persistence, two simultaneous requests with distinct audit entries, denied scope and artifact failure. Typecheck and targeted lint pass. Simultaneous request tests are unit evidence; cross-client PostgreSQL concurrency remains an integration gate. Existing real-DB append-only constraints were established separately.

Token-based anonymous PDF reads are not claimed audited: that contract has no authenticated actor, and this change does not invent one. An explicit token principal and recipient/revocation contract is still required before financial general access. Session audits also do not yet identify the specific delegation used. Financial capability status stays PARTIEL.
