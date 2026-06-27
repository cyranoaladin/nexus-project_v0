# Schéma Prisma — extraction déterministe

> Généré par `extract-schema.mjs` depuis `prisma/schema.prisma`
> Date : 2026-06-27

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

