# Évaluation des bases candidates

## Matrice

| Critère | Production `1b8219b1` | Local `db04d23f` | `origin/main` `c90b142c` |
|---|---|---|---|
| Objet disponible | oui, Git local et GitHub | oui, Git local et GitHub | oui après fetch |
| Reproductible | oui, mais ancien | oui, SHA poussé | oui, branche canonique distante + SHA figé |
| Relation production | commit déployé | +38 commits | +41 commits |
| Relation origin/main | -41 commits | -3 commits | tête distante actuelle |
| Correctifs Bilans/guards récents | absents | validations et guards PR #60 | PR #60 + G-SEC, dont ownership generate |
| Schéma | avant EAM/BusinessConfig | EAM + BusinessConfig/Audit | identique au local |
| Registre curriculum | absent du commit | absent du commit ; seulement overlay non suivi | absent du commit |
| CI observée | échec, suites sautées | tous checks observés réussis | 12/12 réussis |
| Compatibilité audit | baseline de production seulement | baseline principale de la reconstruction | nécessite recheck des 3 commits |
| Risque | P0 sécurité déployé + forte obsolescence | démarre avec correctifs manquants | le plus faible, mais P0 restants à traiter |
| Décision | rejet | rejet | recommandé |

## Production `1b8219b1`

Avantage : correspond exactement au runtime et permet de reproduire un incident de production. Inconvénients : 41 commits derrière la tête distante, validations/guards absents, CI du commit en échec et P0 de génération exposé. Cette base ne doit servir qu'à la comparaison ou à un hotfix exceptionnel explicitement décidé, pas au worktree B1.

## Local `db04d23f`

Avantages : contient la production, la PR #60 et correspond au code inspecté pendant la reconstruction. Sa CI GitHub était verte. Inconvénient décisif : il manque G-SEC et G-PAY. Démarrer B1 ici ferait soit réimplémenter des correctifs déjà poussés, soit créer une future réconciliation inutile.

Le registre curriculum et ses tests visibles dans le worktree ne font partie d'aucun des trois commits : `git ls-tree` retourne zéro fichier `lib/curriculum`/tests sur chaque candidat. Ils sont protégés par le snapshot et restent une source documentaire, pas un argument pour choisir `db04d23f`.

## origin/main `c90b142c`

Avantages : descendant strict des deux autres candidats, branche distante canonique, corrections G-SEC/G-PAY, tests supplémentaires et CI entièrement verte. Les différences Prisma/package par rapport au local sont nulles ; les futures migrations Bilans partiront donc du même schéma commité, sans perdre BusinessConfig.

Limites :

- `POST /api/bilans` accepte toujours un `studentId` sans vérifier l'affectation du coach ;
- generate reste `fire-and-forget` ;
- le test IDOR generate ajouté mocke ownership/Prisma et ne remplace pas PostgreSQL réel ;
- les inventaires de routes et findings produits à `db04d23f` ne reflètent pas encore les 10 fichiers métier modifiés.

## Recommandation

Utiliser exclusivement `c90b142c88d69bdc600f3f848b44ca0317c00242` pour le prochain worktree. Utiliser un SHA, pas le nom mouvant `origin/main`, dans la commande de création afin de rendre la décision reproductible.
