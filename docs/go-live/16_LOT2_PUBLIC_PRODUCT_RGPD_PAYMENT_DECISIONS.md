# Lot 2 — Décisions publiques / RGPD / paiement

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 2 arbitre les 6 P1 restants comme décisions produit/RGPD/paiement/runtime. `P0=0` doit être maintenu. Les P1 ne sont pas masqués : ils restent visibles lorsque la surface publique ou le runtime réel impose une réserve.

Décision majeure : `/api/bilan-gratuit` passe en `lead_only`. Le formulaire public ne crée plus de `User`, `ParentProfile`, `Student`, token d'activation ou email d'activation. Il crée uniquement un lead CRM minimal avec consentement explicite et réponse neutre.

## Matrice API avant/après

| Priorité | Après Lot 1-quinquies | Après Lot 2 vérifié |
| --- | ---: | ---: |
| P0 | 0 | 0 |
| P1 | 6 | 6 |
| P2 | 143 | 143 |
| OK | 27 | 27 |
| Total | 176 | 176 |

Les 6 P1 restent visibles par décision : ils sont arbitrés et documentés, mais non reclassés artificiellement.

## Décisions route par route

| Route | Décision Lot 2 | Statut produit/RGPD | Statut sécurité |
| --- | --- | --- | --- |
| `/api/payments/clictopay/webhook` | ClicToPay reste désactivé | Carte bancaire non disponible | P1 maintenu tant que webhook incomplet |
| `/api/assessments/submit` | Option A retenue : token signé court à implémenter avant bêta élargie | Public actuel toléré uniquement en parcours contrôlé | P1 maintenu |
| `/api/bilan-gratuit` | `lead_only` implémenté | Ambiguïté compte supprimée | P1 statique possible, mais dette compte fermée |
| `/api/lamis/teacher-report` | Public anonyme assumé | Pas de PII ni stockage | P1 statique maintenu par prudence |
| `/api/stages/[stageSlug]/inscrire` | Public assumé avec consentement explicite API | Lead stage, pas compte | P1 maintenu tant que rate limit runtime non prouvé |
| `/api/student/activate` | Public par token assumé | Cycle token hashé/expiré/invalidation testé | P1 maintenu par nature |

## Décisions go-live

- Bêta contrôlée : autorisable avec réserves, sans paiement carte, volume limité et supervision.
- Bêta élargie : interdite tant que Redis/Upstash n'est pas prouvé et que `assessments/submit` n'a pas de token signé.
- Go-live large : interdit tant que Redis/Upstash runtime n'est pas prouvé et que ClicToPay webhook reste incomplet.

## Tests Lot 2

- `__tests__/api/bilan-gratuit.product-rgpd.test.ts`
- `__tests__/api/stages.inscrire.product-rgpd.test.ts`
- `__tests__/api/payments.clictopay.webhook.disabled.test.ts`
- `__tests__/ui/payment-methods.clictopay-disabled.test.tsx`
- `__tests__/api/student.activate.lifecycle-security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

Commandes finales Node 20 : typecheck OK, lint OK, test unitaire complet OK, build OK, audit API OK, matrice OK, audit site-map OK, no-hardcoded OK, docs-archive OK, bundle-weight OK, smoke Playwright public OK.

## Réserves

- Redis/Upstash non prouvé en staging/production.
- ClicToPay webhook volontairement `501`.
- `assessments/submit` doit passer derrière token signé court avant bêta élargie.
- `P1=6` reste assumé tant que le runtime Redis/Upstash réel n'est pas prouvé et que ClicToPay webhook n'est pas complet.
