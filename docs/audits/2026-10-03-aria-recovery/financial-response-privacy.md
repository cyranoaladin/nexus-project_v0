# Financial response and log privacy

## Date and cause
2026-10-04, Africa/Tunis. Staff invoice/payment list and financial mutation/refusal responses lacked explicit private no-store headers. Pending payment read serialized database exceptions; adjacent mutation handlers also serialized messages/stacks. These may contain private financial details.

## Correction
A shared financial JSON response sets Cache-Control private/no-store and Vary Cookie/Authorization on success, validation, denial and failure. Existing statuses/body contracts are preserved. Four route files use it: staff invoice list/create, status mutation, pending payment list, payment validation. Error handlers log stable operation markers, not private exception messages/stacks. No authorization or diagnostic gate is weakened; append-only business audit is a separate concern.

## Proofs
RED: six privacy cases fail before correction. GREEN: twelve targeted suites, 159 tests pass, including nine new cases for cache boundaries and redaction. Targeted lint passes; typecheck completed before commit. No arbitrary sleeps, snapshots, provider requests or migrations.

## Limit
Not a proof of every application log or all sensitive routes. Binary invoice endpoints and queue response had earlier private caching controls. Whole-platform structured/correlated observability and production proxy/header smoke remain required.
