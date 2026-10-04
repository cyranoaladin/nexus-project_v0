# Financial mutation CSRF boundary

## Date and scope

2026-10-04. Parent source: `d298cfb4827fb32b36e0784ec373dc8397aa0e10`.
Four cookie-authenticated mutations: administrative invoice creation, invoice
status update, invoice email queue request, and payment approval/rejection.

## Defect and correction

These routes enforced identity and permission but omitted the existing server
`checkCsrf` guard. They now apply that guard after authentication/authorization
and before body parsing or financial access. Rejection is an opaque 403 with
private, no-store caching. Existing authentication/permission refusals remain.
The guard trusts configured origins, not request Host or forwarded headers.
No production origin exception, timeout change, permission expansion or migration
was added. Existing test/development behavior of the shared guard is unchanged;
the new boundary tests explicitly run its production branch.

## Evidence

- Before correction: 16/16 hostile/missing-origin cases failed.
- After correction: 12 suites, 180 tests passed, including all 16 refusals and
  four legitimate-origin requests retaining business validation.
- Refusals precede body reads, invoice/payment lookup and transactions.
- Payment test requests now use a real `NextRequest`, replacing the previous
  object containing only `json`; business assertions were retained.
- Private logs: `.artifacts/recovery/financial-csrf-red.log` and
  `.artifacts/recovery/financial-csrf-green-positive.log`.

## Limits and rollback

This proves these four API boundaries, not a full browser CSRF campaign or
production readiness. Other mutation routes still require complete review.
No database change; application rollback must preserve the security boundary.
The CI of the parent SHA does not qualify this subsequent change.
