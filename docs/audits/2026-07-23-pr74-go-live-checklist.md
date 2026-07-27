# PR #74 — Checklist release candidate

## État initial

- Date : 23 juillet 2026.
- Branche : `feat/svt-integration-clean`.
- HEAD distant observé : `f952f8a4f08108a0d4d2277eaaa01c945bdb75be`.
- Base PR déclarée : `a0db57a7bc4db25b8d163d92c2ed3e95b65da961`.
- Commits/fichiers PR : 16 / 103.
- Workflows rouges : CI Pipeline, Pré-rentrée 2026 documents.
- Fils non résolus : 3.

## P0

| Gate | État initial | Preuve attendue |
|---|---|---|
| Audit Next.js high | Rouge, `15.5.20` | `npm audit` production et complet : zéro high/critical |
| Actions Node 24 | Partiel | Tous les `uses:` épinglés à un SHA Node 24 |
| Provenance documentaire | Rouge | Trois champs distincts, aucune dépendance à `origin/main` |
| `forceMount` DOM | Ouvert | Aucun avertissement React dans les tests |
| Fondations 4–6 / Premium 3–5 | Contradictoire | JSON, UI, PDF et exports identiques |
| SNT Seconde | Présente | Zéro occurrence publique/canonique ciblée |
| Tarifs PDF | Faux | 480=144+336 ; 1 350=405+945 ; dérivation canonique |
| Promesses bloquées | Publiées | Zéro positionnement personnalisé/bilan écrit garanti |
| Statut enseignants | Non prouvé | Formulation publique approuvée, aucun nom/code |
| Préinscription/paiement | Trop ouvert | `enablePreRegistration=false`, demande d’information |
| Gate serveur | Absent | Aucune surface campagne publique hors `PUBLIC_READY` |
| Fils de revue | 3 ouverts | Réponses avec preuves et résolution |

## P1

| Gate | État initial | Preuve attendue |
|---|---|---|
| Différentiel BO 2019/2026 | Incomplet | Tableau notion/statuts/évolution/source/section |
| Maths | Proposition | Validation pédagogique explicitement ouverte |
| SVT | DRAFT | Mapping BO, équilibre thèmes, validation SVT ouverte |
| Gates opérationnels | Dispersés | Matrice valeur/preuve/responsable/date |
| Kit Semaine 1 | Obsolète | Régénération intégrale et checksums |
| Médias/PDF | Partiels | Contacts sheets, rasters, MP4/SRT contrôlés |
| Inventaire release | Obsolète | PR, branche et SHA construits |
| Infrastructure publique | Exposée | Aucun détail sensible dans le diff/kit |

## P2

| Dette | Traitement attendu |
|---|---|
| Réconciliation des dépôts | Dette séparée, hors PR |
| Docker hors campagne | Retiré du diff ou justifié séparément |
| Runbook production | Privé, sans commande exécutée |

## Statuts autorisés

- `BLOCKED` : un P0 automatisable ou un workflow reste rouge.
- `READY_FOR_REVIEW` : contrôles automatisables verts, revues humaines encore ouvertes.
- `READY_FOR_OWNER_GO` : P0 corrigés, fils résolus, checks verts, gates humains clairement listés.
- `PUBLIC_READY` : interdit sans GO écrit du propriétaire.
