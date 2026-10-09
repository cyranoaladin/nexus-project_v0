# Invoice financial write permission boundary

## Date and policy
2026-10-04, Africa/Tunis. Invoice mutations require the existing canonical PAYMENT UPDATE permission. No new role or permissive grant is added. ASSISTANTE has PAYMENT READ only; ADMIN has PAYMENT MANAGE.

| Role | Invoice list/PDF | Create/status/email queue | Condition |
|---|---|---|---|
| ADMIN | Existing staff scope | Allowed | Canonical authenticated ID and PAYMENT UPDATE |
| ASSISTANTE | Existing authorized staff read | Denied | PAYMENT READ is not a write grant |
| PARENT | Published invoice only | Denied | Explicit payer party or active audited delegation; family membership alone grants nothing |
| ELEVE / COACH | Denied | Denied | No financial permission |
| Missing/unknown identity/role | Denied | Denied | Fail closed before financial lookup/mutation |

## Correction
The shared status-action helper resolves a known canonical role and calls `can(role, UPDATE, PAYMENT)`. Invoice POST now uses the helper. Existing PATCH, email route and direct enqueue service already share it. Staff invoice GET remains read-only. The assistant page renders the consultative invoice list rather than a creation form. Client creation/status controls and mutation modals require the same permission; handlers deny as well. Server authorization remains authoritative, including when UI is bypassed.

## Evidence
RED: shared permission and creation API regressions fail (two failed, 56 passed). GREEN: 26 financial unit suites, 364 tests pass. Ten direct-route/service denial cases use the actual permission helper, not a mock that forces authorization. Two React cases verify assistant reads/downloads without mutation controls and authorized admin retains controls. A positive creation fixture was ported to ADMIN, including its exact createdByUserId assertion; its monetary and PDF assertions remain intact. Initial positive fixture assertion retained the former assistant ID and correctly failed until aligned with the authenticated ADMIN. No assertion or timeout was weakened.

Targeted production/UI/test lint and typecheck pass. No migration or commercial price changes. Read-only review found no new P0/P1; no tests run by reviewer.

## Limits
This is not an E2E/visual or production qualification. Broader status-transition concurrency, append-only audit of every legacy financial action, provider sandbox, delegation administration and global operational gates remain to qualify. The prior interface permitting assistant creation is not a valid financial authorization contract and is intentionally restricted.
