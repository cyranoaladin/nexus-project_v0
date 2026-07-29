# Statut des contenus pédagogiques Pré-rentrée 2026

## Règle de gouvernance

La validation structurelle automatisée ne remplace pas une validation
disciplinaire. Tous les modules restent `HUMAN_VALIDATION_REQUIRED`, avec
`reviewer: null` et `validatedAt: null`. Les rôles requis sont :

- responsable pédagogique ;
- enseignant disciplinaire.

Aucun script ne peut attribuer `CLASSROOM_READY` ou
`PUBLICATION_APPROVED`.

## Statut par module

| Module | Niveau | Matière | Statut |
|---|---|---|---|
| `quatrieme-mathematiques` | QUATRIEME | MATHEMATIQUES | `HUMAN_VALIDATION_REQUIRED` |
| `quatrieme-francais` | QUATRIEME | FRANCAIS | `HUMAN_VALIDATION_REQUIRED` |
| `troisieme-mathematiques` | TROISIEME | MATHEMATIQUES | `HUMAN_VALIDATION_REQUIRED` |
| `troisieme-francais` | TROISIEME | FRANCAIS | `HUMAN_VALIDATION_REQUIRED` |
| `seconde-mathematiques` | SECONDE | MATHEMATIQUES | `HUMAN_VALIDATION_REQUIRED` |
| `seconde-francais` | SECONDE | FRANCAIS | `HUMAN_VALIDATION_REQUIRED` |
| `premiere-mathematiques` | PREMIERE | MATHEMATIQUES | `HUMAN_VALIDATION_REQUIRED` |
| `premiere-francais-eaf` | PREMIERE | FRANCAIS | `HUMAN_VALIDATION_REQUIRED` |
| `premiere-nsi` | PREMIERE | NSI | `HUMAN_VALIDATION_REQUIRED` |
| `premiere-physique-chimie` | PREMIERE | PHYSIQUE_CHIMIE | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-mathematiques` | TERMINALE | MATHEMATIQUES | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-maths-expertes` | TERMINALE | MATHS_EXPERTES | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-nsi` | TERMINALE | NSI | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-physique-chimie` | TERMINALE | PHYSIQUE_CHIMIE | `HUMAN_VALIDATION_REQUIRED` |
| `premiere-svt` | PREMIERE | SVT | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-svt` | TERMINALE | SVT | `HUMAN_VALIDATION_REQUIRED` |
| `terminale-philosophie` | TERMINALE | PHILOSOPHIE | `HUMAN_VALIDATION_REQUIRED` |

## Compteurs structurels

- 17 CPS ;
- 141 nœuds, dont 136 évalués ;
- 408 items, dont 33 réponses courtes à correction manuelle ;
- 17 modules et cinq séances par module, soit 85 séances ;
- 255 banques A/B/C ;
- 765 exercices et 765 corrigés commentés ;
- 85 exit tickets et 255 questions ;
- 340 fichiers pédagogiques unitaires.

Une réponse manuelle non corrigée est exclue du scoring automatique ; elle
n'est pas assimilée à une réponse fausse.

## Ressources spécifiques

Quatre séances sans nœud CPS d'accueil sont déclarées explicitement comme
ressources spécifiques, sans rattachement inventé :

- `quatrieme-francais`, séance 4 ;
- `troisieme-francais`, séance 5 ;
- `premiere-nsi`, séances 4 et 5.

## Blocage intentionnel

`seconde-physique-chimie` n'existe pas dans
`content/pre-rentree-2026/modules.json`. Aucun module ni CPS artificiel n'a été
créé. Une extension future exigera une décision produit et une source
pédagogique validée.

## Revue humaine attendue

La revue doit être conduite module par module et vérifier le fond
disciplinaire, le niveau attendu, la formulation des distracteurs, les
corrections, la progressivité A/B/C, les supports élève et les exit tickets.
Elle doit enregistrer une identité de validateur et une date réelles ; aucune
approbation ne peut être déduite du rapport QA historique.
