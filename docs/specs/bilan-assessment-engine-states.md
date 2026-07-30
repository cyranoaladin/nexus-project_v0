# États métier du moteur canonique de bilans

## Affectation

| État | Entrée autorisée | Sortie ou règle |
|---|---|---|
| `DRAFT` | création interne | doit être complétée avant affectation |
| `ASSIGNED` | définition `PUBLICATION_APPROVED` et provenance valide | devient disponible à l'ouverture |
| `AVAILABLE` | fenêtre ouverte | tentative autorisée dans la limite |
| `CLOSED` | fenêtre terminée ou fermeture explicite | aucun nouveau départ |
| `REVOKED` | révocation auditée | aucune nouvelle tentative |

## Tentative

| État | Sens | Mutabilité |
|---|---|---|
| `IN_PROGRESS` | commencée ou reprise | réponses modifiables par autosave versionné |
| `SUBMITTED` | soumise et scellée | aucune modification famille |
| `PENDING_MANUAL_REVIEW` | une correction humaine manque | aucun score final |
| `SCORED` | snapshot final déterministe présent | génération possible |
| `REPORT_PENDING_REVIEW` | bilan généré | aucune publication |
| `COACH_VALIDATED` | révision approuvée nominativement | publication possible |
| `PUBLISHED` | une audience au moins est publiée | historique conservé |
| `CANCELLED` | annulation administrative | aucun traitement métier |

Les états historiques d'échec ou invalidation existants restent compatibles.

## Réponse et correction

Une réponse est mutable uniquement si la tentative est `IN_PROGRESS` et la
réponse non scellée. `(assessmentAttemptId, itemId)` est unique.

```text
PENDING -> CLAIMED -> COMPLETED
             |
             +-> reprise après expiration de lease
```

Une révision de décision ajoute une version et une tâche de rescoring. Elle ne
modifie pas la décision précédente. Toute publication active bloque la
révision jusqu'à révocation.

## Score

| Nature | Précondition | Effet |
|---|---|---|
| `PROVISIONAL` | flag dédié + tentative scellée | explicitement provisoire, sans calibrage final |
| `FINAL` | toutes corrections requises terminées | permet génération, jamais publication directe |

## Bilan et publication

```text
PENDING_REVIEW -> COACH_VALIDATED -> PUBLISHED -> REVOKED
```

Chaque audience (`NEXUS`, `PARENT`, `STUDENT`) possède un artifact distinct.
Génération, approbation, publication et révocation sont des commandes
séparées, idempotentes et auditées. Révoquer ne supprime rien.

## Invariants bloquants

- un item étranger à la définition affectée est refusé ;
- une tentative soumise ne redevient jamais éditable ;
- une correction en attente ne compte jamais comme fausse ;
- aucun score final, calibrage final ou bilan final avant correction ;
- aucun contenu non `PUBLICATION_APPROVED` n'est affectable ;
- aucun parent ne voit une ressource d'une autre famille ;
- aucun corrigé n'entre dans une projection famille.
