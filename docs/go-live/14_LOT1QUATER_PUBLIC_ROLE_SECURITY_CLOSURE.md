# Lot 1-quater — Fermeture P1 publics et rôles

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 1-quater maintient `P0=0` et réduit l'inventaire statique de `P1=37` à `P1=12`, sans modification du script `scripts/security/audit-api-guards.mjs`.

La baisse vient de corrections de code : Zod strict, validation de paramètres dynamiques, suppression d'un token brut dans une réponse parent, test d'ownership coach pour `coach/trajectory`, healthcheck rate limiting non ambigu et extension du test global no-leak.

Les commandes finales Node 20 sont passées : typecheck, lint, full unit, build, audit API, matrice, site-map, hardcoded, docs archive, bundle weight et smoke Playwright public ciblé. Une tentative `check:no-hardcoded` avec chemin `nvm` mal saisi a échoué avant exécution du script puis a été relancée correctement avec succès.

Le go-live large reste interdit : le mode Redis/Upstash n'est pas prouvé en staging/production, ClicToPay webhook reste `501/P1`, `/api/bilan-gratuit` crée encore des comptes inactifs, et 12 P1 restent ouverts.

## Matrice API avant/après

| Priorité | Après Lot 1-ter | Après Lot 1-quater | Delta |
| --- | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 |
| P1 | 37 | 12 | -25 |
| P2 | 112 | 137 | +25 |
| OK | 27 | 27 | 0 |
| Total | 176 | 176 | 0 |

## P1 fermés

- Assistante : `/api/assistante/credit-requests`, `/api/assistante/quotes/pdf`, `/api/assistante/students/credits`, `/api/assistante/subscription-requests`, `/api/assistante/subscriptions`.
- Parent : `/api/parent/children`, `/api/parent/subscription-requests`, `/api/parent/subscriptions`.
- Student/eleve : `/api/eleve/bilan-diagnostic-maths-terminale`, `/api/student/automatismes/attempts`, `/api/student/automatismes/check-answer`, `/api/student/nexus-index`, `/api/student/survival/*`, `/api/student/trajectory`.
- Coach : `/api/coach/students/[studentId]/notes`, `/api/coach/students/[studentId]/survival-mode`, `/api/coach/trajectory`, régénérations maths première parent/student.
- Stages : `/api/stages/[stageSlug]/reservations/[reservationId]/confirm`.
- Bilan gratuit dashboard : `/api/bilan-gratuit/dismiss`.
- Programme STMG : `/api/programme/maths-1ere-stmg/stage-progress`.

## P1 restants

- Paiement : `/api/payments/clictopay/webhook` reste `501/P1`.
- Public sensible : `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate`.
- Admin hors priorité Lot 1-quater : `/api/admin/config`, `/api/admin/config/rollback`, `/api/admin/directeur/stats`, `/api/admin/recompute-ssn`, `/api/admin/subscriptions`, `/api/admin/test-email`.

## Rate limiting

- Code : `getRateLimitProductionGate()` ajouté dans `lib/rate-limit/index.ts`.
- Healthcheck : `/api/internal/health` expose `runtime.rateLimit.mode`, `distributed` et `goLiveLarge`.
- Tests : `__tests__/lib/rate-limit.production-gate.test.ts`, `__tests__/api/internal.health.rate-limit.test.ts`.
- Production/staging : À vérifier, aucun secret lu.

## Données sensibles / no-leak

Le test global no-leak passe de 9 à 12 routes mockables et couvre désormais aussi :

- `/api/parent/children`
- `/api/stages/[stageSlug]/reservations/[reservationId]/confirm`
- `/api/coach/trajectory`

Le token brut retourné auparavant par `POST /api/parent/children` a été retiré de la réponse.

## Décision bêta contrôlée

Autorisable uniquement en périmètre limité, sans paiement carte actif, sans campagne large, avec surveillance renforcée et avec acceptation explicite des réserves `bilan-gratuit` et rate limiting runtime.

## Décision bêta élargie

Interdite tant que les P1 publics sensibles, ClicToPay webhook, routes admin restantes et preuve Redis/Upstash ne sont pas fermés ou arbitrés.

## Décision go-live large

Interdit.

## Prochain lot recommandé

Lot 1-quinquies : fermer les 12 P1 restants, en priorité routes publiques sensibles, routes admin restantes et preuve runtime Redis/Upstash en staging/production. Ensuite seulement Lot 3 produit/RGPD pour `/api/bilan-gratuit` lead-only vs account activation.
