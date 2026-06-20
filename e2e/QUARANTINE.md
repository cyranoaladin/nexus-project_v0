# E2E Quarantine Registry

Tests skipped with documented justification. Each must be either fixed or removed — never left indefinitely.

**Generated:** 2026-06-20

## describe.skip (entire spec quarantined)

| Spec | Tests | Category | Reason |
|------|-------|----------|--------|
| `e2e/auth/student-journey.spec.ts` | 6 | PRE-EXISTING | PRE-EXISTING: maths-1ere lab elements timeout — loading issue |
| `e2e/auth/nsi-pratique-2026.spec.ts` | 7 | PRE-EXISTING | PRE-EXISTING: getByText(\ |
| `e2e/auth/programme/maths-1ere.spec.ts` | 4 | PRE-EXISTING | PRE-EXISTING: maths-1ere tab/header elements not rendering |
| `e2e/auth/programme/maths-1ere-premium.spec.ts` | 5 | PRE-EXISTING | PRE-EXISTING: maths-1ere page elements not visible — feature incomplete |
| `e2e/auth/programme/maths-1ere-access.spec.ts` | 6 | PRE-EXISTING | PRE-EXISTING: hardcoded 127.0.0.1:3000, incompatible with Docker E2E |
| `e2e/auth/parent-dashboard-audit.spec.ts` | 8 | PRE-EXISTING | PRE-EXISTING: expects data-testid=\ |

## Individual test.skip

| Spec | Test | Category | Reason |
|------|------|----------|--------|
| `test-bilan-banner.spec.ts` | Bilan gratuit banner uses API (not localStorage) | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `payments.invoice.documents.spec.ts` | parent déclare un virement + pending détecté | PRE-EXISTING | PRE-EXISTING: payment confirmation API returns 400 — seed data mismatch |
| `password-reset.spec.ts` | forgot password form rejects empty email | REFONTE | REFONTE: forgot password submit button selector changed — main button[type= |
| `teacher-bilan-pdf.spec.ts` | devrait afficher le bilan avec le logo et la mise en forme correcte | PRE-EXISTING | PRE-EXISTING: Enseignant button not found — maths-1ere teacher view loading |
| `forms-validation.contract.spec.ts` | Double-click submit -> une seule requete API | REFONTE | REFONTE: bilan-gratuit form selectors changed |
| `forms-validation.contract.spec.ts` | Soumission valide -> redirect assessment | REFONTE | REFONTE: bilan-gratuit form selectors changed |
| `forms-validation.contract.spec.ts` | API 500 -> erreur visible | REFONTE | REFONTE: contact form error feedback changed |
| `nexus-refactor-validation.spec.ts` | Homepage: expected strings present | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `nexus-refactor-validation.spec.ts` | Catalogue and selector: campaign tariff is based on limited places, not dates | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `nexus-refactor-validation.spec.ts` | Homepage: expected content and prices are present in server HTML | PRE-EXISTING | PRE-EXISTING: catalogue/selecteur HTML not in E2E container, or content strings changed |
| `admin-dashboard-audit.spec.ts` | bouton déconnexion fonctionne | FLAKY | FLAKY: logout redirect race condition — session/cookie timing |
| `navigation-public.contract.spec.ts` | formulaire contact home appelle /api/contact | REFONTE | REFONTE: contact form selectors changed |
| `eleve-dashboard-audit.spec.ts` | charge avec les éléments principaux | PRE-EXISTING | PRE-EXISTING: dashboard does not display credits/solde text |
| `eleve-dashboard-audit.spec.ts` | widget crédits est visible | PRE-EXISTING | PRE-EXISTING: dashboard does not display credits/solde text |
| `stages.workflow.spec.ts` | /stages loads Printemps 2026 page | REFONTE | REFONTE: /stages heading text changed — needs inspection of actual current heading |
| `student-automatismes.spec.ts` | Accès et navigation dans les automatismes | PRE-EXISTING | PRE-EXISTING: automatismes Question Suivante button not found — feature loading issue |
| `parcours-eleve-stmg-premiere.spec.ts` | ouvre le cockpit commando STMG depuis le dashboard | PRE-EXISTING | PRE-EXISTING: Stage Commando EAM text not in current page |
| `entitlements.gating.spec.ts` | ARIA Maths sans entitlement -> 403 + access-required | PRE-EXISTING | PRE-EXISTING: requires seeded student user and DB helpers in E2E container |
| `test-all-dashboard-pages.spec.ts` | Admin — toutes les pages | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts` | Assistante — toutes les pages | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts` | Coach — toutes les pages | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts` | Parent — toutes les pages | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts` | Élève — toutes les pages | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-all-dashboard-pages.spec.ts` | Pages spéciales authentifiées | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts` |  | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts` | Sécurité: mauvais password → reste sur signin | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-real-login.spec.ts` | Sécurité: parent ne peut pas accéder dashboard élève | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `booking.credits.spec.ts` | booking + idempotence + annulation avec refund | FLAKY | FLAKY: credits balance race condition + rate limiting with parallel workers |
| `public-front-go-live.spec.ts` |  | REFONTE | REFONTE: /stages heading changed |
| `test-dashboard-interactions.spec.ts` | ADMIN — créer user via dialog → existe en DB | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | PARENT — dialog ajouter enfant fonctionne | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | PARENT — banner bilan gratuit appelle /api/bilan-gratuit/status | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | COACH — page disponibilités charge avec contenu | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | ÉLÈVE — page sessions charge | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | ADMIN — recherche utilisateurs fonctionne | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | DÉCONNEXION — admin redirigé après logout | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `test-dashboard-interactions.spec.ts` | DÉCONNEXION — parent redirigé après logout | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
| `nexus-premium-final.spec.ts` | catalogue expose des cartes structurées et des détails premium | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container |
| `nexus-premium-final.spec.ts` | sélecteur affiche un résultat diagnostic avec CTA attendus | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container |
| `nexus-premium-final.spec.ts` | navigation publique complète et liens WhatsApp | PRE-EXISTING | PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container |
| `test-all-pages.spec.ts` | Toutes les pages publiques | PRE-EXISTING | PRE-EXISTING: hardcoded localhost:3000, incompatible with Docker E2E |
