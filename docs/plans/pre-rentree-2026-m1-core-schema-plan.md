# Pré-rentrée 2026 M1 Core Schema Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le noyau V2 additif minimal de 21 modèles et 19 enums, sans donnée, route ou service actif.

**Architecture:** M1 matérialise les agrégats structurels et leurs relations simples. Les checks/exclusions/index partiels arrivent en M2 ; l'autorité parent arrive en M3. Les 17 modèles différés sont absents et leurs fonctionnalités sont bloquées.

**Tech Stack:** Prisma 6.19.2, PostgreSQL 15, migration additive `migrate dev --create-only`, Jest/PostgreSQL réel.

---

## Entrées obligatoires

- M0A au minimum implémenté/revu pour les guards existants ; aucune route V2.
- M0B GO PostgreSQL/backup/restore.
- M0C GO Prisma/Node/drift.
- M0D harness disponible.
- Baseline Git revalidée ; sauvegarde et preuve V1.

## 19 enums M1 exacts

```prisma
enum PreRentreeLifecycleStatus { DRAFT READY ACTIVE COMPLETED CANCELLED ARCHIVED }
enum PreRentreePublicationStatus { DRAFT READY PUBLISHED UNPUBLISHED ARCHIVED }
enum PreRentreeModuleStatus { DRAFT ACTIVE INACTIVE ARCHIVED }
enum PreRentreeValidationStatus { PENDING APPROVED REJECTED REVOKED }
enum PreRentreeCohortStatus { DRAFT FORMING CONFIRMED IN_PROGRESS COMPLETED CANCELLED ARCHIVED }
enum PreRentreeModality { IN_PERSON ONLINE }
enum PreRentreeVariantKind { STANDARD SPECIALTY TRACK OPTION EXAM_PATHWAY INITIATION }
enum PreRentreeMathOption { NONE EXPERTES COMPLEMENTAIRES }
enum PreRentreeCompatibilityOutcome { COMPATIBLE INCOMPATIBLE REQUIRES_ARBITRATION }
enum PreRentreeApplicationStatus { RECEIVED QUALIFICATION_REQUIRED QUALIFIED PROPOSED CONVERTED WITHDRAWN REJECTED ARCHIVED }
enum PreRentreeProposalStatus { DRAFT ISSUED ACCEPTED DECLINED EXPIRED CANCELLED }
enum PreRentreeEnrollmentStatus { PENDING CONFIRMED CANCELLED COMPLETED ARCHIVED }
enum PreRentreeAssignmentStatus { PROPOSED CONFIRMED TRANSFERRED CANCELLED COMPLETED }
enum PreRentreeSeatHoldStatus { ACTIVE CONVERTED RELEASED EXPIRED CANCELLED }
enum PreRentreeSessionStatus { SCHEDULED CONFIRMED IN_PROGRESS COMPLETED CANCELLED }
enum PreRentreeMaterializationStatus { PLANNED APPLYING APPLIED VERIFIED FAILED LOGICALLY_ROLLED_BACK }
enum PreRentreeMaterializationCommand { VALIDATE PLAN APPLY VERIFY LOGICAL_ROLLBACK }
enum PreRentreeResourceStatus { ACTIVE INACTIVE MAINTENANCE ARCHIVED }
enum PreRentreeTeacherAssignmentRole { PRIMARY SUBSTITUTE ASSISTANT }
```

Les 14 enums différés et les deux enums M3 ne figurent pas dans M1.

## Catalogue physique M1

Notation : `?` nullable ; `=` default. Tous les IDs sont `String @id @default(cuid())`. Tous les instants sont `DateTime @db.Timestamptz(3)`, dates civiles `DateTime @db.Date`.

### Édition, module et variante

| Prisma / SQL | Champs exacts hors relations/horodatages | Relations, uniques/index | Owner/statut/PII/tests |
|---|---|---|---|
| `PreRentreeEdition` / `pre_rentree_editions` | `code VarChar(64)`, `slug VarChar(128)`, `label VarChar(160)`, `timeZone VarChar(64)`, `startDate Date`, `endDate Date`, `groupDecisionAt Timestamptz`, `lifecycleStatus=DRAFT`, `publicationStatus=DRAFT`, `templateVersion VarChar(64)`, `templateChecksum VarChar(64)`, `pricingCatalogVersion VarChar(64)`, trois `*FeatureFlagKey VarChar(128)`, `materializedAt?`, `archivedAt?`, `version=1`, `createdAt`, `updatedAt` | `code`/`slug` uniques ; index publication/start ; children module/application/enrollment/run/audit | `editionService` après bootstrap ; interne/public ; tests dates/uniques/defaults |
| `PreRentreeModule` / `pre_rentree_modules` | `editionId`, `code VarChar(96)`, `gradeLevel GradeLevel`, `subject Subject`, `publicTitleKey VarChar(160)`, `objectiveContentKey?`, `sessionDurationMinutes Int`, `plannedSessionCount Int`, `requiredEquipmentCodes String[]= []`, `requiredQualificationCode VarChar(96)`, `status=DRAFT`, `displayOrder Int`, `archivedAt?`, `version=1`, timestamps | FK édition Restrict ; unique édition/code et édition/niveau/matière ; index édition/status/order | bootstrap puis `moduleService`; pas PII ; 12 uniques/durée/count |
| `PreRentreeVariant` / `pre_rentree_variants` | `code VarChar(96)`, `gradeLevel`, `subject`, `kind`, `academicTrack?`, `pathwayCode? VarChar(64)`, `mathOption?`, `isSpecialty=false`, `publicLabelKey VarChar(160)`, `rulesVersion VarChar(64)`, `status=ACTIVE`, timestamps | code unique ; index niveau/matière/status | bootstrap/module ; pédagogique ; tests Seconde/Première/Terminale |
| `PreRentreeModuleVariant` / `pre_rentree_module_variants` | `moduleId`, `variantId`, `isDefault=false` | PK composite ; FKs Restrict | bootstrap ; pas PII ; dimensions cohérentes |

### Cohorte, planning et ressources minimales

| Prisma / SQL | Champs | Relations, uniques/index | Owner/statut/PII/tests |
|---|---|---|---|
| `PreRentreeCohort` / `pre_rentree_cohorts` | `moduleId`, `code VarChar(112)`, `label VarChar(160)`, `minCapacity Int`, `maxCapacity Int`, `modality=IN_PERSON`, `operationalStatus=DRAFT`, `publicationStatus=DRAFT`, `pedagogicalValidation=PENDING`, `logisticalValidation=PENDING`, `decisionAt?`, `primaryRoomId?`, `archivedAt?`, `version=1`, timestamps | module/room Restrict ; unique module/code ; index module/states, room | `cohortService`; interne ; defaults/relations |
| `PreRentreeCohortVariant` / `pre_rentree_cohort_variants` | `cohortId`, `variantId` | PK composite, FKs Restrict | bootstrap ; **M1 limite une variante/cohorte par service/gate** ; champs règle/approval ajoutés avec modèle différé |
| `PreRentreeSession` / `pre_rentree_sessions` | `cohortId`, `sessionNumber Int`, `startAt`, `endAt`, `roomId?`, `teacherId?`, `contentKey? VarChar(160)`, `status=SCHEDULED`, `cancellationReason? Text`, `replacesSessionId? unique`, `archivedAt?`, `version=1`, timestamps | cohort/room/coach/replacement Restrict ; unique cohort/number ; index teacher/room/cohort+times | `schedulingService`; planning ; cinq séances/null ressources DRAFT |
| `PreRentreeSite` / `pre_rentree_sites` | `code VarChar(64)`, `label VarChar(160)`, `addressKey VarChar(160)`, `timeZone VarChar(64)`, `status=ACTIVE`, `archivedAt?` | code unique | `schedulingService`; site public partiel ; code/timezone |
| `PreRentreeRoom` / `pre_rentree_rooms` | `siteId`, `code VarChar(64)`, `label VarChar(160)`, `capacity Int`, `roomType VarChar(64)`, `status=ACTIVE`, `archivedAt?` | site Restrict ; unique site/code ; index site/status | `schedulingService`; interne ; capacity/status |
| `PreRentreeTeacherAssignment` / `pre_rentree_teacher_assignments` | `cohortId`, `coachId`, `role`, `validFrom`, `validUntil?`, `validationStatus=PENDING`, `createdAt` | cohort/CoachProfile Restrict ; unique cohort/coach/role/from ; index coach/période | `cohortService`; personnel ; aucun PRIMARY actif en double après M2 |

### Demande et contrat

| Prisma / SQL | Champs | Relations, uniques/index | Owner/statut/PII/tests |
|---|---|---|---|
| `PreRentreeApplication` / `pre_rentree_applications` | `editionId`, `publicReference VarChar(32)`, `idempotencyKeyHash VarChar(64)`, `payloadHash VarChar(64)`, `studentId?`, `contactName VarChar(160)`, `contactEmail? VarChar(254)`, `contactPhone? VarChar(32)`, `normalizedContactHash VarChar(64)`, `studentFirstName VarChar(100)`, `gradeLevel`, `academicTrack?`, `specialties Subject[]= []`, `mathOption=NONE`, `sourceCampaign?`, `status=RECEIVED`, `compatibilityStatus=REQUIRES_ARBITRATION`, `submittedAt=now`, `archivedAt?`, `version=1`, timestamps | édition/student Restrict ; publicRef/idempotency uniques ; index édition/status/date et contactHash/édition | `applicationService`; PII ; sans compte, idempotence, 1–4 selections |
| `PreRentreeConsentEvidence` / `pre_rentree_consent_evidence` | `applicationId`, `consentCode VarChar(64)`, `documentVersion VarChar(64)`, `accepted Boolean`, `capturedAt`, `evidenceHash VarChar(64)` | application Restrict ; unique application/code/version | application ; personnelle/audit ; version/hash |
| `PreRentreeApplicationSelection` / `pre_rentree_application_selections` | `applicationId`, `variantId`, `preferenceRank? Int`, `constraints? Json` | FKs Restrict ; unique application/variant ; index variant/application | application ; pédagogique ; JSON `ApplicationSelectionConstraintsV1Schema` |
| `PreRentreeProposal` / `pre_rentree_proposals` | `applicationId`, `code VarChar(64)`, `status=DRAFT`, `productCode VarChar(64)`, `catalogVersion VarChar(64)`, `currency='TND' VarChar(3)`, `totalMillimes Int`, `depositMillimes Int`, `balanceMillimes Int`, `roundingRuleCode VarChar(64)`, `subjectCount Int`, `totalDurationMinutes Int`, `termsVersion VarChar(64)`, `refundPolicyVersion VarChar(64)`, `discountSnapshot? Json`, `exceptionJustification? Text`, `snapshotPayload Json`, `snapshotChecksum VarChar(64)`, `calculatedAt`, `issuedAt?`, `expiresAt?`, `version=1`, `createdAt` | application Restrict ; code unique ; index application/status | `pricingService`; finance/contrat ; checks argent M2, JSON Zod/version |
| `PreRentreeProposalItem` / `pre_rentree_proposal_items` | `proposalId`, `moduleId`, `variantId`, `moduleCode VarChar(96)`, `variantCode VarChar(96)`, `durationMinutes Int` | FKs Restrict ; unique proposal/module | pricing ; contractuel ; 1–4 items/service |
| `PreRentreeEnrollment` / `pre_rentree_enrollments` | `editionId`, `proposalId`, `studentId`, `contractReference VarChar(32)`, `status=PENDING`, `acceptedTermsVersion VarChar(64)`, `acceptedRefundPolicyVersion VarChar(64)`, `contractChecksum VarChar(64)`, `confirmedAt?`, `cancelledAt?`, `cancellationReason? Text`, `invoiceId?`, `archivedAt?`, `version=1`, timestamps | édition/proposal/student/invoice Restrict ; proposal/contract/invoice uniques ; unique édition/student ; index édition/status | enrollment ; PII/contrat ; **aucune écriture autorisée avant M3** |
| `PreRentreeEnrollmentModule` / `pre_rentree_enrollment_modules` | `enrollmentId`, `moduleId`, `variantId`, `status=ACTIVE` | enrollment/module/variant Restrict ; unique enrollment/module ; index module/variant | enrollment ; contractuel ; égale items proposition |

### Capacité, audit et matérialisation

| Prisma / SQL | Champs | Relations, uniques/index | Owner/statut/PII/tests |
|---|---|---|---|
| `PreRentreeCohortAssignment` / `pre_rentree_cohort_assignments` | `enrollmentId`, `cohortId`, `status=PROPOSED`, `confirmedAt?`, `cancelledAt?`, `transferredFromId? unique`, `transferReason? Text`, `version=1`, timestamps | enrollment/cohort/self Restrict ; unique enrollment/cohort ; index cohort/status | `capacityService`; personnelle ; writes bloqués avant M3 |
| `PreRentreeSeatHold` / `pre_rentree_seat_holds` | `enrollmentId`, `cohortId`, `idempotencyKeyHash VarChar(64)`, `payloadHash VarChar(64)`, `status=ACTIVE`, `expiresAt`, `convertedAssignmentId? unique`, `releasedAt?`, `releaseReason? Text`, `version=1`, `createdAt` | enrollment/cohort/assignment Restrict ; unique cohort/idempotency ; indexes cohort/status/expiry et enrollment/status | capacity ; transactionnel ; durée non codée |
| `PreRentreeAuditEvent` / `pre_rentree_audit_events` | `editionId?`, `actorUserId?`, `actorType VarChar(32)`, `action VarChar(96)`, `resourceType VarChar(64)`, `resourceId String`, `previousState?`, `nextState?`, `reasonCode?`, `metadata? Json`, `correlationId VarChar(64)`, `occurredAt=now` | édition Restrict, User SetNull ; indexes resource/time, edition/time, actor/time | `auditService`; audit minimisé ; append-only applicatif |
| `PreRentreeMaterializationRun` / `pre_rentree_materialization_runs` | `editionId?`, `editionCode VarChar(64)`, `templateVersion VarChar(64)`, `templateChecksum VarChar(64)`, `command`, `status=PLANNED`, `plan Json`, `result? Json`, `appliedById?`, `startedAt?`, `completedAt?`, `createdAt` | édition Restrict, User SetNull ; unique editionCode/checksum/command ; index status/date | materialization ; interne ; JSON Zod/version/idempotence |

## Relations ajoutées aux modèles existants

Uniquement des back-relations Prisma, sans colonne V1 : `User.preRentreeAuditEvents`, `User.preRentreeMaterializations`, `Student.preRentreeApplications`, `Student.preRentreeEnrollments`, `CoachProfile.preRentreeAssignments`, `CoachProfile.preRentreeSessions`, `Invoice.preRentreeEnrollment`. Aucun champ V1 n'est modifié ou requalifié.

## Explicitement absent de M1

CompatibilityRule, Equipment/RoomEquipment/RoomBlackout, TeacherQualification/Availability, StaffGrant, GuardianRelationship, Waitlist, Payment/Event/Refund, Attendance/Report/Document, Arbitration, Communication/Outbox et StudentScheduleClaim. Aucun enum associé. Pas de `guardianRelationshipId` en M1 : M3 ajoute la relation requise avant toute inscription écrite.

## Contrats JSON à livrer avec M1 avant toute écriture

| Fichier futur | Champs couverts | Version |
|---|---|---|
| `lib/stages/v2/schemas/application-selection-constraints.schema.ts` | `ApplicationSelection.constraints` | `_schemaVersion: 1` |
| `lib/stages/v2/schemas/pricing-snapshot.schema.ts` | `Proposal.discountSnapshot` et `snapshotPayload` | `schemaVersion: 1` |
| `lib/stages/v2/schemas/audit-metadata.schema.ts` | `AuditEvent.metadata`, union discriminée par action | `_schemaVersion: 1` |
| `lib/stages/v2/schemas/materialization-run.schema.ts` | `MaterializationRun.plan/result` | `schemaVersion: 1` |

Chaque fichier exporte schéma Zod strict, type inféré et parseur fail-closed. Les tests refusent clé inconnue/version absente. Aucune route/service n'est créé, mais aucune fixture ou future commande ne peut écrire un JSON non validé.

## Ce qui va dans Prisma et dans SQL

- `prisma/schema.prisma` : les 19 enums, 21 modèles, back-relations, `@unique`, `@@unique`, indexes ordinaires, types DB, `Restrict/SetNull`.
- migration M1 générée : uniquement DDL additif tables/enums/FKs/indexes ordinaires.
- SQL manuel M1 : commentaires de provenance seulement ; aucun `CREATE EXTENSION`, exclusion ou index partiel.
- M2 : tous checks, exclusions et index partiels.

## Tasks et commits

### Task 1: Enums + édition/module/variante

**Files:** `prisma/schema.prisma`; tests `__tests__/integration/pre-rentree-v2/m1-catalog.db.test.ts`.

- [ ] Écrire les tests de métadonnées attendues et doublons.
- [ ] Ajouter 19 enums et 4 modèles catalogue.
- [ ] `prisma format`, `validate`, `generate`; tests FAIL puis PASS.
- [ ] Commit : `feat(prisma): add pre-rentree V2 edition catalog core`.

### Task 2: Cohorte/séance/site/salle/enseignant

**Files:** même schéma ; test `m1-scheduling-core.db.test.ts`.

- [ ] Tester FKs/defaults/uniques sans exclusions M2.
- [ ] Ajouter les 6 modèles et back-relations CoachProfile.
- [ ] Validate/generate/test.
- [ ] Commit : `feat(prisma): add pre-rentree cohort scheduling core`.

### Task 3: Demande/sélection/consentement

**Files:** schéma, schema JSON application ; test `m1-application.db.test.ts`.

- [ ] Tester demande sans compte et idempotence unique.
- [ ] Ajouter 3 modèles et relation Student optionnelle.
- [ ] Commit : `feat(prisma): add pre-rentree application core`.

### Task 4: Proposition/inscription/modules

**Files:** schéma, schema pricing snapshot ; tests `m1-contract.db.test.ts`, money tests.

- [ ] Tester snapshot/uniques/FKs et blocage writes avant M3 au niveau gate.
- [ ] Ajouter 4 modèles.
- [ ] Commit : `feat(prisma): add pre-rentree contract core`.

### Task 5: Affectation/hold/audit/materialization

**Files:** schéma, schemas audit/materialization ; tests `m1-capacity-audit.db.test.ts`.

- [ ] Tester FKs/idempotence/run unique.
- [ ] Ajouter 4 modèles.
- [ ] Commit : `feat(prisma): add pre-rentree allocation and audit core`.

### Task 6: Générer une migration atomique M1

**Files:** Create `prisma/migrations/<timestamp>_pre_rentree_v2_core/migration.sql`.

- [ ] Squasher les commits de travail uniquement si la politique de branche l'exige, sans perdre tests/revue.
- [ ] Exécuter `migrate dev --create-only --name pre_rentree_v2_core` sur DB isolée.
- [ ] Inspecter zéro `DROP`, zéro `CASCADE`, exactement 19 enums/21 tables.
- [ ] Appliquer fresh DB puis snapshot V1 ; vérifier drift.
- [ ] Commit attendu du lot : `feat(prisma): add additive pre-rentree V2 core migration`.

## GO/NO-GO et rollback

GO : 21/19 exacts, DDL uniquement additif, fresh/V1 snapshot verts, aucune ligne V1 modifiée, schema/client/drift verts, tables vides et flags off. NO-GO : modèle différé présent, relation guardian contournée, cascade/drop, JSON sans Zod/version ou migration nécessitant une donnée inventée.

Rollback production : ne pas dropper ; laisser tables vides/inertes, application précédente et flags off. Rollback physique seulement sur DB jetable avant toute donnée.
