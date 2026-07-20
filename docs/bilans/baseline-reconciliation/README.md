# B0 — Réconciliation de la baseline

Date de constat : 11 juillet 2026, fuseau Africa/Tunis.

## Verdict court

La base canonique recommandée pour le prochain worktree est `origin/main` au SHA exact `c90b142c88d69bdc600f3f848b44ca0317c00242`.

La topologie est linéaire :

```text
production 1b8219b1
  └─ 38 commits
     └─ HEAD local db04d23f
        └─ b2ea32f0 G-SEC
           └─ ac02f548 G-PAY
              └─ c90b142c origin/main
```

`origin/main` contient donc la production et le HEAD local. Il ajoute trois commits, une correction d'ownership sur `POST/GET /api/bilans/generate`, des validations de routes, des tests IDOR et des correctifs de sécurité/paiement. Sa CI GitHub affiche 12 checks réussis. Il ne ferme toutefois pas le P0 de création d'un `Bilan` pour un `studentId` arbitraire et ne rend pas la génération durable.

Décision pour commencer B1 : **GO**, exclusivement dans un nouveau worktree basé sur le SHA figé ci-dessus, avec réaudit initial des routes modifiées et tests PostgreSQL réels avant de déclarer les findings fermés. Ce GO n'autorise ni migration canonique, ni déploiement.

## Périmètre

Cette session a seulement :

- lu le dossier de reconstruction, les audits et les règles ;
- vérifié le snapshot local ;
- effectué un `git fetch --all --prune --tags` ;
- comparé les trois commits ;
- consulté les checks GitHub ;
- revalidé Git et PM2 en production en lecture seule ;
- créé les huit rapports de ce dossier.

Aucun fichier applicatif, branche, worktree, commit, migration ou service de production n'a été modifié.

## Fichiers du dossier

- `GIT_TOPOLOGY.md` : graphes, ascendances et CI.
- `BASE_CANDIDATES.md` : évaluation des trois bases.
- `PRODUCTION_DIVERGENCE.md` : état et retard de production.
- `BILANS_DIFF_IMPACT.md` : impact fichier par fichier.
- `EVIDENCE_REVALIDATION.md` : validité des preuves antérieures.
- `WORKTREE_PLAN.md` : commande et garde-fous.
- `DECISION.md` : décision formelle GO/NO-GO.

## Niveaux de preuve

- `CONFIRMED_GIT` : objet ou relation vérifié localement après fetch.
- `CONFIRMED_GITHUB` : check GitHub lu par API.
- `CONFIRMED_PRODUCTION` : commande SSH read-only datée.
- `INFERRED` : conclusion explicitement dérivée de plusieurs faits.
- `UNKNOWN_PRODUCTION_FACT` : non vérifié sans hypothèse affirmative.
