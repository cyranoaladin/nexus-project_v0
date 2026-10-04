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

At intermediate commit 4116d0a5d, token-based anonymous PDF reads were still unaudited because there was no authenticated actor. The subsequent signed-link/session correction below removes this alternate authority rather than inventing an actor. Session audits still do not identify the specific delegation used. Financial capability status stays PARTIEL.

### DB-core harness correction — 4 October 2026

The 57ef2ca66 CI's live FK inventory passed (missing/stale/action mismatch all zero); its non-Bilan real-DB lane passed 73 tests. DB-core reached 292 passing tests but the new 10-test financial predecessor suite failed before SQL because it erroneously required the distinct E2E harness contract (`nexus_e2e`). The suite now uses the unchanged shared DB-core guard: explicit NEXUS_DISPOSABLE_POSTGRES marker, loopback host, and strict nexus_disposable_*_test name. Production and unmarked targets remain forbidden. No guard was relaxed. Cleanup after a failed setup no longer masks the original guard error with an undefined-client exception.

Reproduction and correction: exact-SHA CI supplied the red evidence; a new owned PostgreSQL 15 Alpine instance, loopback-only with tmpfs, synthetic credential in a private env file, supplied 10/10 green on the corrected suite. The fixture transaction and private schema are rolled back. The canonical guard's 3 unit tests also pass. No production database was accessed. Full final-SHA CI remains required.

### Signed links cannot bypass financial authority — 4 October 2026

The token branch formerly bypassed authentication, payer/delegation filtering and access audit. Four regressions demonstrated downloads with no session, an out-of-scope parent or a student, plus an unrecorded actor for a valid link. Signed links now add expiry/revocation/ID checks to the same financial session query; they never replace it. Every successful invoice PDF read therefore uses the authenticated authorized actor and awaited append-only evidence, including requests containing a token. The email's HTML/text explicitly instructs the payer to log in before opening the link. No token is published or an anonymous actor invented.

The existing valid-link success test retains its PDF assertions with an authorized session; its missing-PDF fixture was ported to the canonical scoped query. An intermediate run failed this obsolete fixture (267 successes / 1 failure), then was corrected without changing the expected 404. Anonymous link access has been intentionally removed to enforce the direction's restrictive finance rule; this is documented behavior, not a silent feature flag. The link's existing digest format and the precise delegation audit reference remain separate qualification work.

The new PostgreSQL 15 tmpfs fixture was verified to contain zero finance_authority_* schemas after rollback, then its exact owned container was stopped and automatically removed. No persistent database or volume was deleted. Its private metadata/credential file remains outside versioned content.

### Supplemental link nonce boundary — 4 October 2026

Invoice link nonces are generated with 256 bits of CSPRNG entropy and stored only as SHA-256 digests. They are not passwords, short codes or an alternative financial authorization: the signed-link route still requires an authenticated payer/delegate session. This boundary does not claim a dedicated HMAC format or single-use semantics for invoice links; Core account credentials have a separate HMAC contract. Rotation/revocation and final security review remain qualification gates.

Verification now rejects every noncanonical 64-character lowercase hexadecimal nonce before database lookup and rejects expiry at the exact expiration instant. A fixed-clock regression suite reproduced nine failures and one success before correction. After correction, four token suites pass all 41 tests. Existing positive database fixtures now use canonical opaque test vectors while preserving expired, revoked and unknown-token assertions. No real token or message was used.

### Exact-SHA unit CI fixture reconciliation — 4 October 2026

Remote 9342f7d80 reports 1,300 passing suites / 2 failing suites and 14,548 passing tests / 6 failures. Local isolated reproduction exposed nine failures / eight successes because resetMocks and coverage configuration differ from the aggregate CI run. Both failing suites used obsolete fixtures: family beneficiaries as financial authority, anonymous-token findUnique lookups, and the former asynchronous JSON audit. Production permission rules were not broadened to satisfy these tests.

The phone-only parent tests now assert the entire payer-or-active-delegation filter with a fixed clock, explicitly deny customerEmail/beneficiary/child fallback, and cover absent canonical session ID. Draft-preview and published-link fixtures now provide the scoped session query and append-only audit mock. Receipt audit failure now asserts opaque 404 rather than an unaudited 200. The two suites pass all 18 tests locally; no assertion disabling or new skip was introduced.

The send-route review corrected its initial concurrency hypothesis: invoiceNumber deduplication permits only one outbox insertion, so a second request fails P2002 after creating an unused token, and legitimate resend is broken. A crash after enqueue can still leave no invoice event. Distinct operation idempotency, atomic token/outbox/evidence and resend semantics are unresolved P1; no claim of two successful duplicate sends is retained.
