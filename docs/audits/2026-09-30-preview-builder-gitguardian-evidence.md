# Preuve GitGuardian pour le builder Preview

## Date

2026-09-30 UTC

## Contexte et défaut observé

Le registre et le ruleset exigent `GitGuardian Security Checks` (GitHub App ID `46505`). Le builder exigeait ce check sur le SHA de source exact. Sur le merge de #328 (`379c5a5b8042b4f3d8732a4dd9f9f456b8cbde6a`), les 48 check-runs du commit sont terminés sans échec, mais aucun n'est émis par GitGuardian. Le validateur livré répond `REQUIRED_CHECK_MISSING:GitGuardian Security Checks`. Le check authentique `110058061838` est `completed/success` sur le head de PR `f59c9d2de6cd1703ddcfd243034758daa562e6fa`.

GitGuardian documente ses GitHub Check Runs comme des analyses des commits d'une pull request. Une relance du check de PR ne constitue pas une analyse du SHA de fusion. Aucune configuration du compte GitGuardian ni protection de branche n'est modifiée ici.

Référence : https://docs.gitguardian.com/internal-monitoring/prevent/detect-secrets-in-real-time-in-github

## Décision et portée

Le builder conserve tous les checks GitHub Actions et les runs `push/main` réussis sur le **SHA construit**. Pour GitGuardian, il accepte d'abord un check authentique réussi sur ce même SHA. Seulement si ce check est absent, il accepte le check de la PR fusionnée si toutes les identités suivantes concordent via l'API GitHub :

- une unique PR associée au commit, fermée et fusionnée sur `main` dans ce dépôt ;
- le commit source est un merge à deux parents, dont le premier est la base de la PR et le second son head ;
- l'arbre Git du commit source est strictement identique à celui du head de PR ;
- le check du head exact est `completed/success`, provient de l'application GitGuardian (`name=GitGuardian`, `id=46505`) et porte le contexte exigé.

Un merge avec résolution modifiant l'arbre, un squash, un rebase, une PR ambiguë, un autre producteur ou un résultat absent/neutral/failure sont refusés. Cette preuve porte sur le contenu intégré identique au head de PR scanné ; elle **ne prétend pas** que GitGuardian a créé un check sur le SHA de fusion, ni que le check de PR analyse l'archive livrée. Les contrôles post-merge et d'artefact restent séparés et obligatoires.

## Fichiers modifiés et tests

- `scripts/release/preview-artifact-builder-guards.js` : preuve de correspondance PR/merge/arbre et vérification de l'ID du producteur.
- `__tests__/scripts/preview-artifact-builder-guards.test.ts` : refus pour mauvais SHA, arbre, PR, parent, producteur, preuve absente et résultat non réussi.
- `.github/workflows/preview-artifact.yml` : permission `pull-requests: read`, strictement nécessaire à l'API GitHub qui relie un commit fusionné à sa PR.

Le builder n'a pas été dispatché. L'URL Jitsi autorisée reste un prérequis distinct de la livraison. Aucun service Preview, RAG, OpenRouter ou C2 n'a été modifié.
