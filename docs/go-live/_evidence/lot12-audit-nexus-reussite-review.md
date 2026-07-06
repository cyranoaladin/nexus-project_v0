# Lot 12 — Revue de `audit-nexus-reussite.md`

## Statut du fichier

PRESENT_UNTRACKED_IN_WORKTREE.

Le fichier est présent dans le working tree comme fichier non suivi : `docs/audits/audit-nexus-reussite.md`.

Il n'est pas inclus dans les commits standards et ne doit pas être considéré comme audit courant de la RC.

## Résumé

Le document contient un audit utile comme contexte business, pricing, conversion, SEO, UX et dette de gestion. Il ne correspond pas à l'état release candidate courant sur les compteurs API et la sécurité API.

Décision recommandée : `EXCLUDE_FROM_STANDARD_COMMITS`.

## Points utiles

- `USEFUL_BUSINESS_CONTEXT` : analyse des incohérences pricing/crédits et de l'impact marge/confiance.
- `USEFUL_BUSINESS_CONTEXT` : rappel que ClicToPay/paiement carte n'est pas actif.
- `USEFUL_BUSINESS_CONTEXT` : priorisation business autour de preuve sociale, conversion, bundle, gestion admin/assistante.
- `USEFUL_TECH_CONTEXT` : signale la dépendance forte aux handlers API puisque `/api` est exclu du middleware global.
- `USEFUL_RELEASE_CONTEXT` : rappelle la discipline de gates et de migrations non destructives.

## Points obsolètes ou contradictoires

- `STALE_COUNT` : le fichier indique `173 routes API`; la RC actuelle indique `178`.
- `STALE_SECURITY_STATUS` : le fichier parle de sécurité des routes classée "sans trou"; la RC actuelle maintient `6` P1 publics/paiement visibles.
- `STALE_RUNTIME_STATUS` : le fichier ne reflète pas les blocages Redis/Upstash non prouvé et test `429` runtime non exécuté.
- `STALE_PAYMENT_STATUS` : le paiement carte est cité comme priorité, mais la RC actuelle a une décision contractuelle `CLICTOPAY_STATUS = DISABLED`.
- `STALE_RC_CONTEXT` : le document se présente comme audit courant du dépôt audité sur `main`, alors que la RC courante est préparée sur `feat/lot4-accessors-runtime` avec de nombreux lots de sécurité/release postérieurs.

## Contradictions avec la RC actuelle

| Sujet | Audit nexus | RC actuelle | Décision |
|---|---|---|---|
| Routes API | `173 routes API` | `178` routes | `STALE_COUNT`, ne pas inclure comme audit courant |
| P1 | sécurité "sans trou", seulement un concern route stage | `6` P1 visibles | `STALE_SECURITY_STATUS`, ne pas masquer les P1 |
| Go-live/security | base technique durcie, finalisation par incohérences métier | bêta élargie et go-live large bloqués | Ajouter en-tête historique ou réécrire avant inclusion |
| Paiement | paiement carte à activer comme P0 business | ClicToPay disabled, paiement carte interdit | Garder comme contexte business historique uniquement |
| Runtime | pas de preuve Redis/Upstash/429 runtime | Redis/Upstash non prouvé, 429 non exécuté | Non acceptable comme état exploitation |

## Décision recommandée

EXCLUDE_FROM_STANDARD_COMMITS.

## Condition d’inclusion

Une inclusion future est acceptable seulement avec décision humaine explicite et l'une des corrections suivantes :

1. `INCLUDE_AS_HISTORICAL_AUDIT` avec un en-tête visible indiquant que les compteurs et le statut sécurité sont historiques/stale.
2. `REWRITE_BEFORE_INCLUDE` en alignant le document avec `178` routes, `6` P1, ClicToPay disabled, Redis/Upstash non prouvé, `429` runtime non exécuté et ContactLead dry-run DB non prouvé.

## Risque si inclus sans correction

- Le reviewer peut croire que la RC n'a aucun trou sécurité API.
- Le compteur `173 routes` contredit les matrices Lot 8 à Lot 12.
- Les `6` P1 publics/paiement peuvent être minimisés.
- Les blocages runtime Redis/Upstash et `429` peuvent être invisibilisés.
- La décision go/no-go serait moins fiable.
