# Assistant invoice access fixture reconciliation

## Date and cause
2026-10-04, Africa/Tunis. CI at 39e92fe786087d1730e4041f275d58aadb8fc86f: Unit Tests reports 14,605 passes, two failures; 1,309 suites pass and one fails. Both failures assert the previous invoice generator on the assistant page, which now intentionally provides an authorized consultative list under canonical financial permissions.

## Correction and tests
Port the server-page child fixture from generator to the actual invoice-list child. Keep the two authorized role rendering assertions and redirect assertions. Add missing canonical ID refusal and explicit ELEVE/PARENT/COACH/UNKNOWN refusals. Actual list mutation-control behavior is covered separately by the real React UI tests, not this child stub.

RED locally: two failed, two passed before port. GREEN broader financial/RBAC/architecture campaign: 34 suites, 526 tests pass. This reconciles the test with the restrictive product policy; no financial assertion, role permission or expected denial is weakened. Production build is qualified only by the future exact-SHA CI.
