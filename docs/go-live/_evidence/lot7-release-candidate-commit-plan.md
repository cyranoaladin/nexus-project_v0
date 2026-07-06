# Lot 7 — Plan de commits release candidate

Ce plan ne cree aucun commit. Il propose une decomposition lisible pour revue humaine.

## 1. `security-api-p1-closure`

Inclure :

- Routes API sensibles durcies : `app/api/documents/**`, `app/api/invoices/**`, `app/api/bilans/**`, `app/api/npc/**`, `app/api/parent/**`, `app/api/student/**`, `app/api/coach/**`, `app/api/stages/**`, `app/api/admin/**`, `app/api/assistante/**`.
- Helpers de projection/ownership associes : `lib/invoice/**`, `lib/stages/**`, `lib/validations.ts`.
- Tests IDOR et no-leak associes dans `__tests__/api/**`.

Risque : commit volumineux ; verifier que les tests IDOR restent lisibles.

## 2. `public-funnel-rgpd-assessment-token`

Inclure :

- `app/api/bilan-gratuit/route.ts`
- `app/api/bilan-gratuit/dismiss/route.ts`
- `app/bilan-gratuit/assessment/page.tsx`
- `app/bilan-gratuit/assessment/AssessmentClient.tsx`
- `app/api/assessments/public-token/route.ts`
- `app/api/assessments/submit/route.ts`
- `app/api/assessments/submit/types.ts`
- `components/assessments/AssessmentRunner.tsx`
- `lib/assessments/public-token.ts`
- `lib/crm/contact-leads.ts`
- tests assessment/bilan associes.

Risque : flux public critique ; conserver les tests Playwright assessment.

## 3. `runtime-rate-limit-business-config`

Inclure :

- `app/api/internal/health/route.ts`
- `app/api/internal/rate-limit-probe/route.ts`
- `lib/rate-limit/index.ts`
- `lib/config/snapshot.ts`
- tests `internal.health`, `internal.rate-limit-probe`, `business-config`.

Risque : ne pas confondre preuves locales avec preuves staging/production.

## 4. `payments-clictopay-disabled`

Inclure :

- `app/api/payments/clictopay/init/route.ts`
- `app/api/payments/clictopay/webhook/route.ts`
- `components/marketing/PaymentMethodsNote.tsx`
- tests ClicToPay disabled/feature-flag.

Risque : garder `CLICTOPAY_STATUS=DISABLED`, aucune activation paiement carte.

## 5. `maintenance-contactlead-retention`

Inclure :

- `scripts/maintenance/contact-leads-retention.ts`
- tests retention ContactLead.
- docs runbook retention.

Risque : ne jamais executer `--apply` sans validation humaine.

## 6. `tests-security-e2e`

Inclure :

- nouveaux tests `__tests__/api/**`, `__tests__/lib/**`, `__tests__/scripts/**`, `__tests__/ui/**`.
- `e2e/pages-public-bilan-assessment-token.spec.ts`
- modifications Playwright publiques et `playwright.config.ts`.

Risque : verifier la stabilite sous Node 20 avant commit.

## 7. `docs-go-live-evidence`

Inclure :

- `docs/go-live/**`
- `docs/security/API_GUARD_INVENTORY.md`
- `docs/audits/audit-nexus-reussite.md` seulement si revue humaine confirme son utilite.

Exclure :

- `rapport_audit_2_07_2026.md` sauf decision humaine explicite.
- `.env*`
- `.next/`, `node_modules/`, `test-results/`, `playwright-report/`
- tout artefact local non necessaire a la release candidate.
