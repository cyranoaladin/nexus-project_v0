# Résolution des 61 divergences suivies

Base : `5ffd4dd8e1fb91b0eea42398670a260402660699`. Aucun choix par récence.

| Chemin | Domaine | Décision et raison |
| --- | --- | --- |
| `__tests__/api/quotes.accept.route.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/api/quotes.create.route.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/api/quotes.margin.route.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/api/quotes.send.route.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/bilans/saisie-papier-workflow.test.tsx` | diagnostics | retain-verified-main — Keep current diagnostics contracts; no unproven earlier version promoted. |
| `__tests__/bilans/teacher-dossier-render.test.ts` | diagnostics | retain-verified-main — Keep current diagnostics contracts; no unproven earlier version promoted. |
| `__tests__/components/dashboard/assistante/DevisWorkspace.test.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `__tests__/components/offres-page.test.tsx` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/components/quotes/DevisWizard.test.tsx` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/database/quote-persistence.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/homepage/landing-invariants.test.ts` | aria | retain-verified-main — Keep merged #318/#319 lifecycle and native API contracts. |
| `__tests__/lib/candidat-individuel-pricing.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/exams-catalog.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/pricing-canonical-validator.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/quotes/margin.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/quotes/pdf-adapter.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/quotes/recommendation.test.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `__tests__/lib/rate-limit.s3-final-contract.test.ts` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
| `__tests__/marketing/acadomia-inspired-guardrails.test.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `__tests__/marketing/echeancier-reconciliation.test.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `__tests__/marketing/french-typography-guard.test.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `__tests__/marketing/public-lux-charte-guard.test.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `__tests__/marketing/seo-landings-guard.test.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `app/HomePageClient.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `app/api/quotes/[id]/accept/route.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/api/quotes/[id]/send/route.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/api/quotes/public/[token]/route.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/api/quotes/recommend/route.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/api/quotes/route.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/devis/[token]/page.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `app/offres/page.tsx` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `app/recommandation/page.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `components/dashboard/assistante/DevisWorkspace.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `components/premium/ExamCard.tsx` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `components/quotes/DevisWizard.tsx` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `components/quotes/ScenarioCard.tsx` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `content/marketing/seo-landings.ts` | public-ui | retain-verified-main — Keep current consumers of validated catalogue and role contracts. |
| `data/exams/bac-general-2027.json` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `data/pricing-client-data.generated.json` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `data/pricing.canonical.json` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `e2e/monthly-pricing-proof.spec.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/exams/catalog.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/exams/schema.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/pricing.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/diagnostic.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/exam-profile.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/margin.server.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/pdf-adapter.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/persistence.server.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/pricing.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/priority.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/public-view.server.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/recommendation.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/schemas.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/quotes/snapshot.server.ts` | quotes-pricing | retain-verified-main — Keep current candidate-context and validated sans-acompte pricing; older reversals rejected. |
| `lib/rate-limit/sensitive.ts` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
| `middleware.ts` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
| `next.config.mjs` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
| `package.json` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
| `prisma/schema.prisma` | documentation-or-tooling | retain-verified-main — Historical evidence/operation outputs cannot certify the new SHA. |
| `release-manifest.json` | security-runtime | retain-verified-main — Keep current security/standalone/permission guards; older removal rejected. |
