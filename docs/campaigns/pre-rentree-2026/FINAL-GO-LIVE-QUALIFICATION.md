# Qualification finale avant GO — Pré-rentrée 2026

## Date

2026-07-26, Africa/Tunis.

## Planning

- 14 modules pédagogiques ;
- 70 séances modèles ;
- 17 cohortes opérationnelles ;
- 85 occurrences calendaires ;
- cinq séances et dix heures par matière et par élève ;
- 66 combinaisons d'une à quatre matières qualifiées ;
- 57 parcours actionnables, avec attente maximale de 60 minutes ;
- 9 combinaisons Terminale explicitement bloquées : six `LONG_IDLE` et trois
  `SIMULTANEOUS` ;
- aucun parcours bloqué n'expose un CTA actif ;
- aucune salle ni identité d'enseignant n'est exposée publiquement.

La matrice machine-readable est :
`assets/campaigns/pre-rentree-2026/schedule-optimization/selection-matrix-final.json`.

## Tests locaux

| Contrôle | Résultat |
|---|---|
| ESLint | PASS, avertissements historiques sous le seuil |
| TypeScript | PASS |
| Jest complet | 586 suites passées, 7 172 tests passés, 4 ignorés |
| Intégration PostgreSQL hors Bilan | 10 suites, 116 tests passés |
| Preuve PostgreSQL ciblée | 3 suites, 10 tests passés |
| Tests TypeScript Pré-rentrée | 49 suites, 376 tests passés |
| Tests Python Pré-rentrée | 159 tests passés |
| Pipeline `pre-rentree:ci` | PASS en mode fail-closed |
| Build production | PASS |
| Artefact standalone | PASS |
| SBOM runtime | PASS, 522 composants |
| Audit production | PASS, zéro vulnérabilité |

## Documents

Les sept PDF publics totalisent 59 pages. Leur reconstruction dans l'image
épinglée reproduit les octets suivis par Git. Les contrôles de signature, MIME,
texte, polices, liens, pages blanches, watermark et vocabulaire contractuel
sont verts.

## Frontière Bilan

Le diff de qualification ne contient aucun fichier du territoire Bilan. Les
tests Bilan avec base réelle restent exclus ; seuls les smokes publics sans
mutation peuvent être rejoués.

## Gates encore atomiques

`PUBLIC_READY`, l'inventaire final, le binding privé de GO, le tag et la
bascule de production ne sont créés qu'après CI distante, approbation
propriétaire liée aux SHA, preuve de runbook privé, rollback et health
pré-déploiement.
