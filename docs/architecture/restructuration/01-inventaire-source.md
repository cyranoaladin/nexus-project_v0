# DOC-1 — Inventaire source (v3 — extraction déterministe, auth corrigée)

> Dénominateur = filesystem. Extraction par script, zéro paraphrase.
> Date : 2026-06-27 | Branche : main
> Méthode v3 : scripts déterministes + classification auth exhaustive + audit routes publiques

---

## Sommaire

- [Dénominateur reproductible](#dénominateur-reproductible)
- [(a) Schéma Prisma complet](#a-schéma-prisma-complet)
- [(b) Surface API](#b-surface-api)
- [(b-bis) Réalité middleware & classification auth](#b-bis-réalité-middleware--classification-auth)
- [(b-ter) Audit des routes publiques mutantes](#b-ter-audit-des-routes-publiques-mutantes)
- [(c) Dashboards par rôle](#c-dashboards-par-rôle)
- [(d) Libs métier](#d-libs-métier)

---

## Dénominateur reproductible

Commandes exactes pour vérifier les chiffres. Toute personne peut les relancer sur le dépôt.

```bash
$ grep -cE '^model ' prisma/schema.prisma
64

$ grep -cE '^enum ' prisma/schema.prisma
44

$ find app/api -name route.ts | wc -l
173

$ find app/dashboard -name 'page.tsx' | wc -l
70
```

| Dénominateur | Commande | Résultat |
|-------------|---------|----------|
| Modèles Prisma | `grep -cE '^model ' prisma/schema.prisma` | **64** |
| Enums Prisma | `grep -cE '^enum ' prisma/schema.prisma` | **44** |
| Routes API | `find app/api -name route.ts \| wc -l` | **173** |
| Pages dashboard | `find app/dashboard -name 'page.tsx' \| wc -l` | **70** |

### Scripts d'extraction (re-générables)

| Script | Usage | Sortie |
|--------|-------|--------|
| `scripts/extract-schema.mjs` | `node scripts/extract-schema.mjs` | Section (a) — verbatim, 0 omission |
| `scripts/extract-routes.sh` | `bash scripts/extract-routes.sh` | Section (b) — gardes + mutations grep |
| `scripts/cross-check.sh` | `bash scripts/cross-check.sh` | Contrôle de cohérence croisé |

### Contrôle de cohérence croisé (résultat)

- Routes 410 Gone avec mutations déclarées : **0**
- Mutations déclarées non confirmées dans le code : **0**
- Mutations dans le code non capturées par l'extraction : **0**
- Classification auth : **67 centralized + 1 RBAC + 80 inline + 25 public = 173**


## (a) Schéma Prisma complet

**Source** : `prisma/schema.prisma` — extrait par `scripts/extract-schema.mjs`
**Provider** : PostgreSQL (extensions : pgvector)
**Statistiques** : 64 modèles, 44 enums

> Chaque champ ci-dessous est la déclaration Prisma VERBATIM. Aucune sélection, aucune paraphrase.

## Enums (44)

### enum UserRole

| Valeur | Commentaire |
|--------|-------------|
| `ADMIN` |  |
| `ASSISTANTE` |  |
| `COACH` |  |
| `PARENT` |  |
| `ELEVE` |  |

### enum SubscriptionStatus

| Valeur | Commentaire |
|--------|-------------|
| `ACTIVE` |  |
| `INACTIVE` |  |
| `CANCELLED` |  |
| `EXPIRED` |  |

### enum ServiceType

| Valeur | Commentaire |
|--------|-------------|
| `COURS_ONLINE` |  |
| `COURS_PRESENTIEL` |  |
| `ATELIER_GROUPE` |  |

### enum Subject

| Valeur | Commentaire |
|--------|-------------|
| `MATHEMATIQUES` |  |
| `NSI` |  |
| `FRANCAIS` |  |
| `PHILOSOPHIE` |  |
| `HISTOIRE_GEO` |  |
| `ANGLAIS` |  |
| `ESPAGNOL` |  |
| `PHYSIQUE_CHIMIE` |  |
| `SVT` |  |
| `SES` |  |

### enum GradeLevel

| Valeur | Commentaire |
|--------|-------------|
| `TROISIEME` |  |
| `SECONDE` |  |
| `PREMIERE` |  |
| `TERMINALE` |  |
| `POSTBAC` |  |
| `AUTRE` |  |

### enum AcademicTrack

| Valeur | Commentaire |
|--------|-------------|
| `COLLEGE` |  |
| `EDS_GENERALE` |  |
| `STMG` |  |
| `STI2D` |  |
| `ST2S` |  |
| `STL` |  |
| `STD2A` |  |
| `STMG_NON_LYCEEN` |  |

### enum StmgPathway

| Valeur | Commentaire |
|--------|-------------|
| `RHC` |  |
| `MERCATIQUE` |  |
| `GF` |  |
| `SIG` |  |
| `INDETERMINE` |  |

### enum AssignmentType

| Valeur | Commentaire |
|--------|-------------|
| `PRIMARY` | Coach référent principal |
| `SECONDARY` | Spécialiste (maths, français...) |
| `STAGE` | Assignation stage uniquement |
| `TEMPORARY` | Remplacement temporaire |

### enum AssignmentStatus

| Valeur | Commentaire |
|--------|-------------|
| `ACTIVE` |  |
| `SUSPENDED` |  |
| `ENDED` |  |

### enum DocumentType

| Valeur | Commentaire |
|--------|-------------|
| `COURS` |  |
| `EXERCICE` |  |
| `BILAN` |  |
| `CORRECTION` |  |
| `PLANNING` |  |
| `ANNEXE` |  |
| `AUTRE` |  |

### enum DocumentVisibilityScope

| Valeur | Commentaire |
|--------|-------------|
| `STUDENT_ONLY` |  |
| `STUDENT_AND_PARENT` |  |
| `STUDENT_AND_COACH` |  |
| `STUDENT_PARENT_COACH` |  |
| `ADMIN_ONLY` |  |

### enum SessionStatus

| Valeur | Commentaire |
|--------|-------------|
| `SCHEDULED` |  |
| `CONFIRMED` |  |
| `IN_PROGRESS` |  |
| `COMPLETED` |  |
| `CANCELLED` |  |
| `NO_SHOW` |  |
| `RESCHEDULED` |  |

### enum PaymentType

| Valeur | Commentaire |
|--------|-------------|
| `SUBSCRIPTION` |  |
| `CREDIT_PACK` |  |
| `SPECIAL_PACK` |  |

### enum PaymentStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `COMPLETED` |  |
| `FAILED` |  |
| `REFUNDED` |  |

### enum ContactLeadStatus

| Valeur | Commentaire |
|--------|-------------|
| `NEW` |  |
| `CONTACTED` |  |
| `QUALIFIED` |  |
| `ENROLLED` |  |
| `LOST` |  |

### enum SessionType

| Valeur | Commentaire |
|--------|-------------|
| `INDIVIDUAL` |  |
| `GROUP` |  |
| `MASTERCLASS` |  |

### enum SessionModality

| Valeur | Commentaire |
|--------|-------------|
| `ONLINE` |  |
| `IN_PERSON` |  |
| `HYBRID` |  |

### enum NotificationType

| Valeur | Commentaire |
|--------|-------------|
| `SESSION_BOOKED` |  |
| `SESSION_CONFIRMED` |  |
| `SESSION_REMINDER` |  |
| `SESSION_CANCELLED` |  |
| `SESSION_RESCHEDULED` |  |
| `SESSION_COMPLETED` |  |
| `COACH_ASSIGNED` |  |
| `PAYMENT_REQUIRED` |  |

### enum CronExecutionStatus

| Valeur | Commentaire |
|--------|-------------|
| `RUNNING` |  |
| `COMPLETED` |  |
| `FAILED` |  |

### enum NotificationStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `SENT` |  |
| `DELIVERED` |  |
| `READ` |  |
| `FAILED` |  |

### enum NotificationMethod

| Valeur | Commentaire |
|--------|-------------|
| `EMAIL` |  |
| `SMS` |  |
| `IN_APP` |  |
| `PUSH` |  |

### enum ReminderType

| Valeur | Commentaire |
|--------|-------------|
| `ONE_DAY_BEFORE` |  |
| `TWO_HOURS_BEFORE` |  |
| `THIRTY_MINUTES_BEFORE` |  |
| `SESSION_STARTING` |  |

### enum EngagementLevel

| Valeur | Commentaire |
|--------|-------------|
| `LOW` |  |
| `MEDIUM` |  |
| `HIGH` |  |

### enum StageType

| Valeur | Commentaire |
|--------|-------------|
| `INTENSIF` |  |
| `SEMAINE_BLANCHE` |  |
| `BILAN` |  |
| `GRAND_ORAL` |  |
| `BAC_FRANCAIS` |  |

### enum StageReservationStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `CONFIRMED` |  |
| `WAITLISTED` |  |
| `CANCELLED` |  |
| `COMPLETED` |  |

### enum AssessmentStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `SCORING` |  |
| `GENERATING` |  |
| `COMPLETED` |  |
| `FAILED` |  |

### enum BilanType

| Valeur | Commentaire |
|--------|-------------|
| `DIAGNOSTIC_PRE_STAGE` | Legacy Diagnostic (Pallier 2, formulaire compétences) |
| `ASSESSMENT_QCM` | Legacy Assessment (QCM universel multi-matière) |
| `STAGE_POST` | Legacy StageBilan (rapport coach fin de stage) |
| `CONTINUOUS` | Maths 1ère BilanView (progression temps réel) |

### enum BilanStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `SCORING` |  |
| `GENERATING` |  |
| `COMPLETED` |  |
| `FAILED` |  |

### enum InvoiceStatus

| Valeur | Commentaire |
|--------|-------------|
| `DRAFT` |  |
| `SENT` |  |
| `PAID` |  |
| `CANCELLED` |  |

### enum InvoicePaymentMethod

| Valeur | Commentaire |
|--------|-------------|
| `CASH` |  |
| `BANK_TRANSFER` |  |
| `CHEQUE` |  |
| `CARD` |  |
| `CLICTOPAY` |  |

### enum EntitlementStatus

| Valeur | Commentaire |
|--------|-------------|
| `ACTIVE` |  |
| `SUSPENDED` |  |
| `EXPIRED` |  |
| `REVOKED` |  |

### enum TrajectoryStatus

| Valeur | Commentaire |
|--------|-------------|
| `ACTIVE` |  |
| `PAUSED` |  |
| `COMPLETED` |  |
| `ABANDONED` |  |

### enum MathsLevel

| Valeur | Commentaire |
|--------|-------------|
| `PREMIERE` |  |
| `TERMINALE` |  |

### enum CopySubmissionStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING_UPLOAD` |  |
| `UPLOADED` |  |
| `PROCESSING_OCR` |  |
| `OCR_FAILED` |  |
| `READY_FOR_AI` |  |
| `QUEUED_FOR_ANALYSIS` |  |
| `ANALYZING` |  |
| `ANALYSIS_FAILED` |  |
| `COMPLETED` |  |
| `ARCHIVED` |  |

### enum AssessmentSourceType

| Valeur | Commentaire |
|--------|-------------|
| `DS` | Devoir surveillé |
| `DM` | Devoir maison |
| `BILAN` | Bilan périodique |
| `STAGE` | Stage intensif |
| `ANNALES` | Annales |
| `EXERCICE` | Exercice |
| `COMPOSITION` | Composition |
| `AUTRE` | Autre type |

### enum CopyPageStatus

| Valeur | Commentaire |
|--------|-------------|
| `UPLOADED` |  |
| `PENDING_CONVERSION` |  |
| `CONVERTING` |  |
| `CONVERSION_FAILED` |  |
| `READY` |  |
| `PROCESSING` |  |
| `ERROR` |  |

### enum CorrectionDocumentType

| Valeur | Commentaire |
|--------|-------------|
| `STUDENT_COPY` |  |
| `SUBJECT` |  |
| `OFFICIAL_CORRECTION` |  |
| `GRADING_RUBRIC` |  |
| `GRADING_INSTRUCTIONS` |  |
| `SUPPORTING_DOCUMENT` |  |

### enum AiJobType

| Valeur | Commentaire |
|--------|-------------|
| `VISION_OCR` | Extraction texte/image |
| `PEDAGOGICAL_DIAGNOSIS` | Analyse pédagogique |
| `COMPETENCE_MATRIX` | Matrice de compétences |
| `REMEDIATION_ROADMAP` | Plan de remédiation |
| `MENTOR_ADVICE` | Conseils mentor |

### enum AiJobStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `QUEUED` |  |
| `CLAIMED` |  |
| `PROCESSING` |  |
| `RETRYING` |  |
| `COMPLETED` |  |
| `FAILED` |  |
| `CANCELLED` |  |

### enum AiJobPriority

| Valeur | Commentaire |
|--------|-------------|
| `LOW` |  |
| `NORMAL` |  |
| `HIGH` |  |
| `URGENT` |  |

### enum PedagogicalReportStatus

| Valeur | Commentaire |
|--------|-------------|
| `DRAFT` |  |
| `PENDING_VALIDATION` |  |
| `VALIDATED` |  |
| `SENT_TO_STUDENT` |  |
| `READ_BY_STUDENT` |  |
| `ARCHIVED` |  |

### enum ReportVisibility

| Valeur | Commentaire |
|--------|-------------|
| `COACH_ONLY` |  |
| `COACH_AND_STUDENT` |  |
| `STUDENT_SUMMARY_ONLY` |  |

### enum FeedbackType

| Valeur | Commentaire |
|--------|-------------|
| `TECHNICAL_ERROR` |  |
| `PEDAGOGICAL_INACCURACY` |  |
| `MISSING_REMEDIATION` |  |
| `OVERLY_GENERIC` |  |
| `STUDENT_MISUNDERSTOOD` |  |
| `COACH_DISAGREES` |  |
| `POSITIVE` |  |
| `OTHER` |  |

### enum GeneratedReportStatus

| Valeur | Commentaire |
|--------|-------------|
| `PENDING` |  |
| `BUILDING_CONTEXT` |  |
| `LLM_GENERATING` |  |
| `LLM_VALIDATED` |  |
| `LATEX_RENDERING` |  |
| `PDF_READY` |  |
| `FAILED` |  |
| `NEEDS_REVIEW` |  |

## Modèles (64)

### model User

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `email` | `email     String   @unique` |
| `password` | `password  String?` |
| `role` | `role      UserRole` |
| `firstName` | `firstName String?` |
| `lastName` | `lastName  String?` |
| `phone` | `phone     String?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `activatedAt` | `activatedAt      DateTime? // null = compte non activé (élève en attente)` |
| `activationToken` | `activationToken  String? // token hashé pour activation par email` |
| `activationExpiry` | `activationExpiry DateTime? // expiration du token d'activation` |
| `parentProfile` | `parentProfile ParentProfile?` |
| `student` | `student       Student?` |
| `coachProfile` | `coachProfile  CoachProfile?` |
| `sentMessages` | `sentMessages     Message[] @relation("MessageSender")` |
| `receivedMessages` | `receivedMessages Message[] @relation("MessageReceiver")` |
| `payments` | `payments         Payment[]` |
| `documents` | `documents         UserDocument[] @relation("UserDocuments")` |
| `uploadedDocuments` | `uploadedDocuments UserDocument[] @relation("DocumentUploader")` |
| `coachAvailabilities` | `coachAvailabilities CoachAvailability[] @relation("CoachAvailability")` |
| `coachSessions` | `coachSessions       SessionBooking[]    @relation("CoachSessions")` |
| `studentSessions` | `studentSessions SessionBooking[] @relation("StudentSessions")` |
| `parentSessions` | `parentSessions SessionBooking[] @relation("ParentSessions")` |
| `notifications` | `notifications SessionNotification[] @relation("UserNotifications")` |
| `entitlements` | `entitlements Entitlement[]` |
| `eamProgress` | `eamProgress EamProgress?` |
| `clicToPayTransactions` | `clicToPayTransactions ClicToPayTransaction[]` |
| `stageDocumentsUploaded` | `stageDocumentsUploaded StageDocument[] @relation("StageDocumentUploader")` |
| `mathsProgress` | `mathsProgress MathsProgress[]` |
| `nsiPracticeProgress` | `nsiPracticeProgress NsiPracticeProgress?` |
| `coachNotesAuthored` | `coachNotesAuthored CoachNote[] @relation("CoachNoteAuthor")` |
| `coachNotesAbout` | `coachNotesAbout    CoachNote[] @relation("CoachNoteSubject")` |
| `coachStudentAssignmentsCreated` | `coachStudentAssignmentsCreated CoachStudentAssignment[] @relation("CoachStudentAssignmentAssignedBy")` |
| `totpSecret` | `totpSecret      String?   // AES-256-GCM encrypted, format: v1:iv:tag:ciphertext` |
| `totpEnabledAt` | `totpEnabledAt   DateTime? // non-null = 2FA active (canonical check)` |
| `totpBackupCodes` | `totpBackupCodes String?   // JSON array of hashed backup codes` |
| `totpLastUsedAt` | `totpLastUsedAt  DateTime? // last successful TOTP verification` |

**Attributs modèle :**
- `@@index([role])`
- `@@map("users")`

### model ParentProfile

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id     String @id @default(cuid())` |
| `userId` | `userId String @unique` |
| `user` | `user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `address` | `address String?` |
| `city` | `city    String?` |
| `country` | `country String? @default("Tunisie")` |
| `bilanGratuitCompletedAt` | `bilanGratuitCompletedAt DateTime?` |
| `bilanGratuitDismissedAt` | `bilanGratuitDismissedAt DateTime?` |
| `children` | `children Student[]` |

**Attributs modèle :**
- `@@map("parent_profiles")`

### model Student

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id       String        @id @default(cuid())` |
| `parentId` | `parentId String` |
| `parent` | `parent   ParentProfile @relation(fields: [parentId], references: [id], onDelete: Cascade)` |
| `userId` | `userId String @unique` |
| `user` | `user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `grade` | `grade          String? // Classe legacy, conservée pour compatibilité` |
| `gradeLevel` | `gradeLevel     GradeLevel` |
| `academicTrack` | `academicTrack  AcademicTrack @default(EDS_GENERALE)` |
| `specialties` | `specialties    Subject[]     @default([])` |
| `stmgPathway` | `stmgPathway    StmgPathway?` |
| `updatedTrackAt` | `updatedTrackAt DateTime?` |
| `survivalMode` | `survivalMode       Boolean   @default(false)` |
| `survivalModeReason` | `survivalModeReason String?` |
| `survivalModeBy` | `survivalModeBy     String?` |
| `survivalModeAt` | `survivalModeAt     DateTime?` |
| `school` | `school         String?` |
| `birthDate` | `birthDate      DateTime?` |
| `credits` | `credits           Int @default(0)` |
| `totalSessions` | `totalSessions     Int @default(0)` |
| `completedSessions` | `completedSessions Int @default(0)` |
| `subscriptions` | `subscriptions        Subscription[]` |
| `creditTransactions` | `creditTransactions   CreditTransaction[]` |
| `sessions` | `sessions             Session[]` |
| `ariaConversations` | `ariaConversations    AriaConversation[]` |
| `badges` | `badges               StudentBadge[]` |
| `reports` | `reports              StudentReport[]` |
| `subscriptionRequests` | `subscriptionRequests SubscriptionRequest[]` |
| `sessionReports` | `sessionReports       SessionReport[]` |
| `trajectories` | `trajectories         Trajectory[]` |
| `survivalProgress` | `survivalProgress     SurvivalProgress?` |
| `assessments` | `assessments        Assessment[] // Linked assessments (optional FK from Assessment)` |
| `progressionHistory` | `progressionHistory ProgressionHistory[] // SSN history over time` |
| `projectionHistory` | `projectionHistory  ProjectionHistory[] // ML predictions history` |
| `stageReservations` | `stageReservations StageReservation[] @relation("StudentStageReservations")` |
| `stageBilans` | `stageBilans       StageBilan[]       @relation("StudentStageBilans")` |
| `bilans` | `bilans Bilan[]` |
| `coachAssignments` | `coachAssignments CoachStudentAssignment[]` |
| `eafPreparationReports` | `eafPreparationReports EafPreparationReport[]` |
| `copySubmissions` | `copySubmissions    CopySubmission[]` |
| `pedagogicalReports` | `pedagogicalReports PedagogicalReport[]` |
| `generatedReports` | `generatedReports GeneratedPedagogicalReport[]` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@map("students")`

### model CoachProfile

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id     String @id @default(cuid())` |
| `userId` | `userId String @unique` |
| `user` | `user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `title` | `title       String? // Agrégé, Certifié, etc.` |
| `pseudonym` | `pseudonym   String  @unique // Hélios, Zénon, etc.` |
| `tag` | `tag         String? // 🎓 Agrégé, 🎯 Stratège, etc.` |
| `description` | `description String?` |
| `philosophy` | `philosophy  String?` |
| `expertise` | `expertise   String?` |
| `subjects` | `subjects Json @default("[]") // Array des subjects enseignés` |
| `availableOnline` | `availableOnline   Boolean @default(true)` |
| `availableInPerson` | `availableInPerson Boolean @default(true)` |
| `sessions` | `sessions       Session[]` |
| `reports` | `reports        StudentReport[]` |
| `sessionReports` | `sessionReports SessionReport[]` |
| `stageSessions` | `stageSessions    StageSession[] @relation("CoachStageSessions")` |
| `stageBilans` | `stageBilans      StageBilan[]   @relation("CoachStageBilans")` |
| `stageAssignments` | `stageAssignments StageCoach[]   @relation("CoachStageAssignments")` |
| `bilans` | `bilans Bilan[]` |
| `studentAssignments` | `studentAssignments CoachStudentAssignment[]` |
| `eafPreparationReports` | `eafPreparationReports EafPreparationReport[]` |
| `coachedSubmissions` | `coachedSubmissions CopySubmission[]` |
| `validatedReports` | `validatedReports   PedagogicalReport[]` |
| `generatedReports` | `generatedReports GeneratedPedagogicalReport[]` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@map("coach_profiles")`

### model Subscription

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `planName` | `planName        String // ACCES_PLATEFORME, HYBRIDE, IMMERSION` |
| `monthlyPrice` | `monthlyPrice    Int // Prix en TND` |
| `creditsPerMonth` | `creditsPerMonth Int // Crédits inclus par mois` |
| `status` | `status    SubscriptionStatus` |
| `startDate` | `startDate DateTime` |
| `endDate` | `endDate   DateTime?` |
| `ariaSubjects` | `ariaSubjects Json @default("[]") // Array des matières ARIA activées` |
| `ariaCost` | `ariaCost     Int  @default(0) // Coût mensuel des add-ons ARIA` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId, status])`
- `@@map("subscriptions")`

### model CreditTransaction

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `type` | `type        String // MONTHLY_ALLOCATION, PURCHASE, USAGE, REFUND, EXPIRATION` |
| `amount` | `amount      Float // Peut être négatif pour les utilisations` |
| `description` | `description String` |
| `sessionId` | `sessionId String? // Si lié à une session` |
| `expiresAt` | `expiresAt DateTime? // Pour les crédits avec expiration` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([studentId, createdAt])`
- `@@index([sessionId])`
- `@@map("credit_transactions")`

### model Session

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull) // Preserve session history even if coach account removed` |
| `type` | `type        ServiceType` |
| `subject` | `subject     Subject` |
| `title` | `title       String` |
| `description` | `description String?` |
| `scheduledAt` | `scheduledAt DateTime` |
| `duration` | `duration    Int // Durée en minutes` |
| `location` | `location    String? // Pour le présentiel ou lien visio` |
| `creditCost` | `creditCost Float` |
| `status` | `status     SessionStatus @default(SCHEDULED)` |
| `report` | `report     String?` |
| `reportedAt` | `reportedAt DateTime?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId])`
- `@@index([coachId])`
- `@@index([status])`
- `@@map("sessions")`

### model AriaConversation

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `subject` | `subject Subject` |
| `title` | `title   String?` |
| `messages` | `messages AriaMessage[]` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId, updatedAt])`
- `@@map("aria_conversations")`

### model AriaMessage

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id             String           @id @default(cuid())` |
| `conversationId` | `conversationId String` |
| `conversation` | `conversation   AriaConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)` |
| `role` | `role    String // "user" ou "assistant"` |
| `content` | `content String` |
| `feedback` | `feedback Boolean? // true = 👍, false = 👎, null = pas de feedback` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([conversationId, createdAt])`
- `@@map("aria_messages")`

### model Badge

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id          String  @id @default(cuid())` |
| `name` | `name        String  @unique` |
| `description` | `description String` |
| `category` | `category    String // ASSIDUITE, PROGRESSION, CURIOSITE` |
| `icon` | `icon        String?` |
| `condition` | `condition   String // Condition d'obtention` |
| `studentBadges` | `studentBadges StudentBadge[]` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@map("badges")`

### model StudentBadge

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `badgeId` | `badgeId String` |
| `badge` | `badge   Badge  @relation(fields: [badgeId], references: [id], onDelete: Cascade) // Changed to Cascade for test compatibility` |
| `earnedAt` | `earnedAt DateTime @default(now())` |

**Attributs modèle :**
- `@@unique([studentId, badgeId])`
- `@@map("student_badges")`

### model StudentReport

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull) // Educational records outlive coach employment` |
| `title` | `title   String` |
| `content` | `content String` |
| `period` | `period  String // "Semaine du X", "Mois de Y", etc.` |
| `sessionsCount` | `sessionsCount   Int     @default(0)` |
| `averageGrade` | `averageGrade    Float?` |
| `progressNotes` | `progressNotes   String?` |
| `recommendations` | `recommendations String?` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@map("student_reports")`

### model Payment

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id     String  @id @default(cuid())` |
| `userId` | `userId String? // Optional to allow keeping payment record if user is deleted` |
| `user` | `user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull) // Preserve history` |
| `type` | `type        PaymentType` |
| `amount` | `amount      Float` |
| `currency` | `currency    String      @default("TND")` |
| `description` | `description String` |
| `status` | `status PaymentStatus @default(PENDING)` |
| `method` | `method String? // "clictopay", "bank_transfer", "cash", "check"` |
| `externalId` | `externalId String? // ID de transaction externe` |
| `metadata` | `metadata   Json? // Données supplémentaires` |
| `termsVersion` | `termsVersion       String? // ex: "CGV v1.0 – 2026-03-01"` |
| `termsAcceptedAt` | `termsAcceptedAt    DateTime? // timestamp de l'acceptation` |
| `termsAcceptedIp` | `termsAcceptedIp    String? // IP du client au moment de l'acceptation` |
| `immediateExecution` | `immediateExecution Boolean   @default(false) // renonciation rétractation accès immédiat` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `clicToPayTransaction` | `clicToPayTransaction ClicToPayTransaction?` |

**Attributs modèle :**
- `@@unique([externalId, method], name: "payments_externalId_method_key")`
- `@@map("payments")`

### model ClicToPayTransaction

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String   @id @default(cuid())` |
| `orderId` | `orderId       String   @unique // Identifiant unique envoyé à ClicToPay` |
| `amount` | `amount        Float` |
| `currency` | `currency      String   @default("TND")` |
| `status` | `status        String   @default("PENDING") // PENDING, SUCCESS, FAILED` |
| `bankReference` | `bankReference String? // Numéro d'autorisation renvoyé par la banque` |
| `paymentId` | `paymentId     String?  @unique` |
| `payment` | `payment       Payment? @relation(fields: [paymentId], references: [id], onDelete: SetNull)` |
| `userId` | `userId        String` |
| `user` | `user          User     @relation(fields: [userId], references: [id])` |
| `createdAt` | `createdAt     DateTime @default(now())` |
| `updatedAt` | `updatedAt     DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([userId])`
- `@@map("clictopay_transactions")`

### model Message

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id       String  @id @default(cuid())` |
| `senderId` | `senderId String?` |
| `sender` | `sender   User?   @relation("MessageSender", fields: [senderId], references: [id], onDelete: SetNull) // Preserve communication history while anonymizing deleted users` |
| `receiverId` | `receiverId String?` |
| `receiver` | `receiver   User?   @relation("MessageReceiver", fields: [receiverId], references: [id], onDelete: SetNull) // Preserve communication history while anonymizing deleted users` |
| `content` | `content  String` |
| `fileUrl` | `fileUrl  String? // Pour les pièces jointes` |
| `fileName` | `fileName String?` |
| `readAt` | `readAt DateTime?` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@map("messages")`

### model PedagogicalContent

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id      String  @id @default(cuid())` |
| `title` | `title   String` |
| `content` | `content String` |
| `subject` | `subject Subject` |
| `grade` | `grade   String? // Niveau scolaire` |
| `embedding_vector` | `embedding_vector Unsupported("vector")? // pgvector support (1536 dimensions)` |
| `tags` | `tags             Json                   @default("[]") // Tags de catégorisation` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@map("pedagogical_contents")`

### model SubscriptionRequest

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id               String    @id @default(cuid())` |
| `studentId` | `studentId        String` |
| `requestType` | `requestType      String // PLAN_CHANGE, ARIA_ADDON, INVOICE_DETAILS` |
| `planName` | `planName         String?` |
| `monthlyPrice` | `monthlyPrice     Float` |
| `reason` | `reason           String?` |
| `status` | `status           String // PENDING, APPROVED, REJECTED` |
| `requestedBy` | `requestedBy      String` |
| `requestedByEmail` | `requestedByEmail String` |
| `processedBy` | `processedBy      String?` |
| `processedAt` | `processedAt      DateTime?` |
| `rejectionReason` | `rejectionReason  String?` |
| `createdAt` | `createdAt        DateTime  @default(now())` |
| `updatedAt` | `updatedAt        DateTime  @updatedAt` |
| `student` | `student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |

**Attributs modèle :**
- `@@map("subscription_requests")`

### model Notification

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `userId` | `userId    String // ID de l'utilisateur qui reçoit la notification` |
| `userRole` | `userRole  UserRole // Rôle de l'utilisateur (ASSISTANTE, ADMIN, etc.)` |
| `type` | `type      String // SUBSCRIPTION_REQUEST, CREDIT_REQUEST, etc.` |
| `title` | `title     String` |
| `message` | `message   String` |
| `data` | `data      Json // Données supplémentaires structurées` |
| `read` | `read      Boolean  @default(false)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([userId, read])`
- `@@index([userRole])`
- `@@map("notifications")`

### model CoachAvailability

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id      String @id @default(cuid())` |
| `coachId` | `coachId String` |
| `coach` | `coach   User   @relation("CoachAvailability", fields: [coachId], references: [id], onDelete: Cascade)` |
| `dayOfWeek` | `dayOfWeek Int` |
| `startTime` | `startTime String // "09:00"` |
| `endTime` | `endTime   String // "17:00"` |
| `specificDate` | `specificDate DateTime?` |
| `isAvailable` | `isAvailable  Boolean   @default(true)` |
| `isRecurring` | `isRecurring Boolean   @default(true)` |
| `validFrom` | `validFrom   DateTime  @default(now())` |
| `validUntil` | `validUntil  DateTime?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([coachId, dayOfWeek, startTime, endTime, specificDate])`
- `@@index([coachId, dayOfWeek])`
- `@@index([coachId, specificDate])`

### model SessionBooking

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id String @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   User    @relation("StudentSessions", fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId   String` |
| `coach` | `coach     User    @relation("CoachSessions", fields: [coachId], references: [id], onDelete: Cascade)` |
| `parentId` | `parentId  String?` |
| `parent` | `parent    User?   @relation("ParentSessions", fields: [parentId], references: [id], onDelete: SetNull)` |
| `subject` | `subject     Subject` |
| `title` | `title       String` |
| `description` | `description String?` |
| `scheduledDate` | `scheduledDate DateTime` |
| `startTime` | `startTime     String // "14:00"` |
| `endTime` | `endTime       String // "15:00"` |
| `duration` | `duration      Int // Duration in minutes` |
| `status` | `status SessionStatus @default(SCHEDULED)` |
| `type` | `type     SessionType     @default(INDIVIDUAL)` |
| `modality` | `modality SessionModality @default(ONLINE)` |
| `meetingUrl` | `meetingUrl String?` |
| `meetingId` | `meetingId  String?` |
| `location` | `location   String?` |
| `creditsUsed` | `creditsUsed Int @default(1)` |
| `coachNotes` | `coachNotes   String?` |
| `studentNotes` | `studentNotes String?` |
| `rating` | `rating       Int? // 1-5 stars` |
| `feedback` | `feedback     String?` |
| `studentAttended` | `studentAttended Boolean?` |
| `coachAttended` | `coachAttended   Boolean  @default(true)` |
| `createdAt` | `createdAt   DateTime  @default(now())` |
| `updatedAt` | `updatedAt   DateTime  @updatedAt` |
| `completedAt` | `completedAt DateTime?` |
| `cancelledAt` | `cancelledAt DateTime?` |
| `reminderSent` | `reminderSent Boolean @default(false)` |
| `notifications` | `notifications SessionNotification[]` |
| `reminders` | `reminders     SessionReminder[]` |
| `report` | `report        SessionReport?` |

**Attributs modèle :**
- `@@index([studentId, scheduledDate])`
- `@@index([coachId, scheduledDate])`
- `@@index([status, scheduledDate])`
- `@@index([scheduledDate])`

### model SessionReport

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String         @id @default(cuid())` |
| `sessionId` | `sessionId String         @unique` |
| `session` | `session   SessionBooking @relation(fields: [sessionId], references: [id], onDelete: Cascade)` |
| `studentId` | `studentId String` |
| `student` | `student   Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId   String` |
| `coach` | `coach     CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)` |
| `summary` | `summary           String // General session summary` |
| `topicsCovered` | `topicsCovered     String // Topics covered during the session` |
| `performanceRating` | `performanceRating Int // 1-5 stars` |
| `progressNotes` | `progressNotes     String // Student progress observations` |
| `recommendations` | `recommendations   String // Recommendations for next sessions` |
| `attendance` | `attendance      Boolean // Student attended` |
| `engagementLevel` | `engagementLevel EngagementLevel? // LOW, MEDIUM, HIGH` |
| `homeworkAssigned` | `homeworkAssigned String? // Homework assigned (optional)` |
| `nextSessionFocus` | `nextSessionFocus String? // Suggested focus for next session (optional)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId, createdAt])`
- `@@index([coachId, createdAt])`
- `@@map("session_reports")`

### model SessionNotification

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String         @id @default(cuid())` |
| `sessionId` | `sessionId String` |
| `session` | `session   SessionBooking @relation(fields: [sessionId], references: [id], onDelete: Cascade)` |
| `userId` | `userId String` |
| `user` | `user   User   @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)` |
| `type` | `type    NotificationType` |
| `title` | `title   String` |
| `message` | `message String` |
| `status` | `status NotificationStatus @default(PENDING)` |
| `sentAt` | `sentAt DateTime?` |
| `readAt` | `readAt DateTime?` |
| `method` | `method NotificationMethod @default(EMAIL)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([sessionId, userId, type, method])`
- `@@index([userId, status])`
- `@@index([sessionId])`

### model SessionReminder

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String         @id @default(cuid())` |
| `sessionId` | `sessionId String` |
| `session` | `session   SessionBooking @relation(fields: [sessionId], references: [id], onDelete: Cascade)` |
| `reminderType` | `reminderType ReminderType` |
| `scheduledFor` | `scheduledFor DateTime` |
| `sent` | `sent   Boolean   @default(false)` |
| `sentAt` | `sentAt DateTime?` |
| `reminderSent` | `reminderSent Boolean @default(false)` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@unique([sessionId, reminderType])`
- `@@index([scheduledFor, sent])`
- `@@index([sessionId])`

### model CronExecution

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id           String              @id @default(cuid())` |
| `jobName` | `jobName      String // e.g., "monthly-allocation", "credit-expiration"` |
| `executionKey` | `executionKey String // e.g., "2026-02" for monthly jobs, or timestamp for others` |
| `status` | `status       CronExecutionStatus` |
| `startedAt` | `startedAt    DateTime            @default(now())` |
| `completedAt` | `completedAt  DateTime?` |
| `error` | `error        String?` |
| `metadata` | `metadata     Json?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([jobName, executionKey], name: "cron_executions_job_key")`
- `@@index([status])`
- `@@index([startedAt])`
- `@@map("cron_executions")`

### model Diagnostic

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String @id @default(cuid())` |
| `publicShareId` | `publicShareId String @unique @default(cuid()) // Secure public access token (non-guessable)` |
| `type` | `type String // "PALLIER2_MATHS", "DIAGNOSTIC_PRE_STAGE_MATHS", etc.` |
| `definitionKey` | `definitionKey     String? // e.g. "maths-premiere-p2", "nsi-terminale-p2"` |
| `definitionVersion` | `definitionVersion String? // e.g. "v1.3"` |
| `promptVersion` | `promptVersion     String? // e.g. "v1.0" — tracks prompt template version` |
| `modelUsed` | `modelUsed         String? // e.g. "llama3.2:latest" — LLM model used for generation` |
| `ragUsed` | `ragUsed           Boolean  @default(false) // Whether RAG context was available` |
| `ragCollections` | `ragCollections    String[] // Collections used for RAG search` |
| `studentFirstName` | `studentFirstName String` |
| `studentLastName` | `studentLastName  String` |
| `studentEmail` | `studentEmail     String` |
| `studentPhone` | `studentPhone     String?` |
| `establishment` | `establishment    String?` |
| `teacherName` | `teacherName      String?` |
| `mathAverage` | `mathAverage      String?` |
| `specialtyAverage` | `specialtyAverage String?` |
| `bacBlancResult` | `bacBlancResult   String?` |
| `classRanking` | `classRanking     String?` |
| `data` | `data Json?` |
| `status` | `status String @default("RECEIVED")` |
| `analysisResult` | `analysisResult String? // JSON string with {eleve, parents, nexus, generatedAt}` |
| `actionPlan` | `actionPlan     String? // Plan d'action personnalisé (legacy)` |
| `analysisJson` | `analysisJson    Json? // Structured JSON: forces, faiblesses, plan, ressources, qualityFlags` |
| `studentMarkdown` | `studentMarkdown String? // Rendered bilan for student audience` |
| `parentsMarkdown` | `parentsMarkdown String? // Rendered bilan for parents audience` |
| `nexusMarkdown` | `nexusMarkdown   String? // Rendered bilan for Nexus team audience` |
| `errorCode` | `errorCode    String? // e.g. "OLLAMA_TIMEOUT", "RAG_UNAVAILABLE", "VALIDATION_ERROR"` |
| `errorDetails` | `errorDetails String? // Detailed error message (not exposed publicly)` |
| `retryCount` | `retryCount   Int     @default(0)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([type, status])`
- `@@index([studentEmail])`
- `@@index([publicShareId])`
- `@@index([definitionKey, status])`
- `@@map("diagnostics")`

### model Stage

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String    @id @default(cuid())` |
| `slug` | `slug          String    @unique` |
| `title` | `title         String` |
| `subtitle` | `subtitle      String?` |
| `description` | `description   String?   @db.Text` |
| `type` | `type          StageType @default(INTENSIF)` |
| `subject` | `subject       Subject[]` |
| `level` | `level         String[]` |
| `startDate` | `startDate     DateTime` |
| `endDate` | `endDate       DateTime` |
| `capacity` | `capacity      Int       @default(12)` |
| `priceAmount` | `priceAmount   Decimal   @db.Decimal(10, 2)` |
| `priceCurrency` | `priceCurrency String    @default("TND")` |
| `location` | `location      String?` |
| `isVisible` | `isVisible     Boolean   @default(true)` |
| `isOpen` | `isOpen        Boolean   @default(true)` |
| `createdAt` | `createdAt     DateTime  @default(now())` |
| `updatedAt` | `updatedAt     DateTime  @updatedAt` |
| `reservations` | `reservations StageReservation[] @relation("StageReservations")` |
| `sessions` | `sessions     StageSession[]` |
| `documents` | `documents    StageDocument[]` |
| `bilans` | `bilans       StageBilan[]` |
| `coaches` | `coaches      StageCoach[]` |
| `canonicalBilans` | `canonicalBilans Bilan[]` |

**Attributs modèle :**
- `@@index([slug])`
- `@@index([startDate])`
- `@@map("stages")`

### model StageSession

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id          String        @id @default(cuid())` |
| `stageId` | `stageId     String` |
| `stage` | `stage       Stage         @relation(fields: [stageId], references: [id], onDelete: Cascade)` |
| `title` | `title       String` |
| `subject` | `subject     Subject` |
| `startAt` | `startAt     DateTime` |
| `endAt` | `endAt       DateTime` |
| `location` | `location    String?` |
| `coachId` | `coachId     String?` |
| `coach` | `coach       CoachProfile? @relation("CoachStageSessions", fields: [coachId], references: [id], onDelete: SetNull)` |
| `description` | `description String?       @db.Text` |
| `createdAt` | `createdAt   DateTime      @default(now())` |
| `updatedAt` | `updatedAt   DateTime      @updatedAt` |
| `documents` | `documents StageDocument[]` |

**Attributs modèle :**
- `@@index([stageId])`
- `@@index([startAt])`
- `@@map("stage_sessions")`

### model StageCoach

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String       @id @default(cuid())` |
| `stageId` | `stageId   String` |
| `stage` | `stage     Stage        @relation(fields: [stageId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId   String` |
| `coach` | `coach     CoachProfile @relation("CoachStageAssignments", fields: [coachId], references: [id], onDelete: Cascade)` |
| `role` | `role      String?` |
| `createdAt` | `createdAt DateTime     @default(now())` |

**Attributs modèle :**
- `@@unique([stageId, coachId])`
- `@@map("stage_coaches")`

### model StageDocument

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id             String        @id @default(cuid())` |
| `stageId` | `stageId        String` |
| `stage` | `stage          Stage         @relation(fields: [stageId], references: [id], onDelete: Cascade)` |
| `stageSessionId` | `stageSessionId String?` |
| `stageSession` | `stageSession   StageSession? @relation(fields: [stageSessionId], references: [id], onDelete: SetNull)` |
| `uploadedById` | `uploadedById   String` |
| `uploadedBy` | `uploadedBy     User          @relation("StageDocumentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)` |
| `title` | `title          String` |
| `description` | `description    String?` |
| `fileUrl` | `fileUrl        String` |
| `fileType` | `fileType       String` |
| `fileSize` | `fileSize       Int?` |
| `isPublic` | `isPublic       Boolean       @default(false)` |
| `createdAt` | `createdAt      DateTime      @default(now())` |

**Attributs modèle :**
- `@@index([stageId])`
- `@@index([stageSessionId])`
- `@@map("stage_documents")`

### model StageBilan

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id             String       @id @default(cuid())` |
| `stageId` | `stageId        String` |
| `stage` | `stage          Stage        @relation(fields: [stageId], references: [id], onDelete: Cascade)` |
| `studentId` | `studentId      String` |
| `student` | `student        Student      @relation("StudentStageBilans", fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId        String` |
| `coach` | `coach          CoachProfile @relation("CoachStageBilans", fields: [coachId], references: [id], onDelete: Restrict)` |
| `contentEleve` | `contentEleve   String       @db.Text` |
| `contentParent` | `contentParent  String       @db.Text` |
| `contentInterne` | `contentInterne String?      @db.Text` |
| `scoreGlobal` | `scoreGlobal    Float?` |
| `domainScores` | `domainScores   Json?` |
| `strengths` | `strengths      String[]` |
| `areasForGrowth` | `areasForGrowth String[]` |
| `nextSteps` | `nextSteps      String?      @db.Text` |
| `pdfUrl` | `pdfUrl         String?` |
| `isPublished` | `isPublished    Boolean      @default(false)` |
| `publishedAt` | `publishedAt    DateTime?` |
| `createdAt` | `createdAt      DateTime     @default(now())` |
| `updatedAt` | `updatedAt      DateTime     @updatedAt` |

**Attributs modèle :**
- `@@unique([stageId, studentId])`
- `@@index([stageId])`
- `@@index([studentId])`
- `@@map("stage_bilans")`

### model StageReservation

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String  @id @default(cuid())` |
| `parentName` | `parentName    String` |
| `studentName` | `studentName   String? // Optional: if form distinguishes parent/student` |
| `email` | `email         String` |
| `phone` | `phone         String` |
| `classe` | `classe        String` |
| `academyId` | `academyId     String` |
| `academyTitle` | `academyTitle  String` |
| `price` | `price         Float` |
| `paymentMethod` | `paymentMethod String? // "card" \| "transfer" \| "bank_transfer" \| null` |
| `status` | `status String @default("PENDING") // PENDING, PENDING_BANK_TRANSFER, CONFIRMED, CANCELLED, PAID` |
| `scoringResult` | `scoringResult Json? // { globalScore, confidenceIndex, radarData, strengths, weaknesses }` |
| `telegramSent` | `telegramSent Boolean @default(false)` |
| `stageId` | `stageId                  String?` |
| `stage` | `stage                    Stage?                  @relation("StageReservations", fields: [stageId], references: [id], onDelete: SetNull)` |
| `studentId` | `studentId                String?` |
| `student` | `student                  Student?                @relation("StudentStageReservations", fields: [studentId], references: [id], onDelete: SetNull)` |
| `richStatus` | `richStatus               StageReservationStatus?` |
| `paymentStatus` | `paymentStatus            PaymentStatus?` |
| `paymentRef` | `paymentRef               String?` |
| `notes` | `notes                    String?                 @db.Text` |
| `activationToken` | `activationToken          String?                 @unique` |
| `activationTokenExpiresAt` | `activationTokenExpiresAt DateTime?` |
| `confirmedAt` | `confirmedAt              DateTime?` |
| `cancelledAt` | `cancelledAt              DateTime?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([email, academyId]) // Anti-duplicate: one reservation per email per academy`
- `@@index([status])`
- `@@index([academyId])`
- `@@index([stageId])`
- `@@index([studentId])`
- `@@map("stage_reservations")`

### model ContactLead

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String            @id @default(cuid())` |
| `name` | `name      String` |
| `email` | `email     String` |
| `phone` | `phone     String?` |
| `profile` | `profile   String?` |
| `interest` | `interest  String?` |
| `urgency` | `urgency   String?` |
| `source` | `source    String?` |
| `status` | `status    ContactLeadStatus @default(NEW)` |
| `notes` | `notes     String?           @db.Text` |
| `createdAt` | `createdAt DateTime          @default(now())` |
| `updatedAt` | `updatedAt DateTime          @updatedAt` |

**Attributs modèle :**
- `@@index([email])`
- `@@index([status])`
- `@@index([source])`
- `@@index([createdAt])`
- `@@map("contact_leads")`

### model Assessment

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String @id @default(cuid())` |
| `publicShareId` | `publicShareId String @unique @default(cuid()) // Secure public access token` |
| `subject` | `subject String // MATHS, NSI, etc.` |
| `grade` | `grade   String // PREMIERE, TERMINALE` |
| `studentEmail` | `studentEmail    String` |
| `studentName` | `studentName     String` |
| `studentPhone` | `studentPhone    String?` |
| `studentMetadata` | `studentMetadata Json? // Additional student data` |
| `studentId` | `studentId String?` |
| `student` | `student   Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)` |
| `answers` | `answers     Json // Record<questionId, optionId>` |
| `duration` | `duration    Int? // Duration in milliseconds` |
| `startedAt` | `startedAt   DateTime?` |
| `completedAt` | `completedAt DateTime?` |
| `scoringResult` | `scoringResult   Json? // Full ScoringResult from ScoringFactory (contains all metrics)` |
| `globalScore` | `globalScore     Float? // Raw score (0-100) = (totalPoints / maxPoints) * 100 — denormalized for SQL indexing` |
| `confidenceIndex` | `confidenceIndex Float? // Student self-awareness index (0-100) — denormalized for SQL indexing` |
| `ssn` | `ssn Float? // null until cohort normalization is computed` |
| `uai` | `uai Float?` |
| `analysisJson` | `analysisJson    Json? // Structured analysis (forces, faiblesses, plan)` |
| `studentMarkdown` | `studentMarkdown String? // Rendered bilan for student` |
| `parentsMarkdown` | `parentsMarkdown String? // Rendered bilan for parents` |
| `nexusMarkdown` | `nexusMarkdown   String? // Rendered bilan for Nexus team` |
| `status` | `status   AssessmentStatus @default(PENDING)` |
| `progress` | `progress Int              @default(0) // 0-100` |
| `errorCode` | `errorCode    String?` |
| `errorDetails` | `errorDetails String?` |
| `retryCount` | `retryCount   Int     @default(0)` |
| `assessmentVersion` | `assessmentVersion String? // e.g. "maths_terminale_spe_v1", "general_v1"` |
| `engineVersion` | `engineVersion     String? // e.g. "scorer_v2.1", "generic_v1"` |
| `userAgent` | `userAgent String?` |
| `ipAddress` | `ipAddress String?` |
| `domainScores` | `domainScores DomainScore[]` |
| `skillScores` | `skillScores  SkillScore[]` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([subject, grade])`
- `@@index([studentEmail])`
- `@@index([studentId])`
- `@@index([status])`
- `@@index([ssn])`
- `@@index([createdAt])`
- `@@map("assessments")`

### model Bilan

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id            String @id @default(cuid())` |
| `publicShareId` | `publicShareId String @unique @default(cuid()) // Secure public access token` |
| `type` | `type    BilanType // Canonical type` |
| `subject` | `subject String // MATHS, NSI, GENERAL, etc.` |
| `legacyDiagnosticId` | `legacyDiagnosticId String? @unique // FK to legacy Diagnostic (read-only after migration)` |
| `legacyAssessmentId` | `legacyAssessmentId String? @unique // FK to legacy Assessment (read-only after migration)` |
| `legacyStageBilanId` | `legacyStageBilanId String? @unique // FK to legacy StageBilan (read-only after migration)` |
| `sourceData` | `sourceData Json? // Union type: Diagnostic.data \| Assessment.answers \| StageBilan metadata` |
| `studentId` | `studentId    String?` |
| `student` | `student      Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)` |
| `studentEmail` | `studentEmail String` |
| `studentName` | `studentName  String` |
| `studentPhone` | `studentPhone String?` |
| `stageId` | `stageId String?` |
| `stage` | `stage   Stage?        @relation(fields: [stageId], references: [id], onDelete: SetNull)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull)` |
| `globalScore` | `globalScore     Float? // 0-100` |
| `confidenceIndex` | `confidenceIndex Float? // 0-100 (self-awareness)` |
| `ssn` | `ssn             Float? // Score Standardisé Nexus (z-score 0-100)` |
| `uai` | `uai             Float? // Unified Academic Index (multi-discipline)` |
| `domainScores` | `domainScores    Json? // Array of { domain: string, score: number }` |
| `studentMarkdown` | `studentMarkdown String? @db.Text // Élève: bienveillant, tutoiement` |
| `parentsMarkdown` | `parentsMarkdown String? @db.Text // Parents: professionnel, vouvoiement` |
| `nexusMarkdown` | `nexusMarkdown   String? @db.Text // Nexus: technique, factuel` |
| `analysisJson` | `analysisJson Json? // { forces, faiblesses, plan, ressources, qualityFlags }` |
| `status` | `status      BilanStatus @default(PENDING)` |
| `progress` | `progress    Int         @default(0) // 0-100` |
| `isPublished` | `isPublished Boolean     @default(false)` |
| `publishedAt` | `publishedAt DateTime?` |
| `errorCode` | `errorCode    String? // e.g., "OLLAMA_TIMEOUT", "RAG_UNAVAILABLE"` |
| `errorDetails` | `errorDetails String? @db.Text` |
| `retryCount` | `retryCount   Int     @default(0)` |
| `sourceVersion` | `sourceVersion  String? // e.g., "diagnostic_v1.3", "assessment_v2.1"` |
| `engineVersion` | `engineVersion  String? // e.g., "llm_qwen2.5:32b", "manual_coach"` |
| `ragUsed` | `ragUsed        Boolean  @default(false)` |
| `ragCollections` | `ragCollections String[] // Collections used for RAG context` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([type, status])`
- `@@index([studentId])`
- `@@index([studentEmail])`
- `@@index([stageId])`
- `@@index([publicShareId])`
- `@@index([legacyDiagnosticId])`
- `@@index([legacyAssessmentId])`
- `@@index([createdAt])`
- `@@map("bilans")`

### model DomainScore

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id           String     @id @default(cuid())` |
| `assessmentId` | `assessmentId String` |
| `assessment` | `assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)` |
| `domain` | `domain String // e.g. "analysis", "algebra", "prob_stats", "geometry"` |
| `score` | `score  Float // 0-100` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([assessmentId])`
- `@@index([domain])`
- `@@map("domain_scores")`

### model SkillScore

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id           String     @id @default(cuid())` |
| `assessmentId` | `assessmentId String` |
| `assessment` | `assessment   Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)` |
| `skillTag` | `skillTag String // e.g. "limite_polynome", "suite_arithmetique", "module_complexe"` |
| `score` | `score    Float // 0-100` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([assessmentId])`
- `@@index([skillTag])`
- `@@map("skill_scores")`

### model ProgressionHistory

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `ssn` | `ssn  Float // SSN value at this point in time (0-100)` |
| `date` | `date DateTime @default(now())` |

**Attributs modèle :**
- `@@index([studentId, date])`
- `@@map("progression_history")`

### model ProjectionHistory

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `ssnProjected` | `ssnProjected    Float // Predicted SSN at horizon (0-100)` |
| `confidenceIndex` | `confidenceIndex Float // Prediction confidence (0-100)` |
| `modelVersion` | `modelVersion    String // e.g. "ridge_v1", "ridge_v2"` |
| `inputSnapshot` | `inputSnapshot   Json? // Snapshot of input features used for prediction` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([studentId, createdAt])`
- `@@map("projection_history")`

### model Invoice

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id     String @id @default(cuid())` |
| `number` | `number String @unique // Format: YYYYMM-####` |
| `status` | `status InvoiceStatus @default(DRAFT)` |
| `issuedAt` | `issuedAt DateTime  @default(now())` |
| `dueAt` | `dueAt    DateTime? // Échéance (optionnel)` |
| `customerName` | `customerName    String` |
| `customerEmail` | `customerEmail   String?` |
| `customerAddress` | `customerAddress String? // Max 2 lignes (clamp côté lib)` |
| `customerId` | `customerId      String? // Identifiant fiscal client (si pro)` |
| `issuerName` | `issuerName    String  @default("M&M Academy")` |
| `issuerAddress` | `issuerAddress String  @default("Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie")` |
| `issuerMF` | `issuerMF      String  @default("1XXXXXX/X/A/M/000") // Matricule fiscal` |
| `issuerRNE` | `issuerRNE     String? // Registre national des entreprises` |
| `currency` | `currency      String @default("TND")` |
| `subtotal` | `subtotal      Int    @default(0) // in millimes` |
| `discountTotal` | `discountTotal Int    @default(0) // in millimes` |
| `taxTotal` | `taxTotal      Int    @default(0) // in millimes` |
| `total` | `total         Int    @default(0) // in millimes` |
| `taxRegime` | `taxRegime String @default("TVA_NON_APPLICABLE") // TVA_INCLUSE, TVA_NON_APPLICABLE, EXONERATION` |
| `paymentMethod` | `paymentMethod    InvoicePaymentMethod?` |
| `paymentDetails` | `paymentDetails   Json? // { reference, receivedAt, notes }` |
| `paidAt` | `paidAt           DateTime? // When payment was received` |
| `paidAmount` | `paidAmount       Int? // Amount paid in millimes (should == total)` |
| `paymentReference` | `paymentReference String? // Bank transfer ref, cheque number, etc.` |
| `cancelReason` | `cancelReason String? // Why the invoice was cancelled` |
| `cancelledAt` | `cancelledAt  DateTime? // When it was cancelled` |
| `pdfPath` | `pdfPath String? // Local path or S3 key` |
| `pdfUrl` | `pdfUrl  String? // Public/signed URL` |
| `createdByUserId` | `createdByUserId String` |
| `notes` | `notes           String? // Internal notes (not printed)` |
| `events` | `events          Json    @default("[]") // Array of { type, at, by, details? }` |
| `beneficiaryUserId` | `beneficiaryUserId String?` |
| `items` | `items        InvoiceItem[]` |
| `accessTokens` | `accessTokens InvoiceAccessToken[]` |
| `entitlements` | `entitlements Entitlement[]` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([status])`
- `@@index([customerEmail])`
- `@@index([issuedAt])`
- `@@index([createdByUserId])`
- `@@map("invoices")`

### model InvoiceItem

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `invoiceId` | `invoiceId String` |
| `invoice` | `invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)` |
| `label` | `label       String // e.g. "Stage Intensif Maths — Palier 2"` |
| `description` | `description String? // Optional detail (clamp max 3 lines)` |
| `productCode` | `productCode String? // Entitlement product code (e.g. STAGE_MATHS_P1, PREMIUM_LITE)` |
| `qty` | `qty         Int     @default(1)` |
| `unitPrice` | `unitPrice   Int // in millimes (1 TND = 1000)` |
| `total` | `total       Int // qty × unitPrice, in millimes` |
| `sortOrder` | `sortOrder Int @default(0)` |
| `createdAt` | `createdAt DateTime @default(now())` |

**Attributs modèle :**
- `@@index([invoiceId])`
- `@@map("invoice_items")`

### model InvoiceSequence

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String @id @default(cuid())` |
| `yearMonth` | `yearMonth Int    @unique // e.g. 202602` |
| `current` | `current   Int    @default(0) // Last used number` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@map("invoice_sequences")`

### model Trajectory

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `title` | `title       String // e.g. "Préparer le Bac Maths"` |
| `description` | `description String? // Detailed objective description` |
| `targetScore` | `targetScore Int? // Target Nexus Index score (0–100)` |
| `horizon` | `horizon   String // "3_MONTHS" \| "6_MONTHS" \| "12_MONTHS"` |
| `startDate` | `startDate DateTime @default(now())` |
| `endDate` | `endDate   DateTime` |
| `status` | `status TrajectoryStatus @default(ACTIVE)` |
| `milestones` | `milestones Json @default("[]") // Array of { id, title, targetDate, completed, completedAt }` |
| `createdBy` | `createdBy String? // userId of who created it (coach, assistante, or auto)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId, status])`
- `@@map("trajectories")`

### model Entitlement

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id              String            @id @default(cuid())` |
| `userId` | `userId          String` |
| `user` | `user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `productCode` | `productCode     String // e.g. STAGE_MATHS_P1, PREMIUM_LITE, CREDIT_PACK_10` |
| `label` | `label           String // Human-readable label (snapshot from invoice item)` |
| `status` | `status          EntitlementStatus @default(ACTIVE)` |
| `startsAt` | `startsAt        DateTime          @default(now())` |
| `endsAt` | `endsAt          DateTime? // null = permanent until revoked` |
| `sourceInvoiceId` | `sourceInvoiceId String?` |
| `sourceInvoice` | `sourceInvoice   Invoice?          @relation(fields: [sourceInvoiceId], references: [id], onDelete: SetNull)` |
| `metadata` | `metadata        Json? // { qty, credits, subject, level, ... }` |
| `suspendedAt` | `suspendedAt     DateTime?` |
| `suspendReason` | `suspendReason   String?` |
| `revokedAt` | `revokedAt       DateTime?` |
| `createdAt` | `createdAt       DateTime          @default(now())` |
| `updatedAt` | `updatedAt       DateTime          @updatedAt` |

**Attributs modèle :**
- `@@index([userId, status])`
- `@@index([productCode])`
- `@@index([sourceInvoiceId])`
- `@@map("entitlements")`

### model InvoiceAccessToken

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id              String    @id @default(cuid())` |
| `invoiceId` | `invoiceId       String` |
| `invoice` | `invoice         Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)` |
| `tokenHash` | `tokenHash       String    @unique // SHA-256 hash of the raw token` |
| `expiresAt` | `expiresAt       DateTime` |
| `createdAt` | `createdAt       DateTime  @default(now())` |
| `createdByUserId` | `createdByUserId String` |
| `revokedAt` | `revokedAt       DateTime?` |

**Attributs modèle :**
- `@@index([invoiceId])`
- `@@map("invoice_access_tokens")`

### model UserDocument

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id           String @id @default(cuid())` |
| `title` | `title        String` |
| `originalName` | `originalName String` |
| `mimeType` | `mimeType     String` |
| `sizeBytes` | `sizeBytes    Int` |
| `localPath` | `localPath String @unique` |
| `documentType` | `documentType    DocumentType            @default(AUTRE)` |
| `visibilityScope` | `visibilityScope DocumentVisibilityScope @default(STUDENT_ONLY)` |
| `subject` | `subject         Subject?` |
| `description` | `description     String?` |
| `expiresAt` | `expiresAt       DateTime?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `userId` | `userId String` |
| `user` | `user   User   @relation("UserDocuments", fields: [userId], references: [id], onDelete: Cascade)` |
| `uploadedById` | `uploadedById String?` |
| `uploadedBy` | `uploadedBy   User?   @relation("DocumentUploader", fields: [uploadedById], references: [id], onDelete: SetNull)` |

**Attributs modèle :**
- `@@index([userId])`
- `@@index([uploadedById])`
- `@@index([documentType])`
- `@@index([visibilityScope])`
- `@@index([subject])`
- `@@index([expiresAt])`
- `@@map("user_documents")`

### model MathsProgress

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id     String     @id @default(cuid())` |
| `userId` | `userId String` |
| `user` | `user   User       @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `level` | `level  MathsLevel // PREMIERE or TERMINALE — prevents collision between levels` |
| `track` | `track  AcademicTrack @default(EDS_GENERALE)` |
| `completedChapters` | `completedChapters String[] @default([])` |
| `masteredChapters` | `masteredChapters  String[] @default([])` |
| `totalXp` | `totalXp           Int      @default(0)` |
| `quizScore` | `quizScore         Int      @default(0)` |
| `comboCount` | `comboCount        Int      @default(0)` |
| `bestCombo` | `bestCombo         Int      @default(0)` |
| `streak` | `streak            Int      @default(0)` |
| `streakFreezes` | `streakFreezes     Int      @default(0)` |
| `lastActivityDate` | `lastActivityDate  String?` |
| `dailyChallenge` | `dailyChallenge    Json     @default("{}")` |
| `exerciseResults` | `exerciseResults   Json     @default("{}")` |
| `hintUsage` | `hintUsage         Json     @default("{}")` |
| `badges` | `badges            String[] @default([])` |
| `srsQueue` | `srsQueue          Json     @default("{}")` |
| `diagnosticResults` | `diagnosticResults    Json?` |
| `timePerChapter` | `timePerChapter       Json?` |
| `formulaireViewed` | `formulaireViewed     Boolean @default(false)` |
| `grandOralSeen` | `grandOralSeen        Int     @default(0)` |
| `labArchimedeOpened` | `labArchimedeOpened   Boolean @default(false)` |
| `eulerMaxSteps` | `eulerMaxSteps        Int     @default(0)` |
| `newtonBestIterations` | `newtonBestIterations Int?` |
| `printedFiche` | `printedFiche         Boolean @default(false)` |
| `errorTags` | `errorTags               Json?` |
| `hintPenaltyXp` | `hintPenaltyXp           Int?` |
| `bacChecklistCompletions` | `bacChecklistCompletions Int?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([userId, level, track])`
- `@@index([userId])`
- `@@index([track])`
- `@@map("maths_progress")`

### model EamProgress

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(dbgenerated("(gen_random_uuid())::text"))` |
| `userId` | `userId    String   @unique @map("user_id")` |
| `user` | `user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `checks` | `checks    Json     @default("{}")` |
| `quiz` | `quiz      Json     @default("{}")` |
| `createdAt` | `createdAt DateTime @default(now()) @map("created_at")` |
| `updatedAt` | `updatedAt DateTime @updatedAt @map("updated_at")` |

**Attributs modèle :**
- `@@index([userId])`
- `@@map("eam_progress")`

### model NsiPracticeProgress

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `userId` | `userId    String   @unique` |
| `user` | `user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `data` | `data      Json     // Full NsiProgress object (same structure as localStorage)` |
| `version` | `version   Int      @default(1)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([userId])`
- `@@map("nsi_practice_progress")`

### model CoachNote

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id String @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   User   @relation("CoachNoteSubject", fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String` |
| `coach` | `coach   User    @relation("CoachNoteAuthor", fields: [coachId], references: [id], onDelete: Cascade)` |
| `body` | `body   String  @db.Text` |
| `pinned` | `pinned Boolean @default(false)` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@index([studentId])`
- `@@index([coachId])`
- `@@index([studentId, pinned])`
- `@@map("coach_notes")`

### model CoachStudentAssignment

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id             String           @id @default(cuid())` |
| `coachId` | `coachId        String` |
| `coach` | `coach          CoachProfile     @relation(fields: [coachId], references: [id], onDelete: Cascade)` |
| `studentId` | `studentId      String` |
| `student` | `student        Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `assignedById` | `assignedById   String?` |
| `assignedBy` | `assignedBy     User?            @relation("CoachStudentAssignmentAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)` |
| `assignmentType` | `assignmentType AssignmentType   @default(PRIMARY)` |
| `status` | `status         AssignmentStatus @default(ACTIVE)` |
| `subjects` | `subjects       Subject[]        @default([])` |
| `notes` | `notes          String?` |
| `startsAt` | `startsAt       DateTime         @default(now())` |
| `endsAt` | `endsAt         DateTime?` |
| `createdAt` | `createdAt      DateTime         @default(now())` |
| `updatedAt` | `updatedAt      DateTime         @updatedAt` |

**Attributs modèle :**
- `@@index([coachId, status])`
- `@@index([studentId, status])`
- `@@index([assignedById])`
- `@@map("coach_student_assignments")`

### model SurvivalProgress

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String  @id @default(cuid())` |
| `studentId` | `studentId String  @unique` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `startedAt` | `startedAt DateTime @default(now())` |
| `examDate` | `examDate  DateTime` |
| `reflexesState` | `reflexesState Json` |
| `phrasesState` | `phrasesState  Json` |
| `qcmAttempts` | `qcmAttempts   Int  @default(0)` |
| `qcmCorrect` | `qcmCorrect    Int  @default(0)` |
| `rituals` | `rituals       Json` |
| `notePotentielle` | `notePotentielle Float?` |
| `updatedAt` | `updatedAt        DateTime @updatedAt` |
| `attempts` | `attempts SurvivalAttempt[]` |

**Attributs modèle :**
- `@@index([studentId])`
- `@@map("survival_progress")`

### model SurvivalAttempt

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id         String           @id @default(cuid())` |
| `progressId` | `progressId String` |
| `progress` | `progress   SurvivalProgress @relation(fields: [progressId], references: [id], onDelete: Cascade)` |
| `itemType` | `itemType      String` |
| `itemId` | `itemId        String` |
| `correctAnswer` | `correctAnswer String` |
| `givenAnswer` | `givenAnswer   String` |
| `isCorrect` | `isCorrect     Boolean` |
| `timeSpentSec` | `timeSpentSec  Int` |
| `createdAt` | `createdAt     DateTime @default(now())` |

**Attributs modèle :**
- `@@index([progressId, itemType])`
- `@@map("survival_attempts")`

### model EafPreparationReport

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `studentId` | `studentId String` |
| `student` | `student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String` |
| `coach` | `coach   CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)` |
| `linearReading` | `linearReading        String?  @db.Text` |
| `workPresentation` | `workPresentation     String?  @db.Text` |
| `interview` | `interview            String?  @db.Text` |
| `oralExpression` | `oralExpression       String?  @db.Text` |
| `writingMethod` | `writingMethod        String?  @db.Text` |
| `languageMastery` | `languageMastery      String?  @db.Text` |
| `literaryCulture` | `literaryCulture      String?  @db.Text` |
| `strengths` | `strengths            String?  @db.Text` |
| `areasToImprove` | `areasToImprove       String?  @db.Text` |
| `nextSessionGoals` | `nextSessionGoals     String?  @db.Text` |
| `coachFreeComment` | `coachFreeComment     String?  @db.Text` |
| `status` | `status          String    @default("DRAFT")` |
| `completionRatio` | `completionRatio Int       @default(0)` |
| `validatedAt` | `validatedAt     DateTime?` |
| `validatedBy` | `validatedBy     String?` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |

**Attributs modèle :**
- `@@unique([studentId, coachId])`
- `@@index([coachId])`
- `@@index([studentId])`
- `@@map("eaf_preparation_reports")`

### model CopySubmission

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull)` |
| `subject` | `subject   Subject` |
| `gradeLevel` | `gradeLevel GradeLevel?` |
| `title` | `title       String` |
| `description` | `description String?` |
| `sourceType` | `sourceType AssessmentSourceType @default(AUTRE)` |
| `sourceId` | `sourceId   String?` |
| `source` | `source     AssessmentSource? @relation(fields: [sourceId], references: [id], onDelete: SetNull)` |
| `status` | `status CopySubmissionStatus @default(PENDING_UPLOAD)` |
| `pages` | `pages CopyPage[]` |
| `ocrText` | `ocrText  String? @db.Text` |
| `ocrError` | `ocrError String?` |
| `aiJob` | `aiJob   AiProcessingJob?` |
| `aiJobId` | `aiJobId String? @unique` |
| `report` | `report  PedagogicalReport?` |
| `storedFilePath` | `storedFilePath String?` |
| `fileSizeBytes` | `fileSizeBytes  Int?` |
| `mimeType` | `mimeType       String?` |

**Attributs modèle :**
- `@@index([studentId, status])`
- `@@index([coachId, status])`
- `@@index([sourceId])`
- `@@index([subject, status])`
- `@@index([createdAt])`
- `@@map("copy_submissions")`

### model AssessmentSource

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `name` | `name        String` |
| `description` | `description String?` |
| `type` | `type        AssessmentSourceType` |
| `isOfficialAnnale` | `isOfficialAnnale Boolean @default(false)` |
| `year` | `year            Int?` |
| `examType` | `examType        String?` |
| `subject` | `subject      Subject` |
| `gradeLevel` | `gradeLevel   GradeLevel?` |
| `academicTrack` | `academicTrack  AcademicTrack?` |
| `submittedCopies` | `submittedCopies CopySubmission[]` |

**Attributs modèle :**
- `@@index([type, subject])`
- `@@index([year])`
- `@@map("assessment_sources")`

### model CopyPage

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `submissionId` | `submissionId String` |
| `submission` | `submission   CopySubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)` |
| `pageNumber` | `pageNumber Int` |
| `status` | `status CopyPageStatus @default(UPLOADED)` |
| `documentType` | `documentType CorrectionDocumentType @default(STUDENT_COPY)` |
| `originalFilePath` | `originalFilePath    String` |
| `originalFilename` | `originalFilename    String?` |
| `mimeType` | `mimeType            String?` |
| `sizeBytes` | `sizeBytes           Int?` |
| `uploadedById` | `uploadedById        String?` |
| `convertedFilePaths` | `convertedFilePaths  String[]` |
| `ocrText` | `ocrText             String? @db.Text` |
| `ocrConfidence` | `ocrConfidence       Float?` |
| `width` | `width  Int?` |
| `height` | `height Int?` |

**Attributs modèle :**
- `@@unique([submissionId, pageNumber])`
- `@@index([submissionId, pageNumber])`
- `@@index([submissionId, documentType])`
- `@@index([uploadedById])`
- `@@map("copy_pages")`

### model AiProcessingJob

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `type` | `type     AiJobType` |
| `status` | `status   AiJobStatus   @default(PENDING)` |
| `priority` | `priority AiJobPriority @default(NORMAL)` |
| `copySubmissionId` | `copySubmissionId String?        @unique` |
| `copySubmission` | `copySubmission   CopySubmission? @relation(fields: [copySubmissionId], references: [id], onDelete: SetNull)` |
| `inputData` | `inputData  Json?` |
| `outputData` | `outputData Json?` |
| `errorMessage` | `errorMessage String?` |
| `retryCount` | `retryCount   Int     @default(0)` |
| `maxRetries` | `maxRetries   Int     @default(3)` |
| `claimedAt` | `claimedAt      DateTime?` |
| `claimedBy` | `claimedBy      String?` |
| `startedAt` | `startedAt      DateTime?` |
| `completedAt` | `completedAt    DateTime?` |
| `nextRetryAt` | `nextRetryAt    DateTime?` |
| `processingDurationMs` | `processingDurationMs Int?` |
| `chutesRequestId` | `chutesRequestId String?` |
| `tokensUsed` | `tokensUsed      Int?` |
| `modelVersion` | `modelVersion    String?` |

**Attributs modèle :**
- `@@index([status, priority, createdAt])`
- `@@index([status, nextRetryAt])`
- `@@index([claimedBy, status])`
- `@@map("ai_processing_jobs")`

### model PedagogicalReport

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `copySubmissionId` | `copySubmissionId String?         @unique` |
| `copySubmission` | `copySubmission   CopySubmission? @relation(fields: [copySubmissionId], references: [id], onDelete: SetNull)` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull)` |
| `status` | `status     PedagogicalReportStatus @default(DRAFT)` |
| `visibility` | `visibility ReportVisibility        @default(COACH_ONLY)` |
| `diagnostic` | `diagnostic Json` |
| `strengths` | `strengths  String[]` |
| `weaknesses` | `weaknesses String[]` |
| `rawAiOutput` | `rawAiOutput Json?` |
| `validatedAiOutput` | `validatedAiOutput Json?` |
| `competenceMatrix` | `competenceMatrix   CompetenceMatrix?` |
| `remediationRoadmap` | `remediationRoadmap RemediationRoadmap?` |
| `sentToStudentAt` | `sentToStudentAt DateTime?` |
| `readByStudentAt` | `readByStudentAt DateTime?` |
| `coachNotes` | `coachNotes      String? @db.Text` |
| `studentSummary` | `studentSummary  String? @db.Text` |
| `feedback` | `feedback ReportFeedback[]` |
| `auditLogs` | `auditLogs NpcAuditLog[]` |

**Attributs modèle :**
- `@@index([studentId, status])`
- `@@index([coachId, status])`
- `@@index([createdAt])`
- `@@map("pedagogical_reports")`

### model CompetenceMatrix

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `reportId` | `reportId String  @unique` |
| `report` | `report   PedagogicalReport @relation(fields: [reportId], references: [id], onDelete: Cascade)` |
| `matrixData` | `matrixData Json` |
| `globalScore` | `globalScore     Float?` |
| `confidenceLevel` | `confidenceLevel Float?` |

**Attributs modèle :**
- `@@map("competence_matrices")`

### model RemediationRoadmap

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `reportId` | `reportId String  @unique` |
| `report` | `report   PedagogicalReport @relation(fields: [reportId], references: [id], onDelete: Cascade)` |
| `title` | `title       String` |
| `description` | `description String?` |
| `estimatedDuration` | `estimatedDuration String?` |
| `difficultyLevel` | `difficultyLevel   String?` |
| `tasks` | `tasks RoadmapTask[]` |

**Attributs modèle :**
- `@@map("remediation_roadmaps")`

### model RoadmapTask

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `roadmapId` | `roadmapId String` |
| `roadmap` | `roadmap   RemediationRoadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)` |
| `title` | `title       String` |
| `description` | `description String` |
| `order` | `order       Int` |
| `type` | `type        String` |
| `resourceIds` | `resourceIds   String[]` |
| `externalUrls` | `externalUrls  String[]` |
| `isCompleted` | `isCompleted Boolean @default(false)` |
| `completedAt` | `completedAt DateTime?` |

**Attributs modèle :**
- `@@index([roadmapId, order])`
- `@@map("roadmap_tasks")`

### model ReportFeedback

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `reportId` | `reportId String` |
| `report` | `report   PedagogicalReport @relation(fields: [reportId], references: [id], onDelete: Cascade)` |
| `submittedById` | `submittedById String` |
| `type` | `type        FeedbackType` |
| `comment` | `comment     String?` |
| `severity` | `severity    Int?        @default(1)` |
| `isResolved` | `isResolved Boolean  @default(false)` |
| `resolvedAt` | `resolvedAt DateTime?` |
| `resolutionNote` | `resolutionNote String?` |

**Attributs modèle :**
- `@@index([reportId, type])`
- `@@index([submittedById])`
- `@@map("report_feedback")`

### model NpcAuditLog

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `reportId` | `reportId String?` |
| `report` | `report   PedagogicalReport? @relation(fields: [reportId], references: [id], onDelete: SetNull)` |
| `action` | `action     String` |
| `actorId` | `actorId    String` |
| `actorRole` | `actorRole  String` |
| `entityType` | `entityType String` |
| `entityId` | `entityId   String` |
| `details` | `details    Json?` |

**Attributs modèle :**
- `@@index([reportId, createdAt])`
- `@@index([actorId, createdAt])`
- `@@index([action, createdAt])`
- `@@map("npc_audit_logs")`

### model GeneratedPedagogicalReport

| Champ | Déclaration complète |
|-------|---------------------|
| `id` | `id        String   @id @default(cuid())` |
| `createdAt` | `createdAt DateTime @default(now())` |
| `updatedAt` | `updatedAt DateTime @updatedAt` |
| `studentId` | `studentId String` |
| `student` | `student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)` |
| `coachId` | `coachId String?` |
| `coach` | `coach   CoachProfile? @relation(fields: [coachId], references: [id], onDelete: SetNull)` |
| `subject` | `subject     String` |
| `stageSlug` | `stageSlug   String?` |
| `studentBilanId` | `studentBilanId String?` |
| `coachReportId` | `coachReportId  String?` |
| `kind` | `kind        String` |
| `promptVersion` | `promptVersion   String` |
| `templateVersion` | `templateVersion String` |
| `status` | `status GeneratedReportStatus @default(PENDING)` |
| `errorCode` | `errorCode    String?` |
| `errorMessage` | `errorMessage String?` |
| `retryCount` | `retryCount   Int     @default(0)` |
| `inputChecksum` | `inputChecksum String?` |
| `contextJson` | `contextJson    Json?` |
| `llmJson` | `llmJson        Json?` |
| `validatedJson` | `validatedJson  Json?` |
| `modelUsed` | `modelUsed      String?` |
| `validatedAt` | `validatedAt    DateTime?` |
| `latexSource` | `latexSource  String?  @db.Text` |
| `generatedAt` | `generatedAt  DateTime?` |
| `pdfUrl` | `pdfUrl       String?` |

**Attributs modèle :**
- `@@index([studentId, status])`
- `@@index([status, createdAt])`
- `@@unique([studentId, stageSlug, subject, kind, inputChecksum])`
- `@@map("generated_pedagogical_reports")`


---
## (b) Surface API

**Source** : `find app/api -name route.ts` → 173 fichiers — extrait par `scripts/extract-routes.sh` v2

> Chaque ligne ci-dessous est le résultat d'un grep déterministe sur le fichier route.ts
> (+ suivi re-exports 1 niveau pour les gardes).
> Format : ROUTE | METHODS | AUTH_CATEGORY | GUARD_DETAIL | ROLE_CONSTRAINTS | PRISMA_MUTATIONS
> Note : les mutations déléguées à des libs importées ne sont pas capturées par ce grep
> (le cross-check confirme 0 écart pour les mutations directes).

### Classification par seau d'autorisation

| Seau | Description | Compte |
|------|-------------|--------|
| CENTRALIZED | `requireRole` / `requireAnyRole` / `requireAuth` (lib/guards.ts) | **67** |
| RBAC | `enforcePolicy` (lib/rbac.ts) | **1** |
| INLINE_AUTH | `auth()` NextAuth direct + vérification rôle inline | **80** |
| PUBLIC | Pas d'authentification (justifié par route — voir b-ter) | **25** |
| **TOTAL** | | **173** |

### Listing complet (173 routes)

```
/api/admin/activities | GET | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | none
/api/admin/analytics | GET | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | none
/api/admin/dashboard | GET | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | none
/api/admin/directeur/stats | GET | INLINE_AUTH | auth() | userRole !== 'ADMIN'; | none
/api/admin/documents | POST | CENTRALIZED | requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]); | UserRole.ADMIN;UserRole.ASSISTANTE; | prisma.userDocument.create;
/api/admin/invoices/[id] | PATCH | INLINE_AUTH | auth() | canPerformStatusAction(userRole); | prisma.invoice.update;
/api/admin/invoices/[id]/send | POST | INLINE_AUTH | auth() | canPerformStatusAction(role); | prisma.invoice.update;
/api/admin/invoices | GET,POST | INLINE_AUTH | auth() | userRole !== 'ADMIN';userRole !== 'ASSISTANTE'; | prisma.invoice.create;prisma.invoice.update;
/api/admin/recompute-ssn | POST | INLINE_AUTH | auth() | userRole !== 'ADMIN'; | none
/api/admin/stages | GET,POST | CENTRALIZED | requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);requireRole(UserRole.ADMIN); | UserRole.ADMIN;UserRole.ASSISTANTE; | prisma.stage.create;
/api/admin/stages/[stageId]/coaches | DELETE,GET,POST | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | prisma.stageCoach.create;prisma.stageCoach.deleteMany;
/api/admin/stages/[stageId] | DELETE,GET,PATCH | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | prisma.stage.update;
/api/admin/stages/[stageId]/sessions | GET,POST | CENTRALIZED | requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]); | UserRole.ADMIN;UserRole.ASSISTANTE; | prisma.stageSession.create;
/api/admin/stages/[stageId]/sessions/[sessionId] | DELETE,PATCH | CENTRALIZED | requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]); | UserRole.ADMIN;UserRole.ASSISTANTE; | prisma.stageSession.delete;prisma.stageSession.update;
/api/admin/subscriptions | GET,PUT | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN; | prisma.subscription.update;
/api/admin/test-email | GET,POST | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/admin/users | DELETE,GET,PATCH,POST | CENTRALIZED | requireRole(UserRole.ADMIN); | UserRole.ADMIN;UserRole.ELEVE;; role !== 'ALL';role === 'COACH';role === 'ELEVE'; | prisma.student.upsert;prisma.user.create;prisma.user.delete;prisma.user.update;
/api/admin/users/search | GET | CENTRALIZED | requireAnyRole([UserRole.ADMIN]); | UserRole.ADMIN;UserRole.ELEVE;UserRole.PARENT; | none
/api/analytics/event | POST | PUBLIC | none | none | none
/api/aria/chat | POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/aria/conversations | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/aria/feedback | POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/assessments/[id]/export | GET | INLINE_AUTH | auth() | none | none
/api/assessments/[id]/result | GET | INLINE_AUTH | auth() | none | none
/api/assessments/[id]/status | GET | INLINE_AUTH | auth() | none | none
/api/assessments/predict | POST | INLINE_AUTH | auth() | session.user.role === 'COACH';session.user.role === 'PARENT';; user.role === 'COACH';user.role === 'PARENT';; role === 'COACH';role === 'PARENT'; | none
/api/assessments/submit | POST | PUBLIC | none | none | prisma.assessment.create;prisma.assessment.update;prisma.domainScore.createMany;
/api/assessments/test | GET | INLINE_AUTH | auth() | session.user.role !== 'ADMIN';; user.role !== 'ADMIN';; role !== 'ADMIN'; | none
/api/assistante/activate-student | POST | INLINE_AUTH | auth() | none | none
/api/assistante/assignments/[id] | GET,PATCH | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | prisma.coachStudentAssignment.update;
/api/assistante/assignments | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | prisma.coachStudentAssignment.create;
/api/assistante/coaches/manage/[id] | DELETE,PUT | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/assistante/coaches/manage | GET,POST | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/assistante/coaches | GET | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | none
/api/assistante/credit-requests | GET,POST | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | prisma.creditTransaction.update;
/api/assistante/dashboard | GET | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/assistante/planning | GET | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | none
/api/assistante/quotes/pdf | POST | CENTRALIZED | requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]); | UserRole.ADMIN;UserRole.ASSISTANTE; | none
/api/assistante/sessions | POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | role !== 'COACH';role !== 'ELEVE'; | none
/api/assistante/stages | GET | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | none
/api/assistante/students/credits | GET,POST | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | prisma.creditTransaction.create;
/api/assistante/students | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | role !== 'PARENT'; | prisma.user.update;
/api/assistante/students/[studentId]/documents | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | prisma.userDocument.create;
/api/assistante/students/[studentId] | GET | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | none
/api/assistante/subscription-requests | GET,PATCH | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/assistante/subscriptions | GET,POST | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/auth/[...nextauth] | NONE | PUBLIC | none | none | none
/api/auth/resend-activation | POST | PUBLIC | none | none | prisma.user.update;
/api/auth/reset-password | POST | PUBLIC | none | none | prisma.user.update;
/api/bilan-gratuit/dismiss | POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | prisma.parentProfile.update;
/api/bilan-gratuit | POST | PUBLIC | none | UserRole.ELEVE;UserRole.PARENT; | none
/api/bilan-gratuit/status | GET | INLINE_AUTH | auth() | none | none
/api/bilan-pallier2-maths/retry | POST | CENTRALIZED | await requireAnyRole(; | none | prisma.diagnostic.update;
/api/bilan-pallier2-maths | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'] as unknown as Parameters<typeof requireAnyRole>[0]); | none | prisma.diagnostic.create;prisma.diagnostic.update;
/api/bilans/generate | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']); | none | prisma.bilan.update;
/api/bilans/[id]/export | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH', 'ELEVE', 'PARENT']); | user.role === 'PARENT';; role === 'PARENT'; | none
/api/bilans/[id] | DELETE,GET,PUT | CENTRALIZED | requireAnyRole(['ADMIN']);requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH', 'ELEVE', 'PARENT']); | none | prisma.bilan.delete;prisma.bilan.update;
/api/bilans | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']); | userRole === 'COACH'; | prisma.bilan.create;
/api/coach/dashboard | GET | INLINE_AUTH | auth() | session.user.role !== 'COACH';; user.role !== 'COACH';; role !== 'COACH'; | none
/api/coach/eaf-stage-printemps/students | GET | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate | POST | CENTRALIZED | requireRole('COACH'); | none | prisma.bilan.update;
/api/coach/eaf-stage-printemps/students/[studentId]/report | GET,PATCH,POST | CENTRALIZED | requireRole('COACH'); | none | prisma.bilan.create;prisma.bilan.update;
/api/coaches/availability | DELETE,GET,POST | INLINE_AUTH | auth() | session.user.role !== 'COACH';session.user.role === 'COACH';; user.role !== 'COACH';user.role === 'COACH';; role !== 'COACH';role === 'COACH'; | prisma.coachAvailability.createMany;prisma.coachAvailability.delete;prisma.coachAvailability.deleteMany;
/api/coaches/available | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';session.user.role !== 'PARENT';; user.role !== 'ELEVE';user.role !== 'PARENT';; role !== 'ELEVE';role !== 'PARENT'; | none
/api/coach/maths-premiere-stage-printemps/students | GET | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent | POST | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student | POST | CENTRALIZED | requireRole('COACH'); | none | prisma.bilan.update;
/api/coach/maths-premiere-stage-printemps/students/[studentId]/report | GET,PATCH,POST | CENTRALIZED | requireRole('COACH'); | none | prisma.bilan.create;prisma.bilan.update;
/api/coach/nsi-pratique-2026/students | GET | CENTRALIZED | requireAnyRole(['COACH', 'ADMIN']); | none | none
/api/coach/nsi-pratique-2026/students/[studentId]/progress | GET | CENTRALIZED | requireAnyRole(['COACH', 'ADMIN']); | none | none
/api/coach/sessions/[sessionId]/report | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'ADMIN';session.user.role !== 'ASSISTANTE';session.user.role !== 'COACH';; user.role !== 'ADMIN';user.role !== 'ASSISTANTE';user.role !== 'COACH';; role !== 'ADMIN';role !== 'ASSISTANTE';role !== 'COACH'; | none
/api/coach/stages | GET | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/students/eam-summary | GET | INLINE_AUTH | auth() | session.user.role !== "COACH";; user.role !== "COACH";; role !== "COACH"; | none
/api/coach/students | GET | CENTRALIZED | requireRole(UserRole.COACH); | UserRole.COACH; | none
/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale | GET,PATCH | CENTRALIZED | requireRole('COACH'); | none | prisma.bilan.update;
/api/coach/students/[studentId]/documents | GET,POST | CENTRALIZED | requireRole('COACH'); | none | prisma.userDocument.create;
/api/coach/students/[studentId]/dossier | GET | INLINE_AUTH | auth() | role !== 'ADMIN';role !== 'COACH';role === 'COACH'; | none
/api/coach/students/[studentId]/eaf-preparation-report | GET,PUT | CENTRALIZED | requireRole('COACH'); | none | prisma.eafPreparationReport.upsert;
/api/coach/students/[studentId]/eaf-preparation-report/validate | POST | CENTRALIZED | requireRole('COACH'); | none | prisma.eafPreparationReport.update;
/api/coach/students/[studentId]/generated-reports/[reportId]/download | GET | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/students/[studentId]/generated-reports/[reportId]/generate | POST | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate | POST | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/students/[studentId]/generated-reports | GET,POST | CENTRALIZED | requireRole('COACH'); | none | none
/api/coach/students/[studentId]/notes | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'COACH';; user.role !== 'COACH';; role !== 'ADMIN';role !== 'COACH';role === 'COACH'; | prisma.coachNote.create;
/api/coach/students/[studentId] | GET | CENTRALIZED | requireRole(UserRole.COACH); | UserRole.COACH; | none
/api/coach/students/[studentId]/survival-mode | POST | INLINE_AUTH | auth() | role === 'COACH'; | prisma.coachNote.create;prisma.student.update;
/api/coach/trajectory | POST | INLINE_AUTH | auth() | session.user.role !== "ADMIN";session.user.role !== "COACH";; user.role !== "ADMIN";user.role !== "COACH";; role !== "ADMIN";role !== "COACH"; | prisma.trajectory.create;prisma.trajectory.updateMany;
/api/contact | POST | PUBLIC | none | none | none
/api/diagnostics/definitions | GET | PUBLIC | none | none | none
/api/documents/[id] | GET | INLINE_AUTH | auth() | UserRole.ADMIN;UserRole.ASSISTANTE; | none
/api/eam/progress | GET,POST | INLINE_AUTH | auth() | user.role !== "ELEVE";; role !== "ELEVE"; | none
/api/eleve/bilan-diagnostic-maths-terminale | GET,POST | CENTRALIZED | requireRole('ELEVE'); | none | prisma.bilan.create;prisma.bilan.update;
/api/eleve/nsi-pratique-2026/progress | GET,PUT | CENTRALIZED | requireRole('ELEVE'); | none | prisma.nsiPracticeProgress.upsert;
/api/eleve/questionnaire-eaf-stage-printemps | GET,POST | CENTRALIZED | requireRole('ELEVE'); | none | prisma.bilan.create;prisma.bilan.update;
/api/eleve/questionnaire-maths-premiere-stage-printemps | GET,POST | CENTRALIZED | requireRole('ELEVE'); | none | prisma.bilan.create;prisma.bilan.update;
/api/eleve/stages | GET | CENTRALIZED | requireRole('ELEVE'); | none | none
/api/health | GET | PUBLIC | none | none | none
/api/internal/health | GET | RBAC | enforcePolicy('admin.dashboard'); | none | none
/api/invoices/[id]/pdf | GET | INLINE_AUTH | auth() | none | none
/api/invoices/[id]/receipt/pdf | GET | INLINE_AUTH | auth() | none | prisma.invoice.update;
/api/lamis/attempt | POST | PUBLIC | none | none | none
/api/lamis/exercises | GET | PUBLIC | none | none | none
/api/lamis/export | GET,POST | PUBLIC | none | none | none
/api/lamis/progress | GET,POST | PUBLIC | none | none | none
/api/lamis/teacher-report | GET,POST | PUBLIC | none | none | none
/api/me/next-step | GET | INLINE_AUTH | auth() | none | none
/api/messages/conversations | GET | INLINE_AUTH | auth() | none | none
/api/messages/send | POST | INLINE_AUTH | auth() | none | prisma.message.create;
/api/newsletter | POST | PUBLIC | none | none | none
/api/notifications | GET,PATCH | INLINE_AUTH | auth() | none | prisma.notification.update;prisma.notification.updateMany;
/api/notify/email | POST | PUBLIC | none | none | none
/api/npc/files/[...path] | GET | INLINE_AUTH | auth() | none | none
/api/npc/submissions | GET,POST | INLINE_AUTH | auth() | session.user.role === 'COACH';session.user.role === 'ELEVE';session.user.role === 'PARENT';; user.role === 'COACH';user.role === 'ELEVE';user.role === 'PARENT';; role === 'COACH';role === 'ELEVE';role === 'PARENT'; | prisma.copySubmission.create;prisma.npcAuditLog.create;
/api/npc/submissions/[submissionId]/documents/[documentId] | DELETE,PATCH | INLINE_AUTH | auth() | none | prisma.copyPage.delete;prisma.copyPage.update;prisma.copySubmission.update;prisma.npcAuditLog.create;
/api/npc/submissions/[submissionId]/documents | GET,POST | INLINE_AUTH | auth() | none | prisma.aiProcessingJob.create;prisma.copyPage.create;prisma.copySubmission.update;prisma.npcAuditLog.create;
/api/npc/submissions/[submissionId]/generate | POST | INLINE_AUTH | auth() | none | prisma.aiProcessingJob.create;prisma.copySubmission.update;prisma.npcAuditLog.create;
/api/npc/uploads | POST | INLINE_AUTH | auth() | UserRole.COACH;UserRole.ELEVE;UserRole.PARENT; | prisma.copyPage.create;prisma.copySubmission.create;prisma.copySubmission.delete;prisma.copySubmission.update;
/api/parent/bilans/[id]/pdf | GET | CENTRALIZED | requireRole('PARENT'); | none | none
/api/parent/children | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | none
/api/parent/credit-request | POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | prisma.creditTransaction.create;
/api/parent/dashboard | GET | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | none
/api/parent/stages | GET | CENTRALIZED | requireRole('PARENT'); | none | none
/api/parent/subscription-requests | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | prisma.notification.create;prisma.subscriptionRequest.create;
/api/parent/subscriptions | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | prisma.notification.create;prisma.subscriptionRequest.create;
/api/payments/bank-transfer/confirm | POST | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | prisma.notification.createMany;prisma.payment.create;
/api/payments/check-pending | GET | INLINE_AUTH | auth() | session.user.role !== 'PARENT';; user.role !== 'PARENT';; role !== 'PARENT'; | none
/api/payments/clictopay/init | POST | INLINE_AUTH | auth() | none | none
/api/payments/clictopay/webhook | POST | PUBLIC | none | none | none
/api/payments/pending | GET | INLINE_AUTH | auth() | ['ADMIN', 'ASSISTANTE'].includes; | none
/api/payments/validate | POST | INLINE_AUTH | auth() | ['ASSISTANTE', 'ADMIN'].includes; | prisma.invoice.update;prisma.payment.update;prisma.userDocument.create;
/api/programme/maths-1ere/progress | GET,POST | INLINE_AUTH | auth() | none | prisma.mathsProgress.upsert;
/api/programme/maths-1ere/rag | POST | INLINE_AUTH | auth() | none | none
/api/programme/maths-1ere-stmg/progress | GET,POST | INLINE_AUTH | auth() | none | prisma.mathsProgress.upsert;
/api/programme/maths-1ere-stmg/rag | POST | INLINE_AUTH | auth() | none | none
/api/programme/maths-1ere-stmg/stage-progress | GET,POST | INLINE_AUTH | auth() | none | none
/api/programme/maths-terminale/progress | GET,POST | INLINE_AUTH | auth() | none | prisma.mathsProgress.upsert;
/api/public-documents/corrige-dnb-maths-2026 | GET | PUBLIC | none | none | none
/api/reservation | GET,PATCH,POST | INLINE_AUTH | auth() | userRole !== 'ADMIN';userRole !== 'ASSISTANTE'; | prisma.stageReservation.create;prisma.stageReservation.update;prisma.stageReservation.updateMany;
/api/reservation/verify | POST | PUBLIC | none | none | none
/api/sessions/book | POST | CENTRALIZED | requireAnyRole([UserRole.PARENT, UserRole.ELEVE]); | session.user.role === 'ELEVE';session.user.role === 'PARENT';; user.role !== 'COACH';user.role === 'ELEVE';user.role === 'PARENT';; UserRole.ELEVE;UserRole.PARENT;; role !== 'COACH';role === 'ELEVE';role === 'PARENT'; | prisma.sessionNotification.createMany;prisma.sessionReminder.createMany;
/api/sessions/cancel | POST | CENTRALIZED | requireAnyRole([UserRole.ELEVE, UserRole.COACH, UserRole.ASSISTANTE]); | session.user.role === 'ASSISTANTE';session.user.role === 'COACH';session.user.role === 'ELEVE';; user.role === 'ASSISTANTE';user.role === 'COACH';user.role === 'ELEVE';; UserRole.ASSISTANTE;UserRole.COACH;UserRole.ELEVE;; role === 'ASSISTANTE';role === 'COACH';role === 'ELEVE'; | prisma.sessionBooking.update;
/api/sessions/video | POST | INLINE_AUTH | auth() | session.user.role === 'COACH';; user.role === 'COACH';; role === 'COACH'; | prisma.sessionBooking.update;
/api/stages | GET | PUBLIC | none | none | none
/api/stages/[stageSlug]/bilans | GET,POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH']);requireAnyRole(['COACH', 'ADMIN', 'ASSISTANTE']); | user.role === 'ADMIN';user.role === 'ASSISTANTE';user.role === 'COACH';; role === 'ADMIN';role === 'ASSISTANTE';role === 'COACH'; | prisma.stageBilan.upsert;
/api/stages/[stageSlug]/inscrire | POST | PUBLIC | none | none | prisma.stageReservation.create;
/api/stages/[stageSlug]/reservations/[reservationId]/confirm | POST | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | user.role === 'ELEVE';; role === 'ELEVE'; | prisma.stageReservation.update;prisma.student.create;prisma.user.create;
/api/stages/[stageSlug]/reservations | GET | CENTRALIZED | requireAnyRole(['ADMIN', 'ASSISTANTE']); | none | none
/api/stages/[stageSlug] | GET | PUBLIC | none | none | none
/api/student/activate | GET,POST | PUBLIC | none | none | none
/api/student/automatismes/attempts/[id] | GET | INLINE_AUTH | auth() | session.user.role !== "ELEVE";; user.role !== "ELEVE";; role !== "ELEVE"; | none
/api/student/automatismes/attempts | GET,POST | INLINE_AUTH | auth() | session.user.role !== "ELEVE";; user.role !== "ELEVE";; role !== "ELEVE"; | prisma.assessment.create;
/api/student/automatismes/check-answer | POST | INLINE_AUTH | auth() | session.user.role !== "ELEVE";; user.role !== "ELEVE";; role !== "ELEVE"; | none
/api/student/automatismes/series/[id] | GET | INLINE_AUTH | auth() | session.user.role !== "ELEVE";; user.role !== "ELEVE";; role !== "ELEVE"; | none
/api/student/automatismes/series | GET | INLINE_AUTH | auth() | session.user.role !== "ELEVE";; user.role !== "ELEVE";; role !== "ELEVE"; | none
/api/student/bilans/[publicShareId] | GET | CENTRALIZED | requireRole('ELEVE'); | none | none
/api/student/credits | GET | CENTRALIZED | requireRole(UserRole.ELEVE); | UserRole.ELEVE; | none
/api/student/dashboard | GET | CENTRALIZED | requireRole(UserRole.ELEVE); | UserRole.ELEVE; | none
/api/student/documents/[id]/download | GET | CENTRALIZED | requireRole(UserRole.ELEVE); | UserRole.ELEVE; | none
/api/student/documents | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/student/nexus-index | GET | INLINE_AUTH | auth() | ['ELEVE', 'PARENT', 'ADMIN', 'ASSISTANTE'].includes;; role === 'PARENT'; | none
/api/student/resources/official/[slug] | GET | CENTRALIZED | requireRole(UserRole.ELEVE); | UserRole.ELEVE; | none
/api/student/resources | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/student/sessions | GET | CENTRALIZED | requireRole(UserRole.ELEVE); | UserRole.ELEVE; | none
/api/students/[studentId]/badges | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/student/stages | GET | CENTRALIZED | requireRole('ELEVE'); | none | none
/api/student/survival/phrases/[phraseId]/copied | POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | prisma.survivalProgress.upsert;
/api/student/survival/progress | GET,POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | prisma.survivalProgress.create;prisma.survivalProgress.upsert;
/api/student/survival/qcm/attempt | POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | prisma.survivalAttempt.create;prisma.survivalProgress.upsert;
/api/student/survival/reflexes/[reflexId]/attempt | POST | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | prisma.survivalAttempt.create;prisma.survivalProgress.upsert;
/api/student/survival/ritual | GET | INLINE_AUTH | auth() | session.user.role !== 'ELEVE';; user.role !== 'ELEVE';; role !== 'ELEVE'; | none
/api/student/trajectory | GET | INLINE_AUTH | auth() | ['ELEVE', 'PARENT', 'ADMIN', 'ASSISTANTE'].includes;; role === 'PARENT'; | none
/api/subscriptions/aria-addon | POST | PUBLIC | none | none | none
/api/subscriptions/change | POST | PUBLIC | none | none | none
```

---

## (b-bis) Réalité middleware & classification auth

### Middleware Next.js — matcher

**Source** : `middleware.ts` ligne 98

```typescript
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
```

**Conséquence** : le middleware **EXCLUT** `/api/*`. L'autorisation des routes API est
**100 % au niveau handler** — aucun filet middleware ne protège `/api`. Chaque route API
doit implémenter sa propre vérification d'authentification et de rôle.

Le middleware protège uniquement les routes de page :
- `/dashboard/*` → redirect vers `/auth/signin` si non authentifié
- Enforcement rôle-dashboard : `/dashboard/admin/*` accessible uniquement par ADMIN, etc.
- `/admin/*` → ADMIN uniquement
- `/auth/*` → redirect vers dashboard si déjà authentifié

### Routes INLINE_AUTH avec rôle vérifié hors grep

22 routes sont classées INLINE_AUTH avec `role_constraints = none` par le grep car la
vérification de rôle se fait via une fonction importée (import transitif non capturable par grep).
Vérification manuelle exhaustive sur les sous-ensembles sensibles :

| Route | Mécanisme réel (vérifié en source) |
|-------|------------------------------------|
| `/api/admin/test-email` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/activate-student` | `['ADMIN', 'ASSISTANTE', 'PARENT'].includes(...)` + owner-scoping PARENT |
| `/api/assistante/coaches/manage` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/coaches/manage/[id]` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/credit-requests` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/dashboard` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/students/credits` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/subscription-requests` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/assistante/subscriptions` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/payments/validate` | `['ASSISTANTE', 'ADMIN'].includes(session.user.role)` |
| `/api/payments/pending` | `['ADMIN', 'ASSISTANTE'].includes(session.user.role)` |
| `/api/npc/submissions/[id]/generate` | `canManageSubmissionDocuments()` via `lib/npc/access.ts` (ADMIN/ASSISTANTE full + COACH scoped) |
| `/api/npc/submissions/[id]/documents` | `canReadSubmission()` / `canManageSubmissionDocuments()` via `lib/npc/access.ts` |
| `/api/npc/submissions/[id]/documents/[docId]` | `canManageSubmissionDocuments()` via `lib/npc/access.ts` |
| `/api/npc/files/[...path]` | `can(role, 'READ', 'COPY_SUBMISSION')` via `lib/rbac.ts` + `canReadSubmission()` |
| `/api/invoices/[id]/pdf` | Dual-path : token signé OU `buildInvoiceScopeWhere()` (ADMIN/ASSISTANTE full, PARENT scoped) |
| `/api/invoices/[id]/receipt/pdf` | `buildInvoiceScopeWhere()` (ADMIN/ASSISTANTE full, PARENT scoped, COACH/ELEVE denied) |
| `/api/messages/send` | `canSendMessageToReceiver()` via `lib/security/message-access.ts` (role-pair rules) |
| `/api/notifications` | Auth seul, intentionnel — user-scoped `WHERE userId = session.user.id` |
| `/api/assessments/*/status/result/export` | Auth seul, intentionnel — user-scoped ou public-share-id |
| `/api/me/next-step` | Auth seul, intentionnel — user-scoped |
| `/api/messages/conversations` | Auth seul, intentionnel — user-scoped `WHERE senderId/receiverId` |
| `/api/programme/*/progress` | Auth seul, intentionnel — user-scoped via `userId` |
| `/api/programme/*/rag` | Auth seul, intentionnel — user-scoped |
| `/api/payments/clictopay/init` | Auth seul — crée transaction liée au `userId` de session |
| `/api/bilan-gratuit/status` | Auth seul — lecture `WHERE userId` |

### Routes auth-seul sur surface sensible : AUCUNE

Après correction, **aucune route** `/api/admin/*` ou `/api/assistante/*` n'est réellement
auth-seul sans vérification de rôle. Toutes ont un contrôle de rôle effectif, soit via grep
détectable, soit via `.includes()` en inline.

Les routes véritablement auth-seul (sans aucun contrôle de rôle) sont toutes des routes
**user-scoped** qui opèrent uniquement sur les données de l'utilisateur connecté (`WHERE userId = session.user.id`).
Aucune ne donne accès à des données d'autres utilisateurs.

---

## (b-ter) Audit des routes publiques mutantes

### Les 25 routes publiques — justification individuelle

| # | Route | Méthodes | Mute | Justification |
|---|-------|----------|------|---------------|
| 1 | `/api/analytics/event` | POST | non | Stub no-op, empêche les 404 client analytics |
| 2 | `/api/assessments/submit` | POST | **oui** | Assessment public (lead gen). Voir audit ci-dessous |
| 3 | `/api/auth/[...nextauth]` | GET,POST | non | Handler NextAuth — EST le mécanisme d'auth |
| 4 | `/api/auth/resend-activation` | POST | **oui** | Utilisateur non activé ne peut pas se connecter. Rate-limited 3/15min + throttle par email |
| 5 | `/api/auth/reset-password` | POST | **oui** | Utilisateur sans mot de passe ne peut pas se connecter. CSRF + rate-limited 5/15min + token HMAC single-use |
| 6 | `/api/bilan-gratuit` | POST | non (direct) | Formulaire lead-capture public. CSRF + honeypot + rate-limited |
| 7 | `/api/contact` | POST | non | Formulaire contact site vitrine. Rate-limited |
| 8 | `/api/diagnostics/definitions` | GET | non | Metadata safe (labels, domaines, skills). Pas de données sensibles |
| 9 | `/api/health` | GET | non | Healthcheck monitoring infrastructure |
| 10 | `/api/lamis/attempt` | POST | non | Outil in-browser, pas de persistence DB |
| 11 | `/api/lamis/exercises` | GET | non | Catalogue exercices statique |
| 12 | `/api/lamis/export` | GET,POST | non | Export CSV depuis données client. Stateless |
| 13 | `/api/lamis/progress` | GET,POST | non | Calcul progression depuis données client. Stateless |
| 14 | `/api/lamis/teacher-report` | GET,POST | non | Rapport depuis données client. Stateless |
| 15 | `/api/newsletter` | POST | non | Inscription newsletter. Rate-limited |
| 16 | `/api/notify/email` | POST | non | Email dispatch server-side. CSRF same-origin + rate-limited + body size limit |
| 17 | `/api/payments/clictopay/webhook` | POST | non (direct) | Webhook callback banque (ClicToPay/Zitouna). HMAC optionnel |
| 18 | `/api/public-documents/corrige-dnb-maths-2026` | GET | non | PDF public éducatif |
| 19 | `/api/reservation/verify` | POST | non | Vérifie existence réservation (retourne booléen) |
| 20 | `/api/stages` | GET | non | Catalogue stages publics du site vitrine |
| 21 | `/api/stages/[stageSlug]` | GET | non | Détail stage public |
| 22 | `/api/stages/[stageSlug]/inscrire` | POST | **oui** | Inscription stage anonyme. Voir audit ci-dessous |
| 23 | `/api/student/activate` | GET,POST | non (direct) | Activation compte via token email (token-based) |
| 24 | `/api/subscriptions/aria-addon` | POST | non | Déprécié : retourne 410 Gone immédiatement |
| 25 | `/api/subscriptions/change` | POST | non | Déprécié : retourne 410 Gone immédiatement |

### Audit détaillé des 4 routes publiques mutantes

#### 1. `/api/assessments/submit` — `assessment.create` + `domainScore.createMany`

| Contrôle | Détail |
|----------|--------|
| Rate-limit | `guardRateLimitAsync(request, { preset: 'expensive' })` → **10 req / heure par IP** |
| Validation | Zod strict : subject `z.nativeEnum(Subject)`, grade `z.enum(...)`, email/name/phone validés, answers `z.record(string, string)`, assessmentVersion regex `/^[a-z0-9_:-]{1,80}$/i` |
| Escalade | **Non** — aucune session créée, aucun rôle assigné. L'assessmentId (CUID) retourné est non devinable |
| Réponse | `{ success, assessmentId, redirectUrl, message }` — expose l'ID CUID uniquement |
| CSRF | Aucun (endpoint cross-origin par design pour formulaires publics) |
| CAPTCHA | Aucun |
| **Verdict** | **Rate-limit adéquat (10/h/IP)**. Pas d'escalade. Risque résiduel : pollution DB par rotation IP. Pas de chemin d'escalade vers des données sensibles |

#### 2. `/api/auth/resend-activation` — `user.update` (token activation)

| Contrôle | Détail |
|----------|--------|
| Rate-limit | Dual : `guardRateLimit(preset: 'resendActivation')` → **3 req / 15 min par IP** + throttle in-memory 15 min par email |
| Validation | Zod : `z.object({ email: z.string().email() })` |
| Escalade | **Non** — ne traite que les utilisateurs non activés (`activatedAt === null`). Déjà activés ignorés silencieusement |
| Réponse | Toujours `{ success: true, message: "Si ce compte existe..." }` — **anti-énumération** |
| Token | SHA-256 hashé avant stockage. Raw envoyé uniquement par email |
| **Verdict** | **SAFE** — double rate-limit, anti-énumération, tokens hashés |

#### 3. `/api/auth/reset-password` — `user.update` (password bcrypt-12)

| Contrôle | Détail |
|----------|--------|
| Rate-limit | `guardRateLimitAsync(preset: 'auth')` → **5 req / 15 min par IP** |
| CSRF | `checkCsrf(request)` — validation origin/referer |
| Body size | `checkBodySize(request)` — 1 MB max |
| Validation | Zod : email phase `z.string().email()`, confirm phase `z.string().min(8).refine(not in COMMON_PASSWORDS)` |
| Escalade | **Non** — token HMAC signé avec le hash du mot de passe actuel (single-use : invalide après changement) |
| Réponse | Anti-énumération : toujours `{ success: true, message: "Si un compte existe..." }` |
| **Verdict** | **SAFE** — CSRF + rate-limit + Zod + HMAC single-use + anti-énumération + bcrypt-12 |

#### 4. `/api/stages/[stageSlug]/inscrire` — `stageReservation.create`

| Contrôle | Détail |
|----------|--------|
| Rate-limit | `guardRateLimitAsync(preset: 'api', keySuffix: stage-inscrire:${slug})` → **60 req / min par IP par slug** |
| Validation | Zod `.strict()` : firstName/lastName min 2 max 50, email validé, phone max 30, level min 1 max 50, notes max 500 |
| Escalade | **Non** — crée uniquement StageReservation. Aucun compte utilisateur, aucune session, aucun rôle |
| Doublon | Check `unique: [email, academyId]` — empêche ré-inscription |
| Stage | Doit être `isOpen: true` ET `isVisible: true` |
| CSRF/CAPTCHA | Aucun |
| Réponse | `{ reservation: { status }, message }`. Sur 409 doublon : retourne `{ error, reservationId }` (fuite ID mineur) |
| **Verdict** | **CONCERN mineur** : rate-limit preset 'api' (60/min) est permissif pour un formulaire d'inscription. Pas de CSRF ni CAPTCHA. Risque : spam de fausses inscriptions (mais bloqué par contrainte unique email+stage). Pas de chemin d'escalade |

---

## (c) Dashboards par rôle

**Source** : `find app/dashboard -name 'page.tsx'` → 70 fichiers

### Hub partagé (2 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard` | Session (auth()) | — | Redirecteur par rôle |
| `/dashboard/trajectoire` | Trajectory, Bilan | — | Vue trajectoire (multi-rôle) |

### ELEVE (17 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard/eleve` | `/api/student/dashboard` (Student, SessionBooking, Bilan, Badge) | — | Dashboard principal (7 onglets : cockpit, eam, parcours, sessions, matières, bilans, stages) |
| `/dashboard/eleve/sessions` | — | — | Redirect → dashboard onglet sessions |
| `/dashboard/eleve/ressources` | — | — | Redirect → dashboard onglet ressources |
| `/dashboard/eleve/documents` | `/api/eleve/documents` (UserDocument) | — | Bibliothèque documents |
| `/dashboard/eleve/stages` | `/api/eleve/stages` (Stage, Bilan) | — | Mes bilans de stage |
| `/dashboard/eleve/bilans/[publicShareId]` | `/api/eleve/bilans/[id]` (Bilan) | — | Vue bilan individuel |
| `/dashboard/eleve/eam` | EamProgress | EamProgress | Module EAM |
| `/dashboard/eleve/automatismes` | AutomatismSeries, AutomatismQuestion | AutomatismAttempt | Entraînement automatismes |
| `/dashboard/eleve/nsi-pratique-2026` | NsiPracticeProgress | NsiPracticeProgress | Pratique NSI BAC |
| `/dashboard/eleve/npc` | CopySubmission, PedagogicalReport | — | Vue NPC élève |
| `/dashboard/eleve/programme/maths` | Curriculum JSON (lib/curriculum-data/) | — | Graphe compétences maths STMG |
| `/dashboard/eleve/programme/[subject]` | Curriculum JSON | — | Graphe compétences par matière |
| `/dashboard/eleve/stage-eam-stmg` | Stage (inscription) | — | Dashboard stage EAM STMG |
| `/dashboard/eleve/stage-eam-stmg/diagnostic` | Diagnostic questions | Bilan (diagnostic) | Diagnostic EAM STMG |
| `/dashboard/eleve/stage-eam-stmg/livret` | Livret content | Completion tracking | Livret stage EAM STMG |
| `/dashboard/eleve/questionnaires/eaf-stage-printemps` | `/api/eleve/questionnaire-eaf-stage-printemps` | Bilan (POST/PUT) | Questionnaire EAF (8 étapes) |
| `/dashboard/eleve/questionnaires/maths-premiere-stage-printemps` | `/api/eleve/questionnaire-maths-premiere-stage-printemps` | Bilan (POST/PUT) | Questionnaire maths (9 étapes) |

### PARENT (10 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard/parent` | `/api/parent/dashboard` (Student, Subscription, Payment, Badge) | — | Dashboard principal (3 onglets : enfants, facturation, alertes) |
| `/dashboard/parent/children` | — | — | Redirect → dashboard |
| `/dashboard/parent/enfant/[studentId]` | `/api/parent/enfant/[id]` (Student, Progress, Cohort) | — | Profil enfant avec progression |
| `/dashboard/parent/stages` | `/api/parent/stages` (Stage, Bilan) | — | Bilans de stage enfants |
| `/dashboard/parent/ressources` | UserDocument (shared) | — | Documents partagés |
| `/dashboard/parent/factures` | Invoice | — | Liste factures |
| `/dashboard/parent/paiement` | `/api/payments/check-pending` | Payment (POST initiate) | Sélection mode de paiement |
| `/dashboard/parent/paiement/confirmation` | Payment status | — | Confirmation paiement |
| `/dashboard/parent/abonnements` | `/api/parent/subscriptions` (Subscription, plans) | Subscription (change/cancel) | Gestion abonnements |
| `/dashboard/parent/npc` | CopySubmission, PedagogicalReport (filtrés par enfants) | — | Diagnostics NPC enfants |

### COACH (16 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard/coach` | `/api/coach/dashboard` + `/api/coach/students/eam-summary` | — | Dashboard principal (4 onglets : cohorte, planning, alertes, bilans) |
| `/dashboard/coach/students` | `/api/coach/dashboard` (Students, credits, bilans) | — | Liste élèves assignés |
| `/dashboard/coach/eleve/[studentId]` | `/api/coach/students/[id]/dossier` | — | Dossier élève |
| `/dashboard/coach/sessions` | Sessions (today + week) | SessionReport (POST) | Gestion séances + rapports |
| `/dashboard/coach/availability` | CoachAvailability | CoachAvailability (PATCH) | Disponibilités |
| `/dashboard/coach/stages` | Stage, StageCoach | StageBilan | Stages assignés + bilans |
| `/dashboard/coach/stages/[slug]/bilan/[studentId]` | Stage, Student, StageBilan | StageBilan (POST) | Éditeur bilan 3 onglets (élève/parent/interne) |
| `/dashboard/coach/npc` | CopySubmission (par statut) | — | Dashboard NPC coach |
| `/dashboard/coach/npc/reports/[reportId]` | PedagogicalReport, CompetenceMatrix, RemediationRoadmap | — | Vue rapport NPC |
| `/dashboard/coach/npc/submissions/[id]/upload` | CopySubmission, CopyPage | CopyPage (POST upload) | Upload copies |
| `/dashboard/coach/nsi-pratique-2026` | Student, NsiPracticeProgress | — | Suivi NSI cohorte |
| `/dashboard/coach/nsi-pratique-2026/[studentId]` | NsiPracticeProgress | NsiPracticeProgress | Progression NSI élève |
| `/dashboard/coach/eaf-stage-printemps` | Bilan (EAF) | Bilan (POST) | Bilans EAF stage |
| `/dashboard/coach/eaf-stage-printemps/[studentId]` | Bilan (EAF) | Bilan (PATCH) | Éditeur bilan EAF |
| `/dashboard/coach/maths-premiere-stage-printemps` | Bilan (maths) | Bilan (POST) | Bilans maths stage |
| `/dashboard/coach/maths-premiere-stage-printemps/[studentId]` | Bilan (maths) | Bilan (PATCH) | Éditeur bilan maths |

### ASSISTANTE (15 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard/assistante` | `/api/assistante/dashboard` | — | Dashboard (tâches urgentes) |
| `/dashboard/assistante/students` | Student, User (filtres, pagination) | Student, User (POST/PATCH/DELETE) | CRUD élèves |
| `/dashboard/assistante/students/[studentId]` | Student, CoachStudentAssignment | Student (PATCH) | Fiche élève |
| `/dashboard/assistante/coaches` | CoachProfile, CoachStudentAssignment | CoachProfile, User (POST/PATCH/DELETE) | CRUD coaches |
| `/dashboard/assistante/assignments` | CoachStudentAssignment | CoachStudentAssignment (POST/PATCH/DELETE) | Affectations coach-élève |
| `/dashboard/assistante/stages` | Stage | Stage (POST/PATCH/DELETE) | CRUD stages |
| `/dashboard/assistante/stages/planning` | StageSession, CoachAvailability | — | Planning des stages |
| `/dashboard/assistante/planning` | Session, CoachAvailability | — | Planning global |
| `/dashboard/assistante/subscriptions` | Subscription | Subscription (PATCH activate) | Abonnements |
| `/dashboard/assistante/subscription-requests` | SubscriptionRequest | SubscriptionRequest (PATCH approve/reject) | Demandes d'abonnement |
| `/dashboard/assistante/credits` | CreditTransaction | CreditTransaction (POST) | Gestion crédits |
| `/dashboard/assistante/credit-requests` | SubscriptionRequest (type CREDIT) | SubscriptionRequest (PATCH) | Demandes crédits |
| `/dashboard/assistante/paiements` | Payment | Payment (PATCH validate) | Validation paiements |
| `/dashboard/assistante/facturation` | Invoice | Invoice (POST/PATCH) | Facturation |
| `/dashboard/assistante/devis` | Pricing, Catalog | — (PDF generation) | Génération devis |
| `/dashboard/assistante/docs` | Statique | — | Documentation interne |

### ADMIN (9 pages)

| Route | Lit | Mute | Fonction |
|-------|-----|------|----------|
| `/dashboard/admin` | `/api/admin/dashboard` (User, Student, Payment, Subscription, SessionBooking, CreditTransaction) | — | Dashboard KPIs |
| `/dashboard/admin/users` | `/api/admin/users` (User) | User (POST/PATCH/DELETE, role change) | CRUD utilisateurs |
| `/dashboard/admin/subscriptions` | Subscription | Subscription (PATCH status/endDate) | Gestion abonnements |
| `/dashboard/admin/analytics` | `/api/admin/analytics` (Revenue, Users, Sessions, Credits) | — | Analytics (période) |
| `/dashboard/admin/activities` | `/api/admin/activities` (Activity log) | — | Journal activité |
| `/dashboard/admin/stages` | Stage | Stage (POST/PATCH/DELETE) | CRUD stages |
| `/dashboard/admin/facturation` | Invoice, Payment | Invoice (POST/PATCH), Payment (manual) | Facturation |
| `/dashboard/admin/tests` | Test config | — (POST run tests) | Interface tests système |
| `/dashboard/admin/documents` | Statique | — | Documentation interne |

---

## (d) Libs métier

**Source** : `lib/` → 236+ fichiers TypeScript

### SSOT (Single Source of Truth) — fichiers canoniques

| Fichier | Responsabilité | Consommateurs |
|---------|----------------|---------------|
| `data/pricing.canonical.json` | Tarifs 2026-2027.1 : formules annuelles, stages, ponctuels, packs, Carte Nexus, règles (acompte 30 %, 9 échéances, 5 % comptant, 20 % cap, Carte 10 %) | `lib/pricing.ts` → 20+ composants |
| `lib/entitlement/types.ts` | PRODUCT_REGISTRY (14 codes produit) : STAGE_*, PREMIUM_*, ABONNEMENT_*, CREDIT_PACK_*, ARIA_ADDON_* | `lib/entitlement/engine.ts` → 16+ fichiers |
| `lib/access/features.ts` | 10 features : platform_access, hybrid_sessions, immersion_mode, aria_maths, aria_nsi, ai_feedback, advanced_analytics, priority_support, credits_use, admin_facturation | `lib/access/rules.ts` → guard |
| `lib/rbac.ts` | 40+ policies par rôle, permissions action/resource | `lib/guards.ts` → 20+ routes |
| `lib/legal.ts` | Entité juridique (STE M&M ACADEMY), adresses, contact, banque (Zitouna RIB/IBAN), juridiction | 10+ fichiers (email, invoice, footer) |
| `lib/cgv-policy.ts` | CGV v1.0 (2026-03-01) : paiement, remboursements | Pages légales, order review |
| `lib/theme/tokens.ts` | Design tokens : couleurs, typo, espacement, ombres, transitions | `tailwind.config.mjs` → tous composants |
| `lib/rate-limit/presets.ts` | 7 presets rate-limit : auth (5/15min), api (60/min), expensive (10/h), ai (10/h), public (200/min) | 20+ routes API |

### Moteurs métier

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Pricing** | `lib/pricing.ts` | Chargeur `pricing.canonical.json` + règles (acompte, échéancier, remises, Carte) | 20+ |
| **Entitlement** | `lib/entitlement/{index,engine,types}.ts` | Activation (SINGLE/EXTEND/STACK), suspension, vérification entitlements | 16+ |
| **Access** | `lib/access/{index,features,rules,guard}.ts` | Feature gating dual-layer (RBAC + entitlements), fallback modes (HIDE/DISABLE/REDIRECT) | guard |
| **Guards** | `lib/guards.ts` | `requireAuth`, `requireRole`, `requireAnyRole`, ownership guards | 20+ routes |
| **Invoice** | `lib/invoice/{index,types,pdf,storage,sequence,transitions,access-token}.ts` | Lifecycle complet : DRAFT→SENT→PAID→ARCHIVED/CANCELLED, séquence, tokens, PDF, audit trail | 30+ |
| **Session Booking** | `lib/session-booking.ts` | Slots dispo, réservation, annulation | 3+ |
| **Rate Limit** | `lib/rate-limit/{index,presets,keys,memory-store}.ts` | DDoS/abus : memory/redis/upstash stores, IP/user keying | 20+ |

### Diagnostics & Évaluation

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Diagnostic Maths Term** | `lib/diagnostic/maths-terminale/{types,data,scoring}.ts` | QCM + open-ended, 11 niveaux pédagogiques, sourceVersion `maths_terminale_v1` | 5 routes |
| **Assessments Core** | `lib/assessments/{core,generators,questions,scoring,prompts}/` | Framework générique : question banks (Maths/NSI), scorers (Base/Maths/Nsi/Generic) | 10+ |
| **Diagnostics LLM** | `lib/diagnostics/{types,score-diagnostic,prompt-context,definitions/}.ts` | Évaluation LLM, skill mapping, définitions par matière/niveau | 3 routes |

### Coaching & Rapports

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Coach EAF** | `lib/coach/eaf-stage-printemps/{types,generate-parent-report,llm-report}.ts` | Bilan EAF 8 sections, rapport parent LLM, sourceVersion `coach_eaf_stage_printemps_v1` | 2 routes |
| **Coach Maths** | `lib/coach/maths-premiere-stage-printemps/{types,generate-parent-report}.ts` | Bilan maths post-stage, sourceVersion `coach_maths_premiere_stage_printemps_v1` | 2 routes |
| **Bilan Generation** | `lib/bilan-generation/{buildBilanPrompt,generateBilanWithMistral,saveGeneratedBilan,validateGeneratedBilan}.ts` | Pipeline LLM (Mistral) : context → prompt → validation → sauvegarde | 2 routes |
| **Reports Stage** | `lib/reports/stage/{buildReportContext,generateStructuredReportWithMistral,renderLatexPremiumReport,compileLatexToPdf}.ts` | Rapports premium LaTeX→PDF : context → Mistral → LaTeX → PDF | 2 routes |
| **NPC** | `lib/npc/{access,ai/*,config,storage,pdf-converter,file-validator,document-types}.ts` | Correction IA copies : OCR, diagnostic, matrice compétences, roadmap remédiation | 5 routes |

### IA & RAG

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **ARIA** | `lib/aria.ts` + `lib/aria/prompt.ts` | Assistant IA : OpenAI wrapper, RAG, conversation persistence, feedback | 5 routes |
| **ARIA Streaming** | `lib/aria-streaming.ts` | ReadableStream wrapper pour réponses ARIA | ARIA routes |
| **RAG Client** | `lib/rag-client.ts` | ChromaDB integration, recherche sémantique par matière | ARIA |
| **LLM Mistral** | `lib/llm/mistral.ts` | Client API Mistral | Bilan generation, reports |
| **Ollama** | `lib/ollama-client.ts` | Client LLM local (Ollama) | Fallback dev |

### Stages & Réservations

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Stages Public** | `lib/stages/public.ts` | Sérialisation publique, filtres, formatage prix/dates, compteurs réservation | 13+ |
| **Stages Admin** | `lib/stages/admin-schemas.ts` | Validation Zod admin | Admin routes |
| **Stages Capacity** | `lib/stages/capacity.ts` | Calcul places disponibles | Inscription |
| **Inscription** | `lib/stages/inscription-schema.ts` | Validation Zod inscription | Public route |

### Progression académique

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **NSI Pratique** | `lib/nsi-pratique-2026/{access,coach-summary,gating,progress-*,recommendations}.ts` | Module NSI BAC 2026 : grilles, patterns, flashcards, recommandations | 4 routes |
| **Survival** | `lib/survival/{qcm-bank,score-simulator,progress,reflexes,ritual-engine,phrases,types}.ts` | Mode survie : QCM, réflexes, rituels, simulation note | 5 routes |
| **Badges** | `lib/badges.ts` | Badges élève (ASSIDUITE/PROGRESSION/CURIOSITE) | Gamification |
| **Trajectory** | `lib/trajectory.ts` | Calcul trajectoire d'apprentissage | Coach route |
| **Credits** | `lib/credits.ts` | Gestion solde crédits élève | Sessions, crons |
| **Next Step** | `lib/next-step-engine.ts` | Moteur recommandation prochaine activité | `/api/me/next-step` |
| **Nexus Index** | `lib/nexus-index.ts` | Score composite Nexus Index™ | `/api/student/nexus-index` |

### Scoring & ML

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **SSN** | `lib/core/ssn/computeSSN.ts` | Score Standardisé Nexus (normalisation cohorte) | Learning Graph |
| **UAI** | `lib/core/uai/computeUAI.ts` | Identifiant établissement | Learning Graph |
| **ML Predict** | `lib/core/ml/predictSSN.ts` | Prédiction ML | ProjectionHistory |
| **Bilan Scoring** | `lib/bilan-scoring.ts` | Calcul de notes bilans | Bilans |

### Communication

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Email** | `lib/email.ts` | Nodemailer + 6 templates (welcome, credit expiry, reset, diagnostic invite, bank transfer, bilan ready) | 15+ routes |
| **Email Service** | `lib/email-service.ts` | Service structuré email (brand colors, templates) | Routes spécifiques |
| **Telegram** | `lib/telegram/client.ts` | Alertes Telegram | Réservations |
| **WhatsApp** | `lib/whatsapp.ts` | WhatsApp Business API | Notifications |

### Sécurité & Infrastructure

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Security** | `lib/security/{message-access,ownership,payment-catalog}.ts` | Contrôle d'accès fin | Routes spécifiques |
| **CSRF** | `lib/csrf.ts` | Tokens CSRF | Formulaires |
| **Security Headers** | `lib/security-headers.ts` | CSP + CORS | Middleware Next.js |
| **Env Validation** | `lib/env-validation.ts` | Schemas Zod pour process.env | Bootstrap |

### Utilitaires

| Module | Fichiers clés | Responsabilité | Consommateurs |
|--------|--------------|----------------|---------------|
| **Utils** | `lib/utils.ts` | `cn()` (clsx+tw-merge), `formatPrice()`, `formatDate()` | Partout |
| **Constants** | `lib/constants.ts` | Plans, packs, addons, crédits (depuis operational-catalog) | Dashboard, composants |
| **Operational Catalog** | `lib/operational-catalog.ts` | Metadata non-pricing (plans, addons, packs, coûts crédits) | Constants |
| **Validations** | `lib/validations.ts` + `lib/validation/*.ts` | Schemas Zod (users, sessions, payments, common) | Routes API |
| **Translations** | `lib/translations.ts` | Chaînes i18n | Composants |
| **Typography FR** | `lib/typography/fr.ts` | Règles typographiques françaises | Rendu texte |
| **Grade Utils** | `lib/utils/grade-utils.ts` | Helpers niveaux/filières | Routes, composants |
| **Subjects** | `lib/utils/subjects.ts` | Helpers matières | Routes, composants |
| **Prisma** | `lib/prisma.ts` | Singleton PrismaClient | Partout |
| **Logger** | `lib/logger.ts` | Logging structuré | Partout |
| **PDF** | `lib/pdf/{assessment-pdfkit,bilan-parent-pdfkit}.ts` | Génération PDF (PDFKit) | Export routes |
| **Quote PDF** | `lib/quote/pdf.ts` | Génération devis PDF | Assistante |
| **Devis Catalog** | `lib/assistante-devis-catalog.ts` | Catalogue offres pour devis | Assistante |
| **Jitsi** | `lib/jitsi.ts` | Salles vidéo Jitsi | Sessions vidéo |
| **API Helpers** | `lib/api/{errors,helpers,pagination}.ts` | Erreurs standardisées, pagination | Routes API |
| **Scopes** | `lib/scopes.ts` | Permission scopes (OAuth-like) | Auth |
| **CRM** | `lib/crm/contact-leads.ts` | Gestion leads | Contact |
| **Dashboard Payload** | `lib/dashboard/student-payload.ts` | Sérialisation dashboard élève | Dashboard routes |
| **Password Reset** | `lib/password-reset-token.ts` | Tokens reset + expiration | Auth |
| **Services** | `lib/services/student-activation.service.ts` | Lifecycle activation élève | Assistante, auth |

---



---

> **FIN DOC-1 v3** — Extraction déterministe, classification auth exhaustive, audit routes publiques.
> Scripts commitées dans `docs/architecture/restructuration/scripts/`.
> En attente de spot-check indépendant (≥ 8 modèles + ≥ 8 routes) avant DOC-2.
