# Pré-rentrée 2026 — schéma physique V2 proposé

## Statut et portée

Conception physique additive au 11 juillet 2026. Ce document ne modifie pas `prisma/schema.prisma` et n'autorise aucune migration. Les noms ci-dessous sont définitifs pour le plan d'implémentation ; toute modification ultérieure exige une ADR ou un amendement tracé.

Références : [modèles et champs](pre-rentree-2026-model-field-catalog.md), [états](pre-rentree-2026-state-machines.md), [contraintes](pre-rentree-2026-index-and-constraint-plan.md), [ADR 006](../adr/006-pre-rentree-v2-physical-domain-model.md).

## Contexte vérifié

- Provider : PostgreSQL 15 (`pgvector/pgvector:pg15`).
- Prisma CLI et Client installés/verrouillés : `6.19.2`. Les plages du manifeste sont asymétriques (`prisma ^6.13.0`, client `^6.19.2`) ; M0 doit les aligner ou documenter leur politique avant toute génération.
- Générateur : `prisma-client-js`, preview `postgresqlExtensions`.
- Extensions déclarées : `vector` ; `btree_gist` est déjà activée par une migration historique pour `SessionBooking`.
- Identifiants existants : `String @default(cuid())`.
- Modèles V1 réutilisés par référence : `User`, `ParentProfile`, `Student`, `CoachProfile`, `Invoice`, `UserDocument`.
- Modèles V1 non réinterprétés : `Stage`, `StageSession`, `StageReservation`, `StageCoach`, `StageBilan`, `Payment`, `ClicToPayTransaction`.

## Principes physiques

1. Toutes les tables V2 portent le préfixe Prisma `PreRentree` et SQL `pre_rentree_`.
2. Les instants utilisent `timestamptz(3)` et sont écrits en UTC ; les dates civiles utilisent `date`.
3. Tous les montants V2 sont des `Int` en millimes ; `currency` vaut `TND` sous contrainte SQL.
4. Les suppressions opérationnelles sont logiques. Les FK utilisent `Restrict` ou `SetNull`, jamais `Cascade` sur les engagements, l'argent, les présences, les documents ou l'audit.
5. Les valeurs dérivées ne sont pas persistées, sauf `PreRentreeStudentScheduleClaim`, projection d'intégrité reconstruisible et contrôlée.
6. Les contraintes partielles, checks et exclusions listées après le bloc Prisma sont ajoutées en SQL de migration car Prisma ne les exprime pas toutes.

## Schéma Prisma proposé

Le bloc représente les ajouts V2, y compris les champs de relation à ajouter aux modèles existants. Il est conceptuellement compilable avec le schéma actuel ; les contraintes SQL complémentaires restent obligatoires.

```prisma
// --- Additive relation fields on existing models ---
// model User {
//   preRentreeStaffGrants             PreRentreeStaffGrant[]
//   preRentreeGuardianVerifications   PreRentreeGuardianRelationship[] @relation("PreRentreeGuardianVerifiedBy")
//   preRentreeGuardianRevocations     PreRentreeGuardianRelationship[] @relation("PreRentreeGuardianRevokedBy")
//   preRentreeAuditEvents              PreRentreeAuditEvent[] @relation("PreRentreeAuditActor")
//   preRentreeMaterializations         PreRentreeMaterializationRun[] @relation("PreRentreeMaterializedBy")
//   preRentreeCommunicationsCreated    PreRentreeCommunication[] @relation("PreRentreeCommunicationCreatedBy")
//   preRentreeCompatibilityApprovals   PreRentreeCompatibilityRule[] @relation("PreRentreeCompatibilityApprovedBy")
//   preRentreeAttendanceRecords        PreRentreeAttendance[] @relation("PreRentreeAttendanceRecordedBy")
//   preRentreeArbitrationDecisions     PreRentreeArbitration[] @relation("PreRentreeArbitrationDecidedBy")
// }
// model ParentProfile { preRentreeGuardianRelationships PreRentreeGuardianRelationship[] }
// model Student {
//   preRentreeGuardianRelationships PreRentreeGuardianRelationship[]
//   preRentreeApplications          PreRentreeApplication[]
//   preRentreeEnrollments           PreRentreeEnrollment[]
//   preRentreeScheduleClaims        PreRentreeStudentScheduleClaim[]
// }
// model CoachProfile {
//   preRentreeQualifications PreRentreeTeacherQualification[]
//   preRentreeAvailabilities PreRentreeTeacherAvailability[]
//   preRentreeAssignments    PreRentreeTeacherAssignment[]
//   preRentreeSessions       PreRentreeSession[]
//   preRentreeReports        PreRentreePedagogicalReport[]
// }
// model Invoice { preRentreeEnrollment PreRentreeEnrollment? }
// model UserDocument { preRentreeLinks PreRentreeDocumentLink[] }

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
enum PreRentreeWaitlistStatus { ACTIVE PROMOTED DECLINED EXPIRED CANCELLED }
enum PreRentreePaymentStatus { INITIATED PENDING SUCCEEDED FAILED CANCELLED RECONCILIATION_REQUIRED }
enum PreRentreePaymentPurpose { DEPOSIT BALANCE FULL OTHER }
enum PreRentreeRefundStatus { REQUESTED APPROVED INITIATED SUCCEEDED FAILED CANCELLED }
enum PreRentreeSessionStatus { SCHEDULED CONFIRMED IN_PROGRESS COMPLETED CANCELLED }
enum PreRentreeAttendanceStatus { UNKNOWN PRESENT ABSENT EXCUSED LATE }
enum PreRentreeGuardianRelationType { MOTHER FATHER LEGAL_GUARDIAN OTHER }
enum PreRentreeGuardianVerificationStatus { PROPOSED PENDING_VERIFICATION VERIFIED REJECTED REVOKED EXPIRED }
enum PreRentreeArbitrationType { PEDAGOGICAL_COMPATIBILITY SECOND_GROUP ADDITIONAL_TEACHER ADDITIONAL_SLOT WAITLIST DEFERRAL }
enum PreRentreeArbitrationStatus { OPEN UNDER_REVIEW APPROVED REJECTED SUPERSEDED CLOSED }
enum PreRentreeCommunicationStatus { PLANNED QUEUED SENT DELIVERED FAILED CANCELLED }
enum PreRentreeCommunicationChannel { EMAIL WHATSAPP DASHBOARD PHONE_TASK }
enum PreRentreeOutboxStatus { PENDING PROCESSING DELIVERED FAILED DEAD_LETTER CANCELLED }
enum PreRentreeMaterializationStatus { PLANNED APPLYING APPLIED VERIFIED FAILED LOGICALLY_ROLLED_BACK }
enum PreRentreeMaterializationCommand { VALIDATE PLAN APPLY VERIFY LOGICAL_ROLLBACK }
enum PreRentreeStaffRole { ADMINISTRATIVE_ASSISTANT PEDAGOGICAL_MANAGER FINANCIAL_MANAGER ADMINISTRATOR }
enum PreRentreeResourceStatus { ACTIVE INACTIVE MAINTENANCE ARCHIVED }
enum PreRentreeTeacherAssignmentRole { PRIMARY SUBSTITUTE ASSISTANT }
enum PreRentreeWaitlistPriority { STANDARD MANUAL_PRIORITY }
enum PreRentreeReportStatus { DRAFT PUBLISHED WITHDRAWN ARCHIVED }
enum PreRentreeDocumentAudience { ADMIN PEDAGOGICAL_STAFF COACH PARENT STUDENT COHORT }

model PreRentreeEdition {
  id                     String @id @default(cuid())
  code                   String @unique @db.VarChar(64)
  slug                   String @unique @db.VarChar(128)
  label                  String @db.VarChar(160)
  timeZone               String @db.VarChar(64)
  startDate              DateTime @db.Date
  endDate                DateTime @db.Date
  groupDecisionAt        DateTime @db.Timestamptz(3)
  lifecycleStatus        PreRentreeLifecycleStatus @default(DRAFT)
  publicationStatus      PreRentreePublicationStatus @default(DRAFT)
  templateVersion        String @db.VarChar(64)
  templateChecksum       String @db.VarChar(64)
  pricingCatalogVersion  String @db.VarChar(64)
  publicFeatureFlagKey   String @db.VarChar(128)
  apiFeatureFlagKey      String @db.VarChar(128)
  dashboardFeatureFlagKey String @db.VarChar(128)
  materializedAt         DateTime? @db.Timestamptz(3)
  archivedAt             DateTime? @db.Timestamptz(3)
  version                Int @default(1)
  createdAt              DateTime @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime @updatedAt @db.Timestamptz(3)
  modules                PreRentreeModule[]
  applications           PreRentreeApplication[]
  enrollments            PreRentreeEnrollment[]
  staffGrants            PreRentreeStaffGrant[]
  materializations       PreRentreeMaterializationRun[]
  arbitrations           PreRentreeArbitration[]
  communications         PreRentreeCommunication[]
  auditEvents            PreRentreeAuditEvent[]
  documentLinks          PreRentreeDocumentLink[]
  @@index([publicationStatus, startDate])
  @@map("pre_rentree_editions")
}

model PreRentreeModule {
  id                    String @id @default(cuid())
  editionId             String
  edition               PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  code                  String @db.VarChar(96)
  gradeLevel            GradeLevel
  subject               Subject
  publicTitleKey        String @db.VarChar(160)
  objectiveContentKey   String? @db.VarChar(160)
  sessionDurationMinutes Int
  plannedSessionCount   Int
  requiredEquipmentCodes String[] @default([])
  requiredQualificationCode String @db.VarChar(96)
  status                PreRentreeModuleStatus @default(DRAFT)
  displayOrder          Int
  archivedAt            DateTime? @db.Timestamptz(3)
  version               Int @default(1)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
  variants              PreRentreeModuleVariant[]
  cohorts               PreRentreeCohort[]
  proposalItems         PreRentreeProposalItem[]
  enrollmentModules     PreRentreeEnrollmentModule[]
  reports               PreRentreePedagogicalReport[]
  documentLinks         PreRentreeDocumentLink[]
  @@unique([editionId, code])
  @@unique([editionId, gradeLevel, subject])
  @@index([editionId, status, displayOrder])
  @@map("pre_rentree_modules")
}

model PreRentreeVariant {
  id                  String @id @default(cuid())
  code                String @unique @db.VarChar(96)
  gradeLevel          GradeLevel
  subject             Subject
  kind                PreRentreeVariantKind
  academicTrack       AcademicTrack?
  pathwayCode         String? @db.VarChar(64)
  mathOption          PreRentreeMathOption?
  isSpecialty         Boolean @default(false)
  publicLabelKey      String @db.VarChar(160)
  rulesVersion        String @db.VarChar(64)
  status              PreRentreeModuleStatus @default(ACTIVE)
  createdAt           DateTime @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime @updatedAt @db.Timestamptz(3)
  modules             PreRentreeModuleVariant[]
  cohorts             PreRentreeCohortVariant[]
  applicationSelections PreRentreeApplicationSelection[]
  proposalItems       PreRentreeProposalItem[]
  enrollmentModules   PreRentreeEnrollmentModule[]
  rulesAsLeft         PreRentreeCompatibilityRule[] @relation("PreRentreeRuleLeft")
  rulesAsRight        PreRentreeCompatibilityRule[] @relation("PreRentreeRuleRight")
  @@index([gradeLevel, subject, status])
  @@map("pre_rentree_variants")
}

model PreRentreeModuleVariant {
  moduleId String
  variantId String
  module PreRentreeModule @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  variant PreRentreeVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  isDefault Boolean @default(false)
  @@id([moduleId, variantId])
  @@map("pre_rentree_module_variants")
}

model PreRentreeCompatibilityRule {
  id              String @id @default(cuid())
  leftVariantId   String
  rightVariantId  String
  leftVariant     PreRentreeVariant @relation("PreRentreeRuleLeft", fields: [leftVariantId], references: [id], onDelete: Restrict)
  rightVariant    PreRentreeVariant @relation("PreRentreeRuleRight", fields: [rightVariantId], references: [id], onDelete: Restrict)
  rulesVersion    String @db.VarChar(64)
  outcome         PreRentreeCompatibilityOutcome
  differentiationKey String? @db.VarChar(160)
  validFrom       DateTime @db.Date
  validUntil      DateTime? @db.Date
  approvedById    String?
  approvedBy      User? @relation("PreRentreeCompatibilityApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt      DateTime? @db.Timestamptz(3)
  rationale       String? @db.Text
  cohortVariants  PreRentreeCohortVariant[]
  @@unique([rulesVersion, leftVariantId, rightVariantId])
  @@index([leftVariantId, rightVariantId, validFrom])
  @@map("pre_rentree_compatibility_rules")
}

model PreRentreeCohort {
  id                    String @id @default(cuid())
  moduleId              String
  module                PreRentreeModule @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  code                  String @db.VarChar(112)
  label                 String @db.VarChar(160)
  minCapacity           Int
  maxCapacity           Int
  modality              PreRentreeModality @default(IN_PERSON)
  operationalStatus     PreRentreeCohortStatus @default(DRAFT)
  publicationStatus     PreRentreePublicationStatus @default(DRAFT)
  pedagogicalValidation PreRentreeValidationStatus @default(PENDING)
  logisticalValidation  PreRentreeValidationStatus @default(PENDING)
  decisionAt            DateTime? @db.Timestamptz(3)
  primaryRoomId         String?
  primaryRoom           PreRentreeRoom? @relation(fields: [primaryRoomId], references: [id], onDelete: Restrict)
  archivedAt            DateTime? @db.Timestamptz(3)
  version               Int @default(1)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
  variants              PreRentreeCohortVariant[]
  sessions              PreRentreeSession[]
  teacherAssignments    PreRentreeTeacherAssignment[]
  assignments           PreRentreeCohortAssignment[]
  seatHolds             PreRentreeSeatHold[]
  waitlistEntries       PreRentreeWaitlistEntry[]
  arbitrations          PreRentreeArbitration[]
  documentLinks         PreRentreeDocumentLink[]
  @@unique([moduleId, code])
  @@index([moduleId, operationalStatus, publicationStatus])
  @@index([primaryRoomId])
  @@map("pre_rentree_cohorts")
}

model PreRentreeCohortVariant {
  cohortId String
  variantId String
  cohort PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  variant PreRentreeVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  compatibilityRuleId String?
  compatibilityRule PreRentreeCompatibilityRule? @relation(fields: [compatibilityRuleId], references: [id], onDelete: Restrict)
  approvedAt DateTime? @db.Timestamptz(3)
  @@id([cohortId, variantId])
  @@map("pre_rentree_cohort_variants")
}

model PreRentreeSession {
  id              String @id @default(cuid())
  cohortId        String
  cohort          PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  sessionNumber   Int
  startAt         DateTime @db.Timestamptz(3)
  endAt           DateTime @db.Timestamptz(3)
  roomId          String?
  room            PreRentreeRoom? @relation(fields: [roomId], references: [id], onDelete: Restrict)
  teacherId       String?
  teacher         CoachProfile? @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  contentKey      String? @db.VarChar(160)
  status          PreRentreeSessionStatus @default(SCHEDULED)
  cancellationReason String? @db.Text
  replacesSessionId String? @unique
  replacesSession PreRentreeSession? @relation("PreRentreeSessionReplacement", fields: [replacesSessionId], references: [id], onDelete: Restrict)
  replacement    PreRentreeSession? @relation("PreRentreeSessionReplacement")
  archivedAt      DateTime? @db.Timestamptz(3)
  version         Int @default(1)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)
  attendances     PreRentreeAttendance[]
  scheduleClaims  PreRentreeStudentScheduleClaim[]
  documentLinks   PreRentreeDocumentLink[]
  @@unique([cohortId, sessionNumber])
  @@index([teacherId, startAt, endAt])
  @@index([roomId, startAt, endAt])
  @@index([cohortId, startAt])
  @@map("pre_rentree_sessions")
}

model PreRentreeSite {
  id          String @id @default(cuid())
  code        String @unique @db.VarChar(64)
  label       String @db.VarChar(160)
  addressKey  String @db.VarChar(160)
  timeZone    String @db.VarChar(64)
  status      PreRentreeResourceStatus @default(ACTIVE)
  archivedAt  DateTime? @db.Timestamptz(3)
  rooms       PreRentreeRoom[]
  @@map("pre_rentree_sites")
}

model PreRentreeRoom {
  id          String @id @default(cuid())
  siteId      String
  site        PreRentreeSite @relation(fields: [siteId], references: [id], onDelete: Restrict)
  code        String @db.VarChar(64)
  label       String @db.VarChar(160)
  capacity    Int
  roomType    String @db.VarChar(64)
  status      PreRentreeResourceStatus @default(ACTIVE)
  archivedAt  DateTime? @db.Timestamptz(3)
  equipment   PreRentreeRoomEquipment[]
  blackouts   PreRentreeRoomBlackout[]
  sessions    PreRentreeSession[]
  cohorts     PreRentreeCohort[]
  @@unique([siteId, code])
  @@index([siteId, status])
  @@map("pre_rentree_rooms")
}

model PreRentreeEquipment {
  id          String @id @default(cuid())
  code        String @unique @db.VarChar(64)
  labelKey    String @db.VarChar(160)
  status      PreRentreeResourceStatus @default(ACTIVE)
  rooms       PreRentreeRoomEquipment[]
  @@map("pre_rentree_equipment")
}

model PreRentreeRoomEquipment {
  roomId      String
  equipmentId String
  room        PreRentreeRoom @relation(fields: [roomId], references: [id], onDelete: Restrict)
  equipment   PreRentreeEquipment @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  quantity    Int
  verifiedAt  DateTime? @db.Timestamptz(3)
  notes       String? @db.Text
  @@id([roomId, equipmentId])
  @@map("pre_rentree_room_equipment")
}

model PreRentreeRoomBlackout {
  id        String @id @default(cuid())
  roomId    String
  room      PreRentreeRoom @relation(fields: [roomId], references: [id], onDelete: Restrict)
  startAt   DateTime @db.Timestamptz(3)
  endAt     DateTime @db.Timestamptz(3)
  reason    String @db.VarChar(255)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  @@index([roomId, startAt, endAt])
  @@map("pre_rentree_room_blackouts")
}

model PreRentreeTeacherQualification {
  id          String @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Restrict)
  code        String @db.VarChar(96)
  subject     Subject
  gradeLevel  GradeLevel
  validFrom   DateTime @db.Date
  validUntil  DateTime? @db.Date
  status      PreRentreeValidationStatus @default(PENDING)
  evidenceKey String? @db.VarChar(255)
  @@unique([coachId, code, validFrom])
  @@index([subject, gradeLevel, status])
  @@map("pre_rentree_teacher_qualifications")
}

model PreRentreeTeacherAvailability {
  id        String @id @default(cuid())
  coachId   String
  coach     CoachProfile @relation(fields: [coachId], references: [id], onDelete: Restrict)
  startAt   DateTime @db.Timestamptz(3)
  endAt     DateTime @db.Timestamptz(3)
  available Boolean @default(true)
  source    String @db.VarChar(64)
  @@index([coachId, startAt, endAt])
  @@map("pre_rentree_teacher_availabilities")
}

model PreRentreeTeacherAssignment {
  id           String @id @default(cuid())
  cohortId     String
  cohort       PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  coachId      String
  coach        CoachProfile @relation(fields: [coachId], references: [id], onDelete: Restrict)
  role         PreRentreeTeacherAssignmentRole
  validFrom    DateTime @db.Timestamptz(3)
  validUntil   DateTime? @db.Timestamptz(3)
  validationStatus PreRentreeValidationStatus @default(PENDING)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  @@unique([cohortId, coachId, role, validFrom])
  @@index([coachId, validFrom, validUntil])
  @@map("pre_rentree_teacher_assignments")
}

model PreRentreeStaffGrant {
  id          String @id @default(cuid())
  editionId   String
  edition     PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  userId      String
  user        User @relation(fields: [userId], references: [id], onDelete: Restrict)
  role        PreRentreeStaffRole
  validFrom   DateTime @db.Timestamptz(3)
  validUntil  DateTime? @db.Timestamptz(3)
  permissions String[] @default([])
  revokedAt   DateTime? @db.Timestamptz(3)
  @@unique([editionId, userId, role, validFrom])
  @@index([userId, editionId, validUntil])
  @@map("pre_rentree_staff_grants")
}

model PreRentreeGuardianRelationship {
  id                 String @id @default(cuid())
  studentId          String
  student            Student @relation(fields: [studentId], references: [id], onDelete: Restrict)
  parentProfileId    String
  parentProfile      ParentProfile @relation(fields: [parentProfileId], references: [id], onDelete: Restrict)
  relationType       PreRentreeGuardianRelationType
  verificationStatus PreRentreeGuardianVerificationStatus @default(PROPOSED)
  rights             String[] @default([])
  isPrimary          Boolean @default(false)
  validFrom          DateTime @db.Date
  validUntil         DateTime? @db.Date
  source             String @db.VarChar(64)
  verifiedById       String?
  verifiedBy         User? @relation("PreRentreeGuardianVerifiedBy", fields: [verifiedById], references: [id], onDelete: SetNull)
  verifiedAt         DateTime? @db.Timestamptz(3)
  revokedById        String?
  revokedBy          User? @relation("PreRentreeGuardianRevokedBy", fields: [revokedById], references: [id], onDelete: SetNull)
  revokedAt          DateTime? @db.Timestamptz(3)
  revocationReason   String? @db.Text
  version            Int @default(1)
  createdAt          DateTime @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime @updatedAt @db.Timestamptz(3)
  applications       PreRentreeApplication[]
  enrollments        PreRentreeEnrollment[]
  @@unique([studentId, parentProfileId, validFrom])
  @@index([parentProfileId, verificationStatus, validUntil])
  @@index([studentId, verificationStatus, validUntil])
  @@map("pre_rentree_guardian_relationships")
}

model PreRentreeApplication {
  id                    String @id @default(cuid())
  editionId             String
  edition               PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  publicReference       String @unique @db.VarChar(32)
  idempotencyKeyHash    String @unique @db.VarChar(64)
  payloadHash           String @db.VarChar(64)
  guardianRelationshipId String?
  guardianRelationship  PreRentreeGuardianRelationship? @relation(fields: [guardianRelationshipId], references: [id], onDelete: Restrict)
  studentId             String?
  student               Student? @relation(fields: [studentId], references: [id], onDelete: Restrict)
  contactName           String @db.VarChar(160)
  contactEmail          String? @db.VarChar(254)
  contactPhone          String? @db.VarChar(32)
  normalizedContactHash String @db.VarChar(64)
  studentFirstName      String @db.VarChar(100)
  gradeLevel            GradeLevel
  academicTrack         AcademicTrack?
  specialties           Subject[] @default([])
  mathOption            PreRentreeMathOption @default(NONE)
  sourceCampaign        String? @db.VarChar(96)
  status                PreRentreeApplicationStatus @default(RECEIVED)
  compatibilityStatus   PreRentreeCompatibilityOutcome @default(REQUIRES_ARBITRATION)
  submittedAt           DateTime @default(now()) @db.Timestamptz(3)
  archivedAt            DateTime? @db.Timestamptz(3)
  version               Int @default(1)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
  selections            PreRentreeApplicationSelection[]
  consentEvidence       PreRentreeConsentEvidence[]
  proposals             PreRentreeProposal[]
  waitlistEntries       PreRentreeWaitlistEntry[]
  arbitrations          PreRentreeArbitration[]
  communications        PreRentreeCommunication[]
  @@index([editionId, status, submittedAt])
  @@index([normalizedContactHash, editionId])
  @@map("pre_rentree_applications")
}

model PreRentreeConsentEvidence {
  id             String @id @default(cuid())
  applicationId  String
  application    PreRentreeApplication @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  consentCode    String @db.VarChar(64)
  documentVersion String @db.VarChar(64)
  accepted       Boolean
  capturedAt     DateTime @db.Timestamptz(3)
  evidenceHash   String @db.VarChar(64)
  @@unique([applicationId, consentCode, documentVersion])
  @@map("pre_rentree_consent_evidence")
}

model PreRentreeApplicationSelection {
  id             String @id @default(cuid())
  applicationId  String
  application    PreRentreeApplication @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  variantId      String
  variant        PreRentreeVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  preferenceRank Int?
  constraints    Json?
  @@unique([applicationId, variantId])
  @@index([variantId, applicationId])
  @@map("pre_rentree_application_selections")
}

model PreRentreeProposal {
  id                    String @id @default(cuid())
  applicationId         String
  application           PreRentreeApplication @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  code                  String @unique @db.VarChar(64)
  status                PreRentreeProposalStatus @default(DRAFT)
  productCode           String @db.VarChar(64)
  catalogVersion        String @db.VarChar(64)
  currency              String @default("TND") @db.VarChar(3)
  totalMillimes         Int
  depositMillimes       Int
  balanceMillimes       Int
  roundingRuleCode      String @db.VarChar(64)
  subjectCount          Int
  totalDurationMinutes  Int
  termsVersion          String @db.VarChar(64)
  refundPolicyVersion   String @db.VarChar(64)
  discountSnapshot      Json?
  exceptionJustification String? @db.Text
  snapshotPayload       Json
  snapshotChecksum      String @db.VarChar(64)
  calculatedAt          DateTime @db.Timestamptz(3)
  issuedAt              DateTime? @db.Timestamptz(3)
  expiresAt             DateTime? @db.Timestamptz(3)
  version               Int @default(1)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  items                 PreRentreeProposalItem[]
  enrollment            PreRentreeEnrollment?
  @@index([applicationId, status])
  @@map("pre_rentree_proposals")
}

model PreRentreeProposalItem {
  id              String @id @default(cuid())
  proposalId      String
  proposal        PreRentreeProposal @relation(fields: [proposalId], references: [id], onDelete: Restrict)
  moduleId        String
  module          PreRentreeModule @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  variantId       String
  variant         PreRentreeVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  moduleCode      String @db.VarChar(96)
  variantCode     String @db.VarChar(96)
  durationMinutes Int
  @@unique([proposalId, moduleId])
  @@map("pre_rentree_proposal_items")
}

model PreRentreeEnrollment {
  id                    String @id @default(cuid())
  editionId             String
  edition               PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  proposalId            String @unique
  proposal              PreRentreeProposal @relation(fields: [proposalId], references: [id], onDelete: Restrict)
  studentId             String
  student               Student @relation(fields: [studentId], references: [id], onDelete: Restrict)
  guardianRelationshipId String
  guardianRelationship  PreRentreeGuardianRelationship @relation(fields: [guardianRelationshipId], references: [id], onDelete: Restrict)
  contractReference     String @unique @db.VarChar(32)
  status                PreRentreeEnrollmentStatus @default(PENDING)
  acceptedTermsVersion  String @db.VarChar(64)
  acceptedRefundPolicyVersion String @db.VarChar(64)
  contractChecksum      String @db.VarChar(64)
  confirmedAt           DateTime? @db.Timestamptz(3)
  cancelledAt           DateTime? @db.Timestamptz(3)
  cancellationReason    String? @db.Text
  invoiceId             String? @unique
  invoice               Invoice? @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  archivedAt            DateTime? @db.Timestamptz(3)
  version               Int @default(1)
  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)
  modules               PreRentreeEnrollmentModule[]
  assignments           PreRentreeCohortAssignment[]
  seatHolds             PreRentreeSeatHold[]
  waitlistEntries       PreRentreeWaitlistEntry[]
  payments              PreRentreePayment[]
  reports               PreRentreePedagogicalReport[]
  documentLinks         PreRentreeDocumentLink[]
  communications        PreRentreeCommunication[]
  @@unique([editionId, studentId])
  @@index([guardianRelationshipId, status])
  @@index([editionId, status])
  @@map("pre_rentree_enrollments")
}

model PreRentreeEnrollmentModule {
  id           String @id @default(cuid())
  enrollmentId String
  enrollment   PreRentreeEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  moduleId     String
  module       PreRentreeModule @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  variantId    String
  variant      PreRentreeVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  status       PreRentreeModuleStatus @default(ACTIVE)
  @@unique([enrollmentId, moduleId])
  @@index([moduleId, variantId])
  @@map("pre_rentree_enrollment_modules")
}

model PreRentreeCohortAssignment {
  id           String @id @default(cuid())
  enrollmentId String
  enrollment   PreRentreeEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  cohortId     String
  cohort       PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  status       PreRentreeAssignmentStatus @default(PROPOSED)
  confirmedAt  DateTime? @db.Timestamptz(3)
  cancelledAt  DateTime? @db.Timestamptz(3)
  transferredFromId String? @unique
  transferredFrom PreRentreeCohortAssignment? @relation("PreRentreeAssignmentTransfer", fields: [transferredFromId], references: [id], onDelete: Restrict)
  transferredTo   PreRentreeCohortAssignment[] @relation("PreRentreeAssignmentTransfer")
  transferReason String? @db.Text
  version       Int @default(1)
  createdAt     DateTime @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime @updatedAt @db.Timestamptz(3)
  attendances   PreRentreeAttendance[]
  scheduleClaims PreRentreeStudentScheduleClaim[]
  convertedHolds PreRentreeSeatHold[] @relation("PreRentreeConvertedAssignment")
  @@unique([enrollmentId, cohortId])
  @@index([cohortId, status])
  @@map("pre_rentree_cohort_assignments")
}

model PreRentreeSeatHold {
  id             String @id @default(cuid())
  enrollmentId   String
  enrollment     PreRentreeEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  cohortId       String
  cohort         PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  idempotencyKeyHash String @db.VarChar(64)
  payloadHash    String @db.VarChar(64)
  status         PreRentreeSeatHoldStatus @default(ACTIVE)
  expiresAt      DateTime @db.Timestamptz(3)
  convertedAssignmentId String? @unique
  convertedAssignment PreRentreeCohortAssignment? @relation("PreRentreeConvertedAssignment", fields: [convertedAssignmentId], references: [id], onDelete: Restrict)
  releasedAt     DateTime? @db.Timestamptz(3)
  releaseReason  String? @db.Text
  version        Int @default(1)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  promotionFor   PreRentreeWaitlistEntry? @relation("PreRentreePromotionHold")
  @@unique([cohortId, idempotencyKeyHash])
  @@index([cohortId, status, expiresAt])
  @@index([enrollmentId, status])
  @@map("pre_rentree_seat_holds")
}

model PreRentreeWaitlistEntry {
  id             String @id @default(cuid())
  cohortId       String
  cohort         PreRentreeCohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  applicationId  String?
  application    PreRentreeApplication? @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  enrollmentId   String?
  enrollment     PreRentreeEnrollment? @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  status         PreRentreeWaitlistStatus @default(ACTIVE)
  priority       PreRentreeWaitlistPriority @default(STANDARD)
  sequence       BigInt @default(autoincrement())
  enteredAt      DateTime @default(now()) @db.Timestamptz(3)
  expiresAt      DateTime? @db.Timestamptz(3)
  promotedAt     DateTime? @db.Timestamptz(3)
  promotionHoldId String? @unique
  promotionHold   PreRentreeSeatHold? @relation("PreRentreePromotionHold", fields: [promotionHoldId], references: [id], onDelete: Restrict)
  version         Int @default(1)
  @@index([cohortId, status, priority, sequence])
  @@index([applicationId, cohortId])
  @@index([enrollmentId, cohortId])
  @@map("pre_rentree_waitlist_entries")
}

model PreRentreePayment {
  id              String @id @default(cuid())
  enrollmentId    String
  enrollment      PreRentreeEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  purpose         PreRentreePaymentPurpose
  status          PreRentreePaymentStatus @default(INITIATED)
  currency        String @default("TND") @db.VarChar(3)
  expectedMillimes Int
  receivedMillimes Int?
  provider        String @db.VarChar(64)
  providerReference String?
  idempotencyKeyHash String @db.VarChar(64)
  initiatedAt     DateTime @default(now()) @db.Timestamptz(3)
  receivedAt      DateTime? @db.Timestamptz(3)
  reconciledAt    DateTime? @db.Timestamptz(3)
  proofKey        String? @db.VarChar(255)
  version         Int @default(1)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)
  events          PreRentreePaymentEvent[]
  refunds         PreRentreeRefund[]
  @@unique([provider, providerReference])
  @@unique([enrollmentId, idempotencyKeyHash])
  @@index([enrollmentId, status])
  @@map("pre_rentree_payments")
}

model PreRentreePaymentEvent {
  id              String @id @default(cuid())
  paymentId       String
  payment         PreRentreePayment @relation(fields: [paymentId], references: [id], onDelete: Restrict)
  providerEventId String
  eventType       String @db.VarChar(96)
  payloadHash     String @db.VarChar(64)
  receivedAt      DateTime @default(now()) @db.Timestamptz(3)
  processedAt     DateTime? @db.Timestamptz(3)
  outcome         String? @db.VarChar(64)
  @@unique([paymentId, providerEventId])
  @@map("pre_rentree_payment_events")
}

model PreRentreeRefund {
  id               String @id @default(cuid())
  paymentId        String
  payment          PreRentreePayment @relation(fields: [paymentId], references: [id], onDelete: Restrict)
  status           PreRentreeRefundStatus @default(REQUESTED)
  currency         String @default("TND") @db.VarChar(3)
  requestedMillimes Int
  refundedMillimes Int?
  reasonCode       String @db.VarChar(64)
  reasonDetail     String? @db.Text
  providerReference String?
  idempotencyKeyHash String @db.VarChar(64)
  requestedAt      DateTime @default(now()) @db.Timestamptz(3)
  completedAt      DateTime? @db.Timestamptz(3)
  version          Int @default(1)
  @@unique([paymentId, idempotencyKeyHash])
  @@unique([providerReference])
  @@index([paymentId, status])
  @@map("pre_rentree_refunds")
}

model PreRentreeAttendance {
  id           String @id @default(cuid())
  sessionId    String
  session      PreRentreeSession @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  assignmentId String
  assignment   PreRentreeCohortAssignment @relation(fields: [assignmentId], references: [id], onDelete: Restrict)
  status       PreRentreeAttendanceStatus @default(UNKNOWN)
  recordedById String?
  recordedBy   User? @relation("PreRentreeAttendanceRecordedBy", fields: [recordedById], references: [id], onDelete: SetNull)
  recordedAt   DateTime? @db.Timestamptz(3)
  justification String? @db.Text
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)
  @@unique([sessionId, assignmentId])
  @@index([assignmentId, status])
  @@map("pre_rentree_attendances")
}

model PreRentreePedagogicalReport {
  id             String @id @default(cuid())
  enrollmentId   String
  enrollment     PreRentreeEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  moduleId       String?
  module         PreRentreeModule? @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  coachId        String
  coach          CoachProfile @relation(fields: [coachId], references: [id], onDelete: Restrict)
  status         PreRentreeReportStatus @default(DRAFT)
  studentContent String @db.Text
  parentContent  String @db.Text
  internalContent String? @db.Text
  structuredAssessment Json?
  publishedAt    DateTime? @db.Timestamptz(3)
  archivedAt     DateTime? @db.Timestamptz(3)
  version        Int @default(1)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)
  @@unique([enrollmentId, moduleId])
  @@index([coachId, status])
  @@map("pre_rentree_pedagogical_reports")
}

model PreRentreeDocumentLink {
  id           String @id @default(cuid())
  documentId   String
  document     UserDocument @relation(fields: [documentId], references: [id], onDelete: Restrict)
  editionId    String?
  edition      PreRentreeEdition? @relation(fields: [editionId], references: [id], onDelete: Restrict)
  moduleId     String?
  module       PreRentreeModule? @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  cohortId     String?
  cohort       PreRentreeCohort? @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  sessionId    String?
  enrollmentId String?
  enrollment   PreRentreeEnrollment? @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  audience     PreRentreeDocumentAudience
  archivedAt   DateTime? @db.Timestamptz(3)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  session      PreRentreeSession? @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  @@index([documentId, audience])
  @@index([editionId, moduleId, cohortId, sessionId, enrollmentId])
  @@map("pre_rentree_document_links")
}

model PreRentreeArbitration {
  id             String @id @default(cuid())
  editionId      String
  edition        PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  applicationId  String?
  application    PreRentreeApplication? @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  cohortId       String?
  cohort         PreRentreeCohort? @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  type           PreRentreeArbitrationType
  status         PreRentreeArbitrationStatus @default(OPEN)
  ruleVersion    String @db.VarChar(64)
  decisionCode   String?
  justification  String? @db.Text
  impact         Json?
  decidedById    String?
  decidedBy      User? @relation("PreRentreeArbitrationDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt      DateTime? @db.Timestamptz(3)
  version        Int @default(1)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)
  @@index([editionId, status, type])
  @@index([applicationId, cohortId])
  @@map("pre_rentree_arbitrations")
}

model PreRentreeCommunication {
  id             String @id @default(cuid())
  editionId      String
  edition        PreRentreeEdition @relation(fields: [editionId], references: [id], onDelete: Restrict)
  enrollmentId   String?
  enrollment     PreRentreeEnrollment? @relation(fields: [enrollmentId], references: [id], onDelete: Restrict)
  applicationId  String?
  application    PreRentreeApplication? @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  channel        PreRentreeCommunicationChannel
  purposeCode    String @db.VarChar(96)
  templateCode   String @db.VarChar(96)
  templateVersion String @db.VarChar(64)
  parameters     Json
  recipientRefHash String @db.VarChar(64)
  status         PreRentreeCommunicationStatus @default(PLANNED)
  providerReference String?
  createdById    String?
  createdBy      User? @relation("PreRentreeCommunicationCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  scheduledAt    DateTime? @db.Timestamptz(3)
  sentAt         DateTime? @db.Timestamptz(3)
  deliveredAt    DateTime? @db.Timestamptz(3)
  failureCode    String? @db.VarChar(64)
  version        Int @default(1)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  @@index([editionId, status, scheduledAt])
  @@index([enrollmentId, applicationId])
  @@map("pre_rentree_communications")
}

model PreRentreeOutboxEvent {
  id             String @id @default(cuid())
  aggregateType  String @db.VarChar(64)
  aggregateId    String
  eventType      String @db.VarChar(96)
  payload        Json
  payloadVersion Int
  idempotencyKey String @unique @db.VarChar(160)
  status         PreRentreeOutboxStatus @default(PENDING)
  availableAt    DateTime @default(now()) @db.Timestamptz(3)
  lockedAt       DateTime? @db.Timestamptz(3)
  lockedBy       String? @db.VarChar(96)
  attempts       Int @default(0)
  lastErrorCode  String? @db.VarChar(64)
  deliveredAt    DateTime? @db.Timestamptz(3)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  @@index([status, availableAt])
  @@index([aggregateType, aggregateId, createdAt])
  @@map("pre_rentree_outbox_events")
}

model PreRentreeAuditEvent {
  id             String @id @default(cuid())
  editionId      String?
  edition        PreRentreeEdition? @relation(fields: [editionId], references: [id], onDelete: Restrict)
  actorUserId    String?
  actorUser      User? @relation("PreRentreeAuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  actorType      String @db.VarChar(32)
  action         String @db.VarChar(96)
  resourceType   String @db.VarChar(64)
  resourceId     String
  previousState  String? @db.VarChar(64)
  nextState      String? @db.VarChar(64)
  reasonCode     String? @db.VarChar(64)
  metadata       Json?
  correlationId  String @db.VarChar(64)
  occurredAt     DateTime @default(now()) @db.Timestamptz(3)
  @@index([resourceType, resourceId, occurredAt])
  @@index([editionId, occurredAt])
  @@index([actorUserId, occurredAt])
  @@map("pre_rentree_audit_events")
}

model PreRentreeMaterializationRun {
  id              String @id @default(cuid())
  editionId       String?
  edition         PreRentreeEdition? @relation(fields: [editionId], references: [id], onDelete: Restrict)
  editionCode     String @db.VarChar(64)
  templateVersion String @db.VarChar(64)
  templateChecksum String @db.VarChar(64)
  command         PreRentreeMaterializationCommand
  status          PreRentreeMaterializationStatus @default(PLANNED)
  plan            Json
  result          Json?
  appliedById     String?
  appliedBy       User? @relation("PreRentreeMaterializedBy", fields: [appliedById], references: [id], onDelete: SetNull)
  startedAt       DateTime? @db.Timestamptz(3)
  completedAt     DateTime? @db.Timestamptz(3)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  @@unique([editionCode, templateChecksum, command])
  @@index([status, createdAt])
  @@map("pre_rentree_materialization_runs")
}

model PreRentreeStudentScheduleClaim {
  id           String @id @default(cuid())
  studentId    String
  student      Student @relation(fields: [studentId], references: [id], onDelete: Restrict)
  assignmentId String
  assignment   PreRentreeCohortAssignment @relation(fields: [assignmentId], references: [id], onDelete: Restrict)
  sessionId    String
  session      PreRentreeSession @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  startAt      DateTime @db.Timestamptz(3)
  endAt        DateTime @db.Timestamptz(3)
  active       Boolean @default(true)
  sourceVersion Int @default(1)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  @@unique([studentId, sessionId])
  @@index([assignmentId])
  @@index([studentId, startAt, endAt])
  @@map("pre_rentree_student_schedule_claims")
}
```

## Contraintes SQL obligatoires non exprimées par Prisma

La migration M2 devra ajouter des `CHECK` nommés et réversibles : dates édition ordonnées ; `groupDecisionAt` antérieur au début ; durées et capacités positives ; `minCapacity = 3`, `maxCapacity = 5` pour PRE2026 ; séance `endAt > startAt` et 120 minutes pour le socle ; monnaie `TND` ; montants non négatifs ; `total = deposit + balance` ; 1 à 4 items par proposition ; exactement une cible application/inscription en liste d'attente ; cohérence des champs d'annulation, publication et vérification.

Les index partiels imposent une seule relation responsable principale active par élève, un seul hold actif par inscription/cohorte, une seule entrée de liste d'attente active par cible/cohorte, une seule affectation primaire active par cohorte et une seule affectation de cohorte active pour un couple inscription/module. Un `CHECK` impose exactement une portée métier (`editionId`, `moduleId`, `cohortId`, `sessionId` ou `enrollmentId`) par `PreRentreeDocumentLink`.

Les contraintes d'exclusion `btree_gist` portent sur `tstzrange(startAt,endAt,'[)')` pour l'enseignant, la salle, la cohorte et les claims élève. Elles ignorent les séances `CANCELLED` et claims inactifs. Voir [le contrat de planning](pre-rentree-2026-scheduling-constraints.md).

## Invariants de référence

- `PRE_RENTREE_2026` matérialise exactement 12 modules et 60 séances socle.
- Une cohorte ouverte référence au moins une variante ; plusieurs variantes exigent une règle compatible et un arbitrage approuvé.
- Une séance `SCHEDULED` peut rester sans enseignant ou salle pendant la matérialisation DRAFT ; une cohorte `CONFIRMED` a enseignant primaire, salle, validations pédagogique et logistique approuvées et cinq séances entièrement affectées.
- Une inscription `CONFIRMED` référence une proposition `ACCEPTED`, un élève et une relation responsable vérifiée active.
- La somme des paiements `SUCCEEDED` moins remboursements `SUCCEEDED` est dérivée ; elle ne change jamais le statut d'inscription directement.
- `FULL`, places disponibles, total d'heures et solde ne sont pas stockés.
- La projection `PreRentreeStudentScheduleClaim` est créée/supprimée dans la même transaction que l'activation/annulation d'une affectation ; une commande de réparation la reconstruit à partir des affectations et séances.
- Les snapshots proposition/contrat sont immuables après émission/acceptation ; leur checksum est vérifiable.

## Propriété d'écriture

| Ensemble | Service propriétaire |
|---|---|
| édition/template/modules/variantes | `templateMaterializationService`, puis `editionService`/`moduleService` selon transition |
| cohortes/ressources/planning | `cohortService`, `schedulingService` |
| qualifications/affectations | `cohortService` sous politique pédagogique/logistique |
| demande/sélections/consentements | `applicationService` |
| proposition/snapshot | `pricingService` et `applicationService` orchestrateur |
| inscription/modules | `enrollmentService` |
| affectation/hold/liste d'attente/claims | `capacityService` |
| paiement/remboursement | `paymentReconciliationService`, `refundService` |
| présence | `attendanceService` |
| bilan pédagogique | `pedagogicalReportService` |
| liens documentaires | `documentService` |
| relation responsable | `guardianRelationshipService` |
| arbitrage | `arbitrationService` |
| communication/outbox/audit | services dédiés, appelés dans la transaction métier |

`templateMaterializationService` dispose d'un droit d'initialisation borné sur édition, modules, variantes/règles, cohortes et séances uniquement avant `materializedAt` et tant que l'édition DRAFT est inutilisée. Ensuite, les propriétaires du tableau sont exclusifs.

## Compatibilité V1/V2

Les query services retournent des DTO discriminés `LEGACY_STAGE` ou `EDITION_V2`. Aucun service V2 n'écrit `Stage`, `StageSession`, `StageReservation`, `StageBilan` ou `Payment`. La relation V1 `Student.parentId` continue de servir V1 ; V2 autorise un parent uniquement par `PreRentreeGuardianRelationship`. Aucun backfill automatique, aucune écriture duale et aucun recalcul historique.

## Revue croisée du 11 juillet 2026

| Axe imposé | Résultat | Preuve |
|---|---|---|
| modèles ↔ états | 16 machines utilisent uniquement les enums/champs déclarés ; `PENDING_VERIFICATION` a été normalisé | [machines](pre-rentree-2026-state-machines.md) |
| modèles ↔ services | chaque table a un propriétaire ; audit/outbox ne modifient aucun agrégat | [services](pre-rentree-2026-service-boundaries.md) |
| services ↔ API | chaque route future délègue à un command/query service | [API](pre-rentree-2026-api-dto-contracts.md) |
| API ↔ DTO | chaque sortie nomme un DTO ou un DTO de commande spécialisé ; aucun Prisma exposé | [DTO](pre-rentree-2026-api-dto-contracts.md) |
| DTO ↔ dashboards | chaque écran référence un DTO et un état vide ; finance absente coach/élève | [dashboards](pre-rentree-2026-dashboard-data-contracts.md) |
| identités ↔ autorisations | parent par relation vérifiée active, coach par affectation active | [ABAC](pre-rentree-2026-authorization-matrix.md) |
| argent ↔ pricing ↔ paiement | millime `Int`, TND, règle canonique, snapshot/checksum, adaptateurs V1 explicites | [argent](pre-rentree-2026-money-and-pricing-snapshots.md) |
| planning ↔ DB | validation service + exclusions PostgreSQL, claims élève réparables | [planning](pre-rentree-2026-scheduling-constraints.md) |
| V1 ↔ V2 | aucun write dual, recalcul ou DTO ambigu ; discriminant obligatoire | [migration](pre-rentree-2026-additive-migration-plan.md) |
| template ↔ DB | fichier initialise, DB opère, frontend ne lit jamais le fichier | [matérialisation](pre-rentree-2026-template-materialization.md) |

La revue a également ajouté des compteurs `version` aux agrégats mutables, complété les FK/back-relations responsables, documents, communications, arbitrages et holds, et conservé `FULL`, solde et charges comme valeurs dérivées.

## Entrées encore requises, sans conflit de domaine

Ces valeurs ne changent ni les tables ni les frontières : les services les lisent via politiques versionnées et échouent explicitement si elles manquent.

- durée d'un seat hold et délai d'acceptation d'une promotion : `OWNER_INPUT_REQUIRED` ;
- durées de rétention, export et URL signée : `LEGAL_INPUT_REQUIRED` ;
- politique d'upload/antivirus : `SECURITY_INPUT_REQUIRED` ;
- remboursement partiel par motif et délai CGV : alignement juridique ;
- ressources nominatives, équipement NSI et modalité Physique-Chimie : gates pédagogiques/logistiques ;
- coûts directs et marge cible : blocage commercial, sans blocage du schéma ;
- preuve cible de PostgreSQL 15/`btree_gist`, sauvegarde/restauration et alignement des plages Prisma : M0.
