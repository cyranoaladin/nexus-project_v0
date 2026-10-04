# Subscription request party ownership

## Date and decision
2026-10-04, Africa/Tunis. A family link does not authorize another guardian’s price, reason or request. A requester may read their own proposal, but this grants no invoice/payment permission.

## Correction
Add nullable `requestedByUserId` referencing canonical User with RESTRICT, plus student/requester/date index. Both server writers assign the authenticated ID. GET applies student-family scope AND requester ID before fetching, uses explicit SELECT, omits identity/email/staff identifiers, and returns private/no-store. Missing session identity fails before DB access. Errors use fixed markers. No consumer requiring removed fields was found during read-only review.

Historical NULL ownership is intentionally denied. Do not backfill from email/name, including when these happen to match. Existing nullable inserts remain schema-compatible; an old application’s broad family authorization is NOT an acceptable rollback target.

## Migration
`20261004190000_subscription_request_owner/migration.sql`; SHA-256 `93b35c09e9b8ab073056c8217e227fef811c32e89ba27e78fcd5d1592c7c71ae`. Add one nullable column, one FK, one index. No deletes, price changes or data backfill. Standard Prisma migration tracking makes committed deployment replay safe. On interrupted DDL transaction, roll back and replay through the deployment mechanism. No destructive down migration.

## Proofs
- RED: two route regressions fail, seven pass, before implementation.
- GREEN: six targeted unit suites, 144 tests pass (including prior family-price projection and credential scanner); typecheck passes.
- Real PostgreSQL: four requester tests and four invoice queue tests pass on a fresh pinned CI pgvector instance. Own request only; historical NULL/other requester excluded; unrelated requester refused; fabricated FK refused; deleting requester refused.
- Representative predecessor fixture: old rows remain, old insert omitting owner remains accepted, unknown owner FK refused, interrupted transaction rolled back and reapplied. This minimal fixture is not a restored production backup or a full old-application qualification.
- Full schema deployed from empty DB; exact replay and final suite renewed before commit. See private `.artifacts/recovery/subscription-owner-*.log`; no DSN or fixture key in versioned evidence.
- Owned loopback/tmpfs instances stopped after proof. No persistent volume or user data removed. No real provider sends.

## Remaining risks
Legacy family linkage still requires wider qualification; no actual UI/E2E or production claim. Large-table index duration/locks need staging measurements. Global restore/rollback, TLS rotation, human review and latest SHA CI remain blocking. Request ownership does not qualify billing or authorization of every financial mutation.
