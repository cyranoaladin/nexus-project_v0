# Assessment and individual bilan reads consult canonical family authority

## Reproduction and acceptance

Three status-route tests first fail: a Core-refused parent receives 200, an
authority outage receives 200, and a verified Core guardian is filtered only by
the stale V1 parent relation. The required behavior is refusal before detailed
reads, 503 on authority outage, and a read bound to the authorized student.

## Correction

academic-read-authority loads only the assessment/bilan student identifier,
then calls resolveParentStudentAccess. Core-owned subjects never gain access
through an old parent relation. HYBRID's explicitly non-Core legacy case remains
handled by the existing family bridge. Missing/unlinked/denied records retain
404. Authority outage is 503 with private/no-store caching. Published status
remains required for parent bilans; reporting entitlement checks are retained.

The three assessment reads (status/result/export), individual bilan detail/export
and staff-only generation-status read use this boundary. Staff/student/coach
clauses and mutation permission checks remain unchanged. The existing positive
bilan fixture now supplies actual authorization identifiers; its exact student
binding and published constraint are asserted. No denial assertion is weakened.

## Executed evidence

Targeted unit/API regression and neighboring suites: 11 suites, 94 tests pass.
The real dual-store migration suite passes 20 tests, including six new cases
across HYBRID/V2_ONLY: a disabled canonical parent cannot use stale V1 ownership;
PENDING membership refuses, VERIFIED permits, canonical revocation refuses;
a verified guardian cannot retrieve a DRAFT. Verification/revocation use public
domain services and only synthetic fixtures. Existing 14 migration cases remain.

Lists, dashboards, invoice/payment/resource paths and other direct legacy
relationships remain separate porting work. This delta is not an assertion of
complete platform RBAC or production readiness. Final static checks and exact-SHA
CI must renew these local proofs.

No schema migration, pricing change, production access or frozen-tree write.
Rollback uses an ordinary commit revert.
