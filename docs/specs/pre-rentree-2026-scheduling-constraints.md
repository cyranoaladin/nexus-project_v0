# Pré-rentrée 2026 — intégrité du planning

## Décision en deux couches

1. `schedulingService` valide les règles métier et retourne des conflits compréhensibles.
2. PostgreSQL empêche la course concurrente par contraintes d'exclusion `btree_gist` sur des plages `tstzrange` semi-ouvertes `[startAt,endAt)`.

Une contrainte unique `(resourceId,startAt,endAt)` est insuffisante : elle ne détecte pas `08:30–10:30` contre `09:00–11:00`.

## Capacité de la base

Le dépôt utilise PostgreSQL 15 et une migration existante active déjà `btree_gist`. M0 doit néanmoins vérifier sur la cible : version serveur, extension installée, privilège de création/usage et restauration. Sans cette preuve, M2 est `NO-GO` et l'activation V2 est `BLOCKED_BY_DATABASE_CAPABILITY`.

## Contraintes SQL proposées

Les noms définitifs sont :

```sql
ALTER TABLE pre_rentree_sessions
  ADD CONSTRAINT pre_rentree_session_positive_range CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT pre_rentree_teacher_no_overlap
    EXCLUDE USING gist ("teacherId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
    WHERE ("teacherId" IS NOT NULL AND status IN ('SCHEDULED','CONFIRMED','IN_PROGRESS')),
  ADD CONSTRAINT pre_rentree_room_no_overlap
    EXCLUDE USING gist ("roomId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
    WHERE ("roomId" IS NOT NULL AND status IN ('SCHEDULED','CONFIRMED','IN_PROGRESS')),
  ADD CONSTRAINT pre_rentree_cohort_no_overlap
    EXCLUDE USING gist ("cohortId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
    WHERE (status IN ('SCHEDULED','CONFIRMED','IN_PROGRESS'));

ALTER TABLE pre_rentree_student_schedule_claims
  ADD CONSTRAINT pre_rentree_student_claim_positive_range CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT pre_rentree_student_no_overlap
    EXCLUDE USING gist ("studentId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
    WHERE (active = true);
```

Les indisponibilités de salle et enseignant sont validées par service. Pour fermer la course inter-table, toute création/déplacement de séance et toute modification d'un blackout/disponibilité verrouille d'abord les lignes `PreRentreeRoom` puis `CoachProfile` concernées, IDs triés, avant contrôle et écriture. Tous les écrivains passent par ce protocole. Si un autre domaine doit écrire ces calendriers ou si la contention augmente, une ADR devra introduire des tables de claims unifiées plutôt qu'une fonction SQL inter-table fragile ; une exclusion ne peut pas vérifier une autre table.

## Projection d'intégrité élève

PostgreSQL ne peut appliquer une exclusion à travers `assignment → cohort → sessions`. `PreRentreeStudentScheduleClaim` matérialise donc `studentId`, `sessionId`, `startAt`, `endAt` pour chaque affectation confirmée. C'est une projection, pas une source métier :

- création/désactivation atomique avec l'affectation ;
- mise à jour atomique sous locks lors du déplacement d'une séance ;
- unique `(studentId,sessionId)` ;
- `sourceVersion` et commande de vérification/rebuild ;
- écart projection/source = gate bloquante et réparation auditée.

## Validation applicative avant écriture

Pour toute création/déplacement/remplacement :

1. convertir date civile + heure locale avec `edition.timeZone` vers un instant UTC ;
2. refuser heure locale inexistante ou ambiguë sans règle explicite ;
3. vérifier durée, fenêtre édition, jours autorisés et absence de week-end ;
4. vérifier disponibilité, qualification, maximum 6 h/jour, pas de retour dans la journée et aucun creux hors déjeuner ;
5. vérifier salle, capacité et équipements ;
6. vérifier ≤2 salles simultanées ;
7. vérifier cohorte et étudiants (≤4 h/jour, 15 minutes entre séances, aucun chevauchement) ;
8. tenter l'écriture ; la contrainte DB reste l'arbitre final.

L'ordre transactionnel planning est : cohorte → salles triées → coachs triés → séances → claims élèves. Il est compatible avec l'ordre global du service capacité et évite qu'un blackout soit validé pendant la création d'une séance.

Pour PRE2026, le template impose les blocs A `08:30–10:30`, B `10:45–12:45`, C `13:30–15:30`, D `15:45–17:45`, fuseau `Africa/Tunis`. Ces valeurs viennent du template versionné et de l'édition, jamais des routes ou dashboards.

## Conversion temporelle

- `startDate/endDate` : `date`, sans minuit artificiel.
- `startAt/endAt` : `timestamptz(3)`, instant UTC.
- Construction : parse strict `YYYY-MM-DD` + `HH:mm` + zone IANA avec une bibliothèque serveur approuvée ; sérialiser ISO UTC.
- Affichage : le DTO fournit zone et libellé local ; le navigateur ne recalcule pas depuis sa propre zone.
- La Tunisie n'applique actuellement pas de changement saisonnier, mais l'algorithme traite zones avec DST : heure inexistante = erreur, heure double = offset explicite requis.

## Contraintes métier du socle

| Ressource | Invariant |
|---|---|
| enseignant Math/NSI | même `CoachProfile`, aucune simultanéité entre les deux semaines |
| chaque enseignant | au plus 3 séances/6 h par jour, bloc continu hors déjeuner, une venue |
| élève | au plus 2 séances/4 h par jour, 15 min minimum, aucun chevauchement |
| cohorte | exactement 5 séances de 120 minutes pour le socle |
| salle | capacité ≥ cohorte max ou capacité opérationnelle validée ; équipement disponible |
| site | Mutuelleville pour les cohortes présentiel |
| global | au plus deux salles occupées en parallèle |

Les deux limites agrégées (heures/retours et deux salles) ne s'expriment pas proprement par un simple `CHECK`. Elles sont validées sous les mêmes transactions de planning, puis contrôlées par une commande `verify` et des tests. Les exclusions fournissent la garantie de non-chevauchement concurrent.

## Traduction des erreurs

| Contrainte | Erreur métier | HTTP futur |
|---|---|---|
| `pre_rentree_teacher_no_overlap` | `TEACHER_SCHEDULE_CONFLICT` | 409 |
| `pre_rentree_room_no_overlap` | `ROOM_SCHEDULE_CONFLICT` | 409 |
| `pre_rentree_cohort_no_overlap` | `COHORT_SCHEDULE_CONFLICT` | 409 |
| `pre_rentree_student_no_overlap` | `STUDENT_SCHEDULE_CONFLICT` | 409 |
| plage/durée/règle locale | `INVALID_SESSION_INTERVAL` | 422 |
| équipement/qualification | `RESOURCE_REQUIREMENT_UNMET` | 422 |

La réponse expose ressource et créneau autorisés pour l'acteur, jamais l'identité d'une autre famille.

## Rollback et tests

Rollback de M2 : désactiver les écritures V2, vérifier zéro conflit, retirer chaque contrainte par son nom ; conserver tables et données. Tests : chevauchements partiels/identiques/englobants, bornes adjacentes autorisées par `[)`, séance annulée, course de deux inserts, déplacement, remplacement, claims élève, blackout, DST synthétique, week-end et limites quotidiennes.
