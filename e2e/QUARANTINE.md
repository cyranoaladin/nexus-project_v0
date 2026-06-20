# E2E Quarantine Registry

Tests skipped with documented justification. Each must be fixed or removed — never left indefinitely.

**Updated:** 2026-06-20

## describe.skip (entire spec quarantined)

| Spec | Category | Reason |
|------|----------|--------|
| `e2e/auth/student-journey.spec.ts` | PRE-EXISTING | PRE-EXISTING: maths-1ere lab elements timeout — loading issue |
| `e2e/auth/nsi-pratique-2026.spec.ts` | PRE-EXISTING | PRE-EXISTING: getByText(\ |
| `e2e/auth/programme/maths-1ere.spec.ts` | PRE-EXISTING | PRE-EXISTING: maths-1ere tab/header elements not rendering |
| `e2e/auth/programme/maths-1ere-premium.spec.ts` | PRE-EXISTING | PRE-EXISTING: maths-1ere page elements not visible — feature incomplete |
| `e2e/auth/programme/maths-1ere-access.spec.ts` | PRE-EXISTING | PRE-EXISTING: hardcoded 127.0.0.1:3000, incompatible with Docker E2E |
| `e2e/auth/parent-dashboard-audit.spec.ts` | PRE-EXISTING | PRE-EXISTING: expects data-testid=\ |

## Individual test.skip (41 tests)

| Spec | Category | Reason |
|------|----------|--------|
| `test-bilan-banner.spec.ts:6` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `payments.invoice.documents.spec.ts:21` | PRE-EXISTING | PRE-EXISTING: payment confirmation API returns 400 — seed data mismatch |
| `password-reset.spec.ts:21` | REFONTE | REFONTE: forgot password submit button selector changed — main button[type= |
| `teacher-bilan-pdf.spec.ts:5` | PRE-EXISTING | PRE-EXISTING: Enseignant button not found — maths-1ere teacher view loading |
| `forms-validation.contract.spec.ts:56` | REFONTE | REFONTE: bilan-gratuit form selectors changed |
| `forms-validation.contract.spec.ts:74` | REFONTE | REFONTE: bilan-gratuit form selectors changed |
| `forms-validation.contract.spec.ts:120` | REFONTE | REFONTE: contact form error feedback changed |
| `nexus-refactor-validation.spec.ts:85` | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `nexus-refactor-validation.spec.ts:94` | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `nexus-refactor-validation.spec.ts:239` | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `admin-dashboard-audit.spec.ts:18` | FLAKY | FLAKY: logout redirect race condition — session/cookie timing |
| `navigation-public.contract.spec.ts:45` | REFONTE | REFONTE: contact form selectors changed |
| `eleve-dashboard-audit.spec.ts:11` | PRE-EXISTING | PRE-EXISTING: dashboard does not display credits/solde text |
| `eleve-dashboard-audit.spec.ts:19` | PRE-EXISTING | PRE-EXISTING: dashboard does not display credits/solde text |
| `stages.workflow.spec.ts:23` | REFONTE | REFONTE: /stages heading text changed — needs inspection of actual current heading |
| `student-automatismes.spec.ts:10` | PRE-EXISTING | PRE-EXISTING: automatismes Question Suivante button not found — feature loading issue |
| `parcours-eleve-stmg-premiere.spec.ts:50` | PRE-EXISTING | PRE-EXISTING: Stage Commando EAM text not in current page |
| `entitlements.gating.spec.ts:16` | PRE-EXISTING | PRE-EXISTING: requires seeded student user and DB helpers in E2E container |
| `test-all-dashboard-pages.spec.ts:58` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts:71` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts:84` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts:95` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts:106` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts:118` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts:14` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts:48` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts:59` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `booking.credits.spec.ts:119` | FLAKY | FLAKY: credits balance race condition + rate limiting with parallel workers |
| `public-front-go-live.spec.ts:232` | REFONTE | REFONTE: /stages heading changed |
| `test-dashboard-interactions.spec.ts:18` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:71` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:99` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:118` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:136` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:153` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:176` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts:204` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `nexus-premium-final.spec.ts:31` | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E co |
| `nexus-premium-final.spec.ts:74` | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E co |
| `nexus-premium-final.spec.ts:105` | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E co |
| `test-all-pages.spec.ts:42` | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
