# Gates de release

Règle globale : **aucun go-live large n'est autorisé si un P0 reste ouvert**.

## Gate A — Site public marketing

- Conditions techniques : `typecheck`, `lint`, `test:unit`, `build`, `check:no-hardcoded`, `check:bundle-weight` OK ; pages publiques critiques en 200 en production.
- Conditions produit : promesse engagement de moyens, offres 2026/2027, stages août 2026, candidat libre clair, CTA bilan/WhatsApp.
- Conditions sécurité : formulaires publics avec validation, anti-spam/rate-limit, erreurs sobres.
- Conditions RGPD : consentement analytics avant GA/Pixel, politique confidentialité à jour, minimisation formulaire.
- Conditions monitoring : synthetic check `/`, `/offres`, `/bilan-gratuit`, `/contact`.
- Conditions support : WhatsApp, email et routage leads testés.
- Tests obligatoires : curls production, smoke Playwright mobile/desktop, soumission lead de test, vérification logs sans PII.
- Décision autorisée ou non : **autorisable pour pré-campagne organique avec réserves** si GA reste désactivé et ClicToPay masqué ; **non autorisable pour campagne paid** tant que `/bilan-gratuit` n'est pas aligné lead-only ou assumé avec consentement.

Conditions Lot 0-bis ajoutées :

- Smoke ciblé obligatoire : `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium`.
- GA/Pixel : aucun script non essentiel ne peut charger avant consentement ; `NEXT_PUBLIC_ENABLE_GOOGLE_ANALYTICS` doit rester absent/false tant qu'une CMP n'existe pas.
- ClicToPay : aucune mention/CTA public tant que `app/api/payments/clictopay/init/route.ts` ou webhook retournent `501`.
- Playwright : ne pas réutiliser un serveur local existant sauf opt-in explicite `PLAYWRIGHT_REUSE_EXISTING_SERVER=true`.

## Gate B — Bêta contrôlée plateforme

- Conditions techniques : Gate A OK, authentification stable, dashboards clés utilisables par comptes internes.
- Conditions produit : périmètre limité, familles pilotes informées, paiement carte désactivé si ClicToPay non finalisé.
- Conditions sécurité : routes P0 utilisées par bêta fermées ou désactivées ; documents/factures strictement propriétaires.
- Conditions RGPD : consentement familles, données minimisées, procédure suppression/export.
- Conditions monitoring : health public/interne, alertes DB/app/Redis/RAG/SMTP.
- Conditions support : canal incident, rollback compte, support manuel.
- Tests obligatoires : E2E par rôle, tests IDOR prioritaires, paiement manuel, facture PDF, entitlement.
- Décision autorisée ou non : **possible sous périmètre restreint**, pas en self-serve public.

## Gate C — Bêta élargie

- Conditions techniques : 0 P0 API, P1 critiques fermés, rate limiting distribué prouvé, backups restaurés.
- Conditions produit : parcours admission, paiement, droits et dashboards stables.
- Conditions sécurité : audit manuel routes dynamiques, logs redacted, headers/CSP revus.
- Conditions RGPD : registre traitement mineurs, consentements, politique documents, durée conservation.
- Conditions monitoring : alerting 24/7 ou astreinte définie, métriques erreurs, logs centralisés.
- Conditions support : procédures remboursement, incident, suppression compte/document.
- Tests obligatoires : suite E2E complète, tests charge légers formulaires, restore drill, test alerte.
- Décision autorisée ou non : **non autorisée aujourd'hui**.

## Gate D — Go-live large

- Conditions techniques : CI stricte, build sans lint ignoré ou exceptions acceptées, infra validée, rollback testé.
- Conditions produit : catalogue figé, paiement/facturation/entitlements canonisés, CRM opérationnel.
- Conditions sécurité : 0 P0 ouvert, P1 résiduels acceptés par risque documenté, pentest ciblé recommandé.
- Conditions RGPD : conformité mineurs, analytics consent mode, logs, contrats sous-traitants IA/email/storage.
- Conditions monitoring : SLO, alerting, sauvegardes, tests restore périodiques.
- Conditions support : support commercial/pédagogique/facturation prêt, runbooks incidents.
- Tests obligatoires : toutes commandes locales, Playwright, smoke production, API security audit, restore, paiement bout-en-bout.
- Décision autorisée ou non : **non autorisée tant qu'un P0 subsiste**.
