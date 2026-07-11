# Pré-rentrée 2026 — index, contraintes et performance

## Principes

Chaque index répond à un invariant ou une requête critique. Les cardinalités 2026 sont faibles (12 modules, environ 12 cohortes socle, 60 séances, 3–5 élèves/cohorte), mais applications, audit, communications et outbox peuvent croître. Aucun index « sur tous les champs ».

## Uniques Prisma

| Table/champs | Invariant/requête |
|---|---|
| edition `code`, `slug` | matérialisation unique et route canonique |
| module `(editionId,code)`, `(editionId,gradeLevel,subject)` | 12 réservations logistiques sans doublon |
| variant `code` | identifiant académique stable |
| rule `(rulesVersion,leftVariantId,rightVariantId)` | une décision par paire/version canonique |
| cohort `(moduleId,code)` | cohorte versionnée unique |
| session `(cohortId,sessionNumber)` | cinq numéros sans doublon |
| site `code`, room `(siteId,code)`, equipment `code` | inventaire stable |
| guardian `(studentId,parentProfileId,validFrom)` | périodes distinctes, pas de relation écrasée |
| application `publicReference`, `idempotencyKeyHash` | confirmation et soumission idempotente |
| selection `(applicationId,variantId)` | pas de matière/variante dupliquée |
| proposal `code`, enrollment `proposalId`, `contractReference`, `(editionId,studentId)` | offre/contrat unique |
| proposal item `(proposalId,moduleId)` | 1 item/module |
| assignment `(enrollmentId,cohortId)` | pas de double affectation exacte |
| payment `(provider,providerReference)`, `(enrollmentId,idempotencyKeyHash)` | réconciliation/idempotence |
| payment event `(paymentId,providerEventId)` | webhook dupliqué |
| attendance `(sessionId,assignmentId)` | une présence |
| claim `(studentId,sessionId)` | une projection élève/séance |
| outbox `idempotencyKey` | un effet asynchrone logique |

## Index partiels SQL

```sql
CREATE UNIQUE INDEX pre_rentree_one_active_primary_guardian
ON pre_rentree_guardian_relationships ("studentId")
WHERE "isPrimary" AND "verificationStatus"='VERIFIED' AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX pre_rentree_one_active_primary_teacher
ON pre_rentree_teacher_assignments ("cohortId")
WHERE role='PRIMARY' AND "validationStatus"='APPROVED' AND "validUntil" IS NULL;

CREATE UNIQUE INDEX pre_rentree_one_active_hold
ON pre_rentree_seat_holds ("enrollmentId","cohortId")
WHERE status='ACTIVE';

CREATE UNIQUE INDEX pre_rentree_one_active_waitlist_application
ON pre_rentree_waitlist_entries ("cohortId","applicationId")
WHERE status='ACTIVE' AND "applicationId" IS NOT NULL;

CREATE UNIQUE INDEX pre_rentree_one_active_waitlist_enrollment
ON pre_rentree_waitlist_entries ("cohortId","enrollmentId")
WHERE status='ACTIVE' AND "enrollmentId" IS NOT NULL;
```

La notion de « validUntil dans le futur » ne peut entrer dans un prédicat d'index avec `now()` immuable. Les transitions d'expiration sont écrites ; les politiques vérifient aussi les dates. Pour les enseignants avec plusieurs périodes, un index d'exclusion temporelle est à préférer si le besoin se confirme.

## Checks SQL

- édition : `startDate<=endDate`, fuseau non vide, `archivedAt` cohérent ;
- module : durée/count/displayOrder positifs ;
- cohorte : `minCapacity>=1`, `maxCapacity>=minCapacity`, et règle PRE2026 3/5 validée par template/service ;
- plages : `endAt>startAt`, dates de fin > début ;
- money : currency `TND`, montants ≥0, proposition `total=deposit+balance`, received/refunded ≥0 ;
- waitlist : exactement un de `applicationId`, `enrollmentId` non nul ;
- guardian : `validUntil>=validFrom`, VERIFIED implique `verifiedAt`, REVOKED implique `revokedAt/reason` ;
- session cancellation : `CANCELLED` implique motif ;
- proposal : `subjectCount BETWEEN 1 AND 4`, `totalDurationMinutes>0` ; cardinalité items contrôlée au service/trigger différé si exigence DB future ;
- outbox : attempts ≥0, DELIVERED implique `deliveredAt`.

Les checks multi-table (exactement 5 séances, salle capacité suffisante, variante du module) sont validés dans service et `verify`; aucun trigger opaque n'est introduit sans ADR.

## Exclusions

`pre_rentree_teacher_no_overlap`, `room_no_overlap`, `cohort_no_overlap`, `student_no_overlap` sont définies dans [le contrat planning](pre-rentree-2026-scheduling-constraints.md). `btree_gist` est précondition M0. Les contraintes sont différables seulement si les scénarios de remplacement l'exigent et après test ; par défaut immédiates.

## Index de requêtes

| Index | Requête |
|---|---|
| edition `(publicationStatus,startDate)` | landing/listes actives |
| module `(editionId,status,displayOrder)` | configurateur ordonné |
| cohort `(moduleId,operationalStatus,publicationStatus)` | disponibilité/configurateur |
| session `(cohortId,startAt)`, teacher/room plages | planning et prévalidation |
| qualification `(subject,gradeLevel,status)` | affectation enseignant |
| guardian parent/student + status/validUntil | politiques parent |
| application `(editionId,status,submittedAt)` | file admin ; contactHash/édition pour dédoublonnage assisté |
| assignment `(cohortId,status)` | capacité/roster |
| hold `(cohortId,status,expiresAt)` | comptage/expiration |
| waitlist `(cohortId,status,priority,sequence)` | promotion |
| payment/refund `(parentId,status)` logique via enrollment | dashboard/réconciliation ; index physiques par enrollment/payment |
| outbox `(status,availableAt)` | worker `SKIP LOCKED` |
| audit `(resourceType,resourceId,occurredAt)`, `(editionId,occurredAt)` | timeline/pagination |
| communication `(editionId,status,scheduledAt)` | worker/suivi campagne |

## Requêtes critiques et N+1

- Landing : projection unique édition→modules→cohortes publiés ; agrégat capacité groupé, pas une requête/cohorte.
- Allocation : requêtes dédiées sous locks, jamais un include généraliste.
- Roster coach : assignment/cohort/student en une requête paginée ; champs sélectionnés explicitement.
- Parent : relation vérifiée dans le `where`, puis agrégats séparés bornés ; aucune recherche par email.
- Audit/outbox : pagination keyset `(occurredAt,id)` / `(availableAt,id)`, jamais offset profond.
- Dash admin : endpoints par panneau si volumétrie ; ne pas charger audit/communications dans le résumé principal.

Les tests activent un budget de requêtes sur DTO critiques et détectent N+1. `EXPLAIN (ANALYZE,BUFFERS)` sur copie de test documente l'utilisation ; aucun index n'est accepté uniquement sur intuition.

## Cache

Cache public court seulement pour édition/modules/configurateur, clé incluant version DTO, édition et catalogue. Capacité avec TTL très court et libellé indicatif. PII/finance/audit : no-store. Invalidation outbox après commit ; panne d'invalidation expire par TTL, mais aucune commande ne fait confiance au cache.

## Rollback

Index ordinaires peuvent être supprimés concurremment après mesure ; contraintes d'intégrité seulement flags off, vérification des données, runbook et migration nommée. Aucun rollback ne supprime une table ou une donnée financière.
