# PR #319 — dernière passe Core v2 ARIA

## Date

2026-09-26

## Contexte

Le run GitHub 35921654710 sur `4b71bb3b99ee64e0e337d7836bef820bf772533b` a échoué sur le gate ARIA Coverage ; `CI Success` en dépendait. La PR demeure Draft jusqu'à la qualification complète sur un nouveau head. Aucun déploiement preview ni merge n'est autorisé dans cette passe.

## Problèmes observés

- L'artefact exact `aria-coverage-4b71bb3b99ee64e0e337d7836bef820bf772533b-1` donne 94,44 % de couverture globale des branches pour un seuil inchangé de 95 %.
- L'historique Core v2 était limité à la première page de 50 messages dans le client, et les projections `activeTurn`, statut et feedback devaient être validées contre le vrai store.
- Le parcours Core-v2-only devait prouver, dans une stack jetable, la génération par provider fixture, le rechargement, la reconnexion, l'arrêt et la persistance du feedback.
- Le premier envoi navigateur Core v2 a réservé un Turn puis échoué avant le RAG et le provider (`failureCode: COURSE_NOT_FOUND`, `reasonCode: PRE_POLICY_FAILURE`) : la clé cockpit `maths-terminale-eds` n'était pas traduite en clé canonique d'exécution `eds-maths-terminale`.
- La projection curriculum Core v2 renvoyait toujours `focusedCourseKey: null` : après reload, le hook ne chargeait aucune conversation avant une nouvelle sélection manuelle du cours.
- Le fingerprint d'idempotence incluait l'identifiant de conversation : la première réservation (sans conversation) et le replay après reload (avec la conversation attribuée) divergeaient pour le même `clientRequestId`.

## Décisions prises

- Conserver tous les seuils et la configuration coverage ; couvrir des branches métier réelles et vérifier le gate canonique sur un head propre.
- Utiliser une pagination keyset `(createdAt, id)` et un curseur opaque ; limiter les pages et refuser un curseur répété dans le client.
- Dériver le statut du message depuis son rôle et `Turn.status`, sans statut mutable sur le message.
- Exposer uniquement le Turn actif et le feedback de l'étudiant propriétaire dans la projection historique.
- Garder la PR Draft, sans merge ni déploiement, jusqu'à la CI entièrement verte et la revue du nouveau head.
- Conserver la clé cockpit dans les conversations Core v2 et traduire explicitement vers la clé canonique uniquement aux frontières du moteur partagé (politique de récupération, identité RAG, prompt et citations). Ne pas créer une nouvelle table d'alias.
- Focaliser au reload le cours d'un Turn actif appartenant à l'élève, à condition qu'il soit encore disponible avec droit de chat ; ne pas exposer un cours désautorisé.
- Ne pas inclure l'identifiant de conversation généré dans le fingerprint d'une demande ; l'acteur, l'élève, le cours, le mode, la ressource et le contenu restent les données d'idempotence.

## Fichiers modifiés

Voir le diff de la PR #319 sur le nouveau head. Les familles concernées sont les tests ARIA coverage, les routes et client de conversation Core v2, les gardes des routes, ainsi que la seed, la fixture et les scénarios navigateur E2E.

## Tests exécutés

- Tests ciblés client/fingerprint/reload : 80/80 réussis.
- Tests Core v2 sur PostgreSQL jetable : historique, projection curriculum, guards et repository réussis.
- E2E Chromium sur stack Compose jetable : 4/4 réussis. La persona n'a ni User V1 ni Student V1 ; grant et enrollment Core v2 actifs ; send obtient la réponse fixture, le feedback survit au reload, la reprise retrouve le même `turnId`/`clientRequestId`, Stop finalise `CANCELLED`, `modelInvocations=1`, aucun nouveau Turn.
- `npm run typecheck`, lint ciblé E2E et `git diff --check` réussis.
- Gate coverage canonique exécuté sur le HEAD `f2dfaabd15aa310fc399d59c5308519da3d8b993` : 189 suites / 2 443 tests unitaires, puis 5 suites / 27 tests PostgreSQL concurrency ; `ARIA_B_COVERAGE_LINES=97.39`, `FUNCTIONS=97.3`, `BRANCHES=95.4`, `STATEMENTS=96.37`, `ARIA_CRITICAL_COVERAGE=100`. Succès, seuils inchangés.
- Le run GitHub affiché sur la PR est encore attaché à l'ancien HEAD `1fd9990fcb8bd78d8ee413d55cbe0413dd1be167` ; il ne valide pas cette passe. CI GitHub à relancer après push du nouveau HEAD.

## Résultats

Les quatre scénarios Core-v2-only Chromium passent et le gate coverage canonique local est vert sur `f2dfaabd15aa310fc399d59c5308519da3d8b993`. La qualification CI GitHub et la revue du nouveau HEAD restent à confirmer.

## Risques restants

Le nouveau head n'a pas encore reçu de revue technique et d'approbation humaine finales.

## Rollback

Réverter les commits de cette passe sur la branche de PR ; aucune modification de production ni de preview n'a été effectuée.
