# Pré-rentrée 2026 M2 Integrity Constraints Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à M1 les garanties DB contre chevauchements, incohérences monétaires, doublons actifs et états invalides.

**Architecture:** M2 ajoute un seul modèle de projection élève, puis du SQL PostgreSQL nommé. Les intervalles sont semi-ouverts `[startAt,endAt)` ; les validations applicatives restent la première couche et les contraintes DB l'arbitre concurrent.

**Tech Stack:** PostgreSQL 15, `btree_gist`, Prisma 6.19.2, migration SQL manuelle contrôlée, tests multi-connexions.

---

## Préconditions

- M1 appliqué, tables V2 vides ou DRAFT et vérifiées.
- M0B prouve `btree_gist` ou l'ADR fallback trigger.
- Aucun conflit préexistant selon les requêtes de préflight.
- Sauvegarde/restauration M0B valide, flags V2 fermés.

## Modèle M2 unique

```prisma
model PreRentreeStudentScheduleClaim {
  id            String   @id @default(cuid())
  studentId     String
  student       Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  assignmentId  String
  assignment    PreRentreeCohortAssignment @relation(fields: [assignmentId], references: [id], onDelete: Restrict)
  sessionId     String
  session       PreRentreeSession @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  startAt       DateTime @db.Timestamptz(3)
  endAt         DateTime @db.Timestamptz(3)
  active        Boolean  @default(true)
  sourceVersion Int      @default(1)
  createdAt     DateTime @default(now()) @db.Timestamptz(3)

  @@unique([studentId, sessionId])
  @@index([assignmentId])
  @@index([studentId, startAt, endAt])
  @@map("pre_rentree_student_schedule_claims")
}
```

Ajouter les back-relations `Student.preRentreeScheduleClaims`, `PreRentreeSession.scheduleClaims`, `PreRentreeCohortAssignment.scheduleClaims`. Owner futur : `capacityService` en coordination transactionnelle avec `schedulingService`. La projection est reconstruisible ; elle n'est jamais exposée en DTO.

## Preflight SQL

```sql
SELECT "editionId", code, COUNT(*)
FROM pre_rentree_modules GROUP BY 1,2 HAVING COUNT(*) > 1;

SELECT "cohortId", "sessionNumber", COUNT(*)
FROM pre_rentree_sessions GROUP BY 1,2 HAVING COUNT(*) > 1;

SELECT id FROM pre_rentree_sessions WHERE "endAt" <= "startAt";
SELECT id FROM pre_rentree_cohorts
WHERE "minCapacity" <> 3 OR "maxCapacity" <> 5;
SELECT id FROM pre_rentree_proposals
WHERE currency <> 'TND'
   OR "totalMillimes" < 0 OR "depositMillimes" < 0 OR "balanceMillimes" < 0
   OR "totalMillimes" <> "depositMillimes" + "balanceMillimes";
```

Chaque résultat doit être vide. Sinon migration stoppée, rapport de réparation, aucun `DELETE` automatique.

## SQL exact : extension et exclusions séances

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE pre_rentree_sessions
  ADD CONSTRAINT pre_rentree_session_positive_range
    CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT pre_rentree_session_teacher_no_overlap
    EXCLUDE USING gist (
      "teacherId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE (
      "teacherId" IS NOT NULL
      AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
    ),
  ADD CONSTRAINT pre_rentree_session_room_no_overlap
    EXCLUDE USING gist (
      "roomId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE (
      "roomId" IS NOT NULL
      AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
    ),
  ADD CONSTRAINT pre_rentree_session_cohort_no_overlap
    EXCLUDE USING gist (
      "cohortId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE (
      status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
    );
```

`COMPLETED` et `CANCELLED` ne participent pas à la disponibilité active ; leur historique reste conservé. Un remplacement est une nouvelle séance active, l'ancienne devient `CANCELLED` dans la transaction avant insertion si les plages coïncident.

## SQL exact : exclusion élève

```sql
ALTER TABLE pre_rentree_student_schedule_claims
  ADD CONSTRAINT pre_rentree_student_claim_positive_range
    CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT pre_rentree_student_no_overlap
    EXCLUDE USING gist (
      "studentId" WITH =,
      tstzrange("startAt", "endAt", '[)') WITH &&
    ) WHERE (active = true);
```

## SQL exact : affectation enseignant primaire

```sql
ALTER TABLE pre_rentree_teacher_assignments
  ADD CONSTRAINT pre_rentree_primary_teacher_period_positive
    CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  ADD CONSTRAINT pre_rentree_primary_teacher_no_overlap
    EXCLUDE USING gist (
      "cohortId" WITH =,
      tstzrange("validFrom", COALESCE("validUntil", 'infinity'::timestamptz), '[)') WITH &&
    ) WHERE (
      role = 'PRIMARY' AND "validationStatus" = 'APPROVED'
    );
```

## Uniques et index partiels

```sql
CREATE UNIQUE INDEX pre_rentree_one_default_variant_per_module
  ON pre_rentree_module_variants ("moduleId")
  WHERE "isDefault" = true;

CREATE UNIQUE INDEX pre_rentree_one_active_hold
  ON pre_rentree_seat_holds ("enrollmentId", "cohortId")
  WHERE status = 'ACTIVE';

CREATE INDEX pre_rentree_active_hold_expiration
  ON pre_rentree_seat_holds ("expiresAt", "cohortId")
  WHERE status = 'ACTIVE';

CREATE INDEX pre_rentree_active_sessions_by_start
  ON pre_rentree_sessions ("startAt", "cohortId")
  WHERE status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS');

CREATE INDEX pre_rentree_pending_materialization_runs
  ON pre_rentree_materialization_runs ("createdAt")
  WHERE status IN ('PLANNED', 'APPLYING');
```

Il n'existe pas d'index cross-table pour « une affectation par module ». `capacityService` verrouille les cohortes et vérifie `cohort.moduleId`; un test de concurrence le prouve. Aucun trigger opaque n'est ajouté pour cet invariant.

## CHECK constraints

```sql
ALTER TABLE pre_rentree_editions
  ADD CONSTRAINT pre_rentree_edition_date_order
    CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT pre_rentree_edition_decision_before_start
    CHECK ("groupDecisionAt" < ("startDate"::timestamp AT TIME ZONE "timeZone")),
  ADD CONSTRAINT pre_rentree_edition_archive_consistency
    CHECK ("archivedAt" IS NULL OR (
      "lifecycleStatus" = 'ARCHIVED' AND "publicationStatus" = 'ARCHIVED'
    ));

ALTER TABLE pre_rentree_modules
  ADD CONSTRAINT pre_rentree_module_positive_schedule
    CHECK ("sessionDurationMinutes" > 0 AND "plannedSessionCount" > 0),
  ADD CONSTRAINT pre_rentree_module_display_order_nonnegative
    CHECK ("displayOrder" >= 0),
  ADD CONSTRAINT pre_rentree_module_archive_consistency
    CHECK ("archivedAt" IS NULL OR status = 'ARCHIVED');

ALTER TABLE pre_rentree_cohorts
  ADD CONSTRAINT pre_rentree_cohort_capacity_pre2026
    CHECK ("minCapacity" = 3 AND "maxCapacity" = 5),
  ADD CONSTRAINT pre_rentree_cohort_archive_consistency
    CHECK ("archivedAt" IS NULL OR (
      "operationalStatus" = 'ARCHIVED' AND "publicationStatus" = 'ARCHIVED'
    ));

ALTER TABLE pre_rentree_rooms
  ADD CONSTRAINT pre_rentree_room_capacity_positive CHECK (capacity > 0),
  ADD CONSTRAINT pre_rentree_room_archive_consistency
    CHECK ("archivedAt" IS NULL OR status = 'ARCHIVED');

ALTER TABLE pre_rentree_applications
  ADD CONSTRAINT pre_rentree_application_contact_required
    CHECK ("contactEmail" IS NOT NULL OR "contactPhone" IS NOT NULL),
  ADD CONSTRAINT pre_rentree_application_archive_consistency
    CHECK ("archivedAt" IS NULL OR status = 'ARCHIVED');

ALTER TABLE pre_rentree_proposals
  ADD CONSTRAINT pre_rentree_proposal_currency_tnd CHECK (currency = 'TND'),
  ADD CONSTRAINT pre_rentree_proposal_amounts_nonnegative
    CHECK ("totalMillimes" >= 0 AND "depositMillimes" >= 0 AND "balanceMillimes" >= 0),
  ADD CONSTRAINT pre_rentree_proposal_amounts_balance
    CHECK ("totalMillimes" = "depositMillimes" + "balanceMillimes"),
  ADD CONSTRAINT pre_rentree_proposal_subject_count
    CHECK ("subjectCount" BETWEEN 1 AND 4),
  ADD CONSTRAINT pre_rentree_proposal_duration_positive
    CHECK ("totalDurationMinutes" > 0);

ALTER TABLE pre_rentree_proposal_items
  ADD CONSTRAINT pre_rentree_proposal_item_duration_positive CHECK ("durationMinutes" > 0);

ALTER TABLE pre_rentree_enrollments
  ADD CONSTRAINT pre_rentree_enrollment_cancel_consistency CHECK (
    (status = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL)
    OR status <> 'CANCELLED'
  ),
  ADD CONSTRAINT pre_rentree_enrollment_archive_consistency
    CHECK ("archivedAt" IS NULL OR status = 'ARCHIVED');

ALTER TABLE pre_rentree_seat_holds
  ADD CONSTRAINT pre_rentree_hold_expiry_after_creation CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT pre_rentree_hold_release_consistency CHECK (
    status NOT IN ('RELEASED', 'EXPIRED', 'CANCELLED') OR "releasedAt" IS NOT NULL
  );
```

Le nombre exact de 1–4 lignes proposition, 5 séances/module et durée conforme au module restent des invariants transactionnels/`verify` inter-tables, testés mais non simulés par un `CHECK` impossible.

## Erreurs SQL → métier

| SQLSTATE/contrainte | Erreur future | HTTP futur |
|---|---|---:|
| `23P01` teacher | `TEACHER_SCHEDULE_CONFLICT` | 409 |
| `23P01` room | `ROOM_SCHEDULE_CONFLICT` | 409 |
| `23P01` cohort | `COHORT_SCHEDULE_CONFLICT` | 409 |
| `23P01` student | `STUDENT_SCHEDULE_CONFLICT` | 409 |
| `23P01` primary teacher | `PRIMARY_TEACHER_ASSIGNMENT_CONFLICT` | 409 |
| `23505` active hold | `ACTIVE_HOLD_ALREADY_EXISTS` | 409 |
| `23514` money/date/state | `DOMAIN_CONSTRAINT_VIOLATION` avec mapping par nom | 422 |

Jamais de message SQL brut en réponse.

## Ordre d'implémentation

1. Ajouter modèle claim dans Prisma et générer migration M2 `--create-only`.
2. Exécuter preflight sur fresh DB et snapshot V1+M1.
3. Ajouter extension, checks simples, index partiels, exclusions dans cet ordre.
4. Appliquer sur DB test, vérifier `pg_constraint`/`pg_indexes` par noms.
5. Lancer tests négatifs/positifs et concurrence.
6. Vérifier drift Prisma : exclusions/partiels sont attendus dans migration, pas dans schema Prisma.

## Tests

- overlap identique, partiel, englobant et simultané pour chaque ressource ;
- adjacency `endAt = next.startAt` autorisée par DB, puis règle métier 15 min testée service ;
- `CANCELLED` n'entre pas dans exclusion ; remplacement atomique ;
- deux PRIMARY non chevauchants autorisés, chevauchants refusés ;
- deux holds actifs même inscription/cohorte refusés ;
- contraintes dates/argent/archive ;
- insertion claim concurrente ; rebuild idempotent ;
- `EXPLAIN` confirme indexes sur requêtes actives.

## Rollback

Avant activation : transaction annulée automatiquement si création de contrainte échoue. Après application : flags/writes off ; en production conserver le modèle claim et contraintes sauf incident confirmé. Rollback physique test seulement : drop indexes puis constraints par noms, table claim, back-relations/schema, dans l'ordre inverse. Ne jamais supprimer une ligne V1.

GO : chaque nom/SQL/test correspond au schéma M1 final, extension/fallback prouvé, zéro donnée invalide, concurrence verte. NO-GO : extension/fallback absent, préflight non vide, contrainte non nommée ou intervalle autre que `[)`.
