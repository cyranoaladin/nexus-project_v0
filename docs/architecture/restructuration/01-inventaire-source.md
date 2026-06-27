# DOC-1 — Inventaire source

> Dénominateur = filesystem. Zéro interprétation, zéro assertion sans preuve dépôt.
> Date : 2026-06-27 | Branche : main | Commit : d8d432214

---

## Sommaire

- [Dénominateur reproductible](#dénominateur-reproductible)
- [(a) Schéma Prisma complet](#a-schéma-prisma-complet)
- [(b) Surface API](#b-surface-api)
- [(b-bis) Classification des 173 routes par schéma d'autorisation](#b-bis-classification-des-173-routes-par-schéma-dautorisation)
- [(c) Dashboards par rôle](#c-dashboards-par-rôle)
- [(d) Libs métier](#d-libs-métier)
- [Annexe : Spot-check DOC-1 vs code](#annexe--spot-check-doc-1-vs-code)

---

## Dénominateur reproductible

Commandes exactes pour vérifier les chiffres de cet inventaire. Toute personne peut les relancer sur le dépôt pour confirmer.

```bash
# Modèles Prisma
$ grep -cE '^model ' prisma/schema.prisma
64

# Enums Prisma
$ grep -cE '^enum ' prisma/schema.prisma
44

# Routes API
$ find app/api -name route.ts | wc -l
173

# Pages dashboard
$ find app/dashboard -name 'page.tsx' | wc -l
70
```

| Dénominateur | Commande | Résultat |
|-------------|---------|----------|
| Modèles Prisma | `grep -cE '^model ' prisma/schema.prisma` | **64** |
| Enums Prisma | `grep -cE '^enum ' prisma/schema.prisma` | **44** |
| Routes API | `find app/api -name route.ts \| wc -l` | **173** |
| Pages dashboard | `find app/dashboard -name 'page.tsx' \| wc -l` | **70** |

---

## (a) Schéma Prisma complet

**Source** : `prisma/schema.prisma`
**Provider** : PostgreSQL (extensions : pgvector)
**Statistiques** : 64 modèles, 44 enums

### Enums (44)

| Enum | Valeurs | Domaine |
|------|---------|---------|
| `UserRole` | ADMIN, ASSISTANTE, COACH, PARENT, ELEVE | Auth |
| `AssignmentType` | PRIMARY, SECONDARY, STAGE, TEMPORARY | Coaching |
| `AssignmentStatus` | ACTIVE, SUSPENDED, ENDED | Coaching |
| `SubscriptionStatus` | ACTIVE, INACTIVE, CANCELLED, EXPIRED | Abonnement |
| `PaymentType` | SUBSCRIPTION, CREDIT_PACK, SPECIAL_PACK | Paiement |
| `PaymentStatus` | PENDING, COMPLETED, FAILED, REFUNDED | Paiement |
| `InvoiceStatus` | DRAFT, SENT, PAID, CANCELLED | Facturation |
| `InvoicePaymentMethod` | CASH, BANK_TRANSFER, CHEQUE, CARD, CLICTOPAY | Facturation |
| `EntitlementStatus` | ACTIVE, SUSPENDED, EXPIRED, REVOKED | Accès |
| `Subject` | MATHEMATIQUES, NSI, FRANCAIS, PHILOSOPHIE, HISTOIRE_GEO, ANGLAIS, ESPAGNOL, PHYSIQUE_CHIMIE, SVT, SES | Académique |
| `GradeLevel` | TROISIEME, SECONDE, PREMIERE, TERMINALE, POSTBAC, AUTRE | Académique |
| `AcademicTrack` | COLLEGE, EDS_GENERALE, STMG, STI2D, ST2S, STL, STD2A, STMG_NON_LYCEEN | Académique |
| `StmgPathway` | RHC, MERCATIQUE, GF, SIG, INDETERMINE | Académique |
| `MathsLevel` | PREMIERE, TERMINALE | Académique |
| `ServiceType` | COURS_ONLINE, COURS_PRESENTIEL, ATELIER_GROUPE | Session |
| `SessionStatus` | SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED | Session |
| `SessionType` | INDIVIDUAL, GROUP, MASTERCLASS | Session |
| `SessionModality` | ONLINE, IN_PERSON, HYBRID | Session |
| `DocumentType` | COURS, EXERCICE, BILAN, CORRECTION, PLANNING, ANNEXE, AUTRE | Document |
| `DocumentVisibilityScope` | STUDENT_ONLY, STUDENT_AND_PARENT, STUDENT_AND_COACH, STUDENT_PARENT_COACH, ADMIN_ONLY | Document |
| `NotificationType` | SESSION_BOOKED, SESSION_CONFIRMED, SESSION_REMINDER, SESSION_CANCELLED, SESSION_RESCHEDULED, SESSION_COMPLETED, COACH_ASSIGNED, PAYMENT_REQUIRED | Notification |
| `NotificationStatus` | PENDING, SENT, DELIVERED, READ, FAILED | Notification |
| `NotificationMethod` | EMAIL, SMS, IN_APP, PUSH | Notification |
| `ReminderType` | ONE_DAY_BEFORE, TWO_HOURS_BEFORE, THIRTY_MINUTES_BEFORE, SESSION_STARTING | Notification |
| `EngagementLevel` | LOW, MEDIUM, HIGH | Session |
| `StageType` | INTENSIF, SEMAINE_BLANCHE, BILAN, GRAND_ORAL, BAC_FRANCAIS | Stage |
| `StageReservationStatus` | PENDING, CONFIRMED, WAITLISTED, CANCELLED, COMPLETED | Stage |
| `ContactLeadStatus` | NEW, CONTACTED, QUALIFIED, ENROLLED, LOST | CRM |
| `AssessmentStatus` | PENDING, SCORING, GENERATING, COMPLETED, FAILED | Évaluation |
| `BilanType` | DIAGNOSTIC_PRE_STAGE, ASSESSMENT_QCM, STAGE_POST, CONTINUOUS | Bilan |
| `BilanStatus` | PENDING, SCORING, GENERATING, COMPLETED, FAILED | Bilan |
| `CronExecutionStatus` | RUNNING, COMPLETED, FAILED | Système |
| `TrajectoryStatus` | ACTIVE, PAUSED, COMPLETED, ABANDONED | Trajectoire |
| `CopySubmissionStatus` | PENDING_UPLOAD, UPLOADED, PROCESSING_OCR, OCR_FAILED, READY_FOR_AI, QUEUED_FOR_ANALYSIS, ANALYZING, ANALYSIS_FAILED, COMPLETED, ARCHIVED | NPC |
| `AssessmentSourceType` | DS, DM, BILAN, STAGE, ANNALES, EXERCICE, COMPOSITION, AUTRE | NPC |
| `CopyPageStatus` | UPLOADED, PENDING_CONVERSION, CONVERTING, CONVERSION_FAILED, READY, PROCESSING, ERROR | NPC |
| `CorrectionDocumentType` | STUDENT_COPY, SUBJECT, OFFICIAL_CORRECTION, GRADING_RUBRIC, GRADING_INSTRUCTIONS, SUPPORTING_DOCUMENT | NPC |
| `AiJobType` | VISION_OCR, PEDAGOGICAL_DIAGNOSIS, COMPETENCE_MATRIX, REMEDIATION_ROADMAP, MENTOR_ADVICE | NPC |
| `AiJobStatus` | PENDING, QUEUED, CLAIMED, PROCESSING, RETRYING, COMPLETED, FAILED, CANCELLED | NPC |
| `AiJobPriority` | LOW, NORMAL, HIGH, URGENT | NPC |
| `PedagogicalReportStatus` | DRAFT, PENDING_VALIDATION, VALIDATED, SENT_TO_STUDENT, READ_BY_STUDENT, ARCHIVED | NPC |
| `ReportVisibility` | COACH_ONLY, COACH_AND_STUDENT, STUDENT_SUMMARY_ONLY | NPC |
| `FeedbackType` | TECHNICAL_ERROR, PEDAGOGICAL_INACCURACY, MISSING_REMEDIATION, OVERLY_GENERIC, STUDENT_MISUNDERSTOOD, COACH_DISAGREES, POSITIVE, OTHER | NPC |
| `GeneratedReportStatus` | PENDING, BUILDING_CONTEXT, LLM_GENERATING, LLM_VALIDATED, LATEX_RENDERING, PDF_READY, FAILED, NEEDS_REVIEW | Rapports |

### Modèles par domaine (64)

#### Domaine : Authentification & Utilisateurs (3 modèles)

**User**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| email | String @unique | |
| password | String? | |
| role | UserRole | |
| firstName, lastName | String? | |
| phone | String? | |
| activatedAt, activationToken, activationExpiry | DateTime?, String?, DateTime? | Activation élève |
| totpSecret, totpEnabledAt, totpBackupCodes, totpLastUsedAt | String?, DateTime?, String?, DateTime? | 2FA TOTP |
| createdAt, updatedAt | DateTime | |
- **FK entrantes** : ParentProfile, Student, CoachProfile (1:1), SessionBooking (×3 rôles), Payment, Entitlement, CoachAvailability, Message (×2), UserDocument (×2), CoachNote (×2), MathsProgress, EamProgress, NsiPracticeProgress, ClicToPayTransaction, StageDocument, CoachStudentAssignment
- **Mutée par** : `/api/auth/*`, `/api/student/activate`, `/api/admin/users`, `/api/assistante/students`, `/api/assistante/activate-student`, `/api/assistante/coaches/manage`
- **Mutée par cron** : aucun

**ParentProfile**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| userId | String @unique → User | |
| address, city, country | String? | country default "Tunisie" |
| bilanGratuitCompletedAt, bilanGratuitDismissedAt | DateTime? | Banner UX |
- **FK** : userId → User, children → Student[]
- **Mutée par** : `/api/bilan-gratuit`, `/api/bilan-gratuit/dismiss`

**CoachProfile**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| userId | String @unique → User | |
| pseudonym | String @unique | |
| title, tag, description, philosophy, expertise | String? | |
| subjects | Json (default []) | |
| availableOnline, availableInPerson | Boolean | |
- **FK** : userId → User ; relations sortantes → Session[], StudentReport[], SessionReport[], StageSession[], StageBilan[], StageCoach[], Bilan[], CoachStudentAssignment[], EafPreparationReport[], CopySubmission[], PedagogicalReport[], GeneratedPedagogicalReport[]
- **Mutée par** : `/api/assistante/coaches/manage`

#### Domaine : Élève (2 modèles)

**Student**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| parentId | String → ParentProfile | |
| userId | String @unique → User | |
| gradeLevel | GradeLevel | |
| academicTrack | AcademicTrack (default EDS_GENERALE) | |
| specialties | Subject[] | |
| stmgPathway | StmgPathway? | |
| survivalMode | Boolean (default false) | |
| survivalModeReason, survivalModeBy | String? | |
| credits | Int (default 0) | |
| totalSessions, completedSessions | Int | |
- **FK** : parentId → ParentProfile, userId → User ; relations sortantes → Subscription[], CreditTransaction[], Session[], AriaConversation[], StudentBadge[], StudentReport[], SubscriptionRequest[], SessionReport[], Trajectory[], SurvivalProgress?, Assessment[], ProgressionHistory[], ProjectionHistory[], StageReservation[], StageBilan[], Bilan[], CoachStudentAssignment[], EafPreparationReport[], CopySubmission[], PedagogicalReport[], GeneratedPedagogicalReport[]
- **Mutée par** : `/api/assistante/students`, `/api/coach/students/[id]/survival-mode`, `/api/admin/recompute-ssn`
- **Mutée par cron** : aucun

**CoachStudentAssignment**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| coachId → CoachProfile, studentId → Student | | |
| assignedById → User? | | |
| assignmentType | AssignmentType (default PRIMARY) | |
| status | AssignmentStatus (default ACTIVE) | |
| subjects | Subject[] | |
| notes | String? | |
| startsAt, endsAt | DateTime?, DateTime? | |
- **Mutée par** : `/api/assistante/assignments`

#### Domaine : Abonnement & Crédits (3 modèles)

**Subscription**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId → Student | | |
| planName | String | |
| monthlyPrice, creditsPerMonth | Int | |
| status | SubscriptionStatus | |
| ariaSubjects | Json (default []) | |
| ariaCost | Int (default 0) | |
- **Mutée par** : `/api/subscriptions/change`, `/api/subscriptions/aria-addon`, `/api/assistante/subscriptions`, `/api/admin/subscriptions`
- **Mutée par cron** : `allocateMonthlyCredits` (lecture seule — itère les ACTIVE)

**CreditTransaction**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId → Student | | |
| type | String (MONTHLY_ALLOCATION, PURCHASE, USAGE, REFUND, EXPIRATION) | |
| amount | Float | |
| sessionId | String? | |
| expiresAt | DateTime? | |
- **Mutée par** : `/api/sessions/cancel` (REFUND), `/api/sessions/book` (USAGE), `/api/assistante/students/credits` (PURCHASE)
- **Mutée par cron** : `expireOldCredits` (crée EXPIRATION), `allocateMonthlyCredits` (crée MONTHLY_ALLOCATION)

**SubscriptionRequest**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId → Student | | |
| requestType | String (PLAN_CHANGE, ARIA_ADDON, INVOICE_DETAILS) | |
| status | String (PENDING, APPROVED, REJECTED) | |
- **Mutée par** : `/api/parent/subscription-requests`, `/api/assistante/subscription-requests`

#### Domaine : Session & Booking (5 modèles)

**Session**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId → Student, coachId → CoachProfile? | | |
| type | ServiceType | |
| subject | Subject | |
| scheduledAt | DateTime | |
| duration | Int (minutes) | |
| creditCost | Float | |
| status | SessionStatus | |
| report, reportedAt | String?, DateTime? | |
- **Mutée par** : `/api/admin/stages/[id]/sessions`

**SessionBooking**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId, coachId, parentId? → User | | |
| subject | Subject | |
| scheduledDate | DateTime | |
| startTime, endTime | String | |
| status | SessionStatus | |
| type | SessionType (default INDIVIDUAL) | |
| modality | SessionModality (default ONLINE) | |
| meetingUrl, meetingId | String? | |
| creditsUsed | Int (default 1) | |
| studentAttended | Boolean?, coachAttended | Boolean | |
- **FK sortantes** : notifications → SessionNotification[], reminders → SessionReminder[], report → SessionReport?
- **Mutée par** : `/api/sessions/book`, `/api/sessions/cancel`

**SessionReport**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| sessionId @unique → SessionBooking | | |
| studentId → Student, coachId → CoachProfile | | |
| summary, topicsCovered, progressNotes, recommendations | String | |
| performanceRating | Int | |
| engagementLevel | EngagementLevel? | |
- **Mutée par** : `/api/coach/sessions/[sessionId]/report`

**SessionNotification** — lié à SessionBooking + User (unique: sessionId+userId+type+method)
- **Mutée par** : créé automatiquement lors du booking

**SessionReminder** — lié à SessionBooking (unique: sessionId+reminderType)
- **Mutée par** : créé automatiquement / cron potentiel

**CoachAvailability** — lié à User (coach) ; unique: coachId+dayOfWeek+startTime+endTime+specificDate
- **Mutée par** : `/api/coaches/availability`

#### Domaine : Paiement & Facturation (7 modèles)

**Payment**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| userId? → User | | |
| type | PaymentType | |
| amount | Float, currency | String (default TND) | |
| status | PaymentStatus | |
| method, externalId | String? | |
| termsVersion, termsAcceptedAt, termsAcceptedIp | String?, DateTime?, String? | CGV tracking |
| immediateExecution | Boolean | |
- **Unique** : [externalId, method]
- **Mutée par** : `/api/payments/*`, `/api/admin/invoices/[id]` (via transitions)

**ClicToPayTransaction** — lié à Payment + User ; orderId @unique
- **Mutée par** : `/api/payments/clictopay/*`

**Invoice**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| number | String @unique | |
| status | InvoiceStatus (machine à états : DRAFT→SENT→PAID ; CANCELLED terminal) | |
| customerName, customerEmail, customerAddress, customerId | String? | |
| issuerName, issuerAddress, issuerMF, issuerRNE | String | Legal |
| subtotal, discountTotal, taxTotal, total | Int (centimes) | |
| taxRegime | String (default TVA_NON_APPLICABLE) | |
| paymentMethod | InvoicePaymentMethod? | |
| paidAt, paidAmount, paymentReference | DateTime?, Int?, String? | |
| events | Json (audit trail immutable) | |
- **FK sortantes** : items → InvoiceItem[], accessTokens → InvoiceAccessToken[], entitlements → Entitlement[]
- **Mutée par** : `/api/admin/invoices`, `/api/admin/invoices/[id]`, `/api/admin/invoices/[id]/send`

**InvoiceItem** — lié à Invoice ; label, productCode, qty, unitPrice, total
- **Mutée par** : `/api/admin/invoices` (création)

**InvoiceSequence** — yearMonth @unique, current Int (compteur séquentiel)
- **Mutée par** : `/api/admin/invoices` (auto-incrémenté)

**InvoiceAccessToken** — lié à Invoice ; tokenHash @unique, expiresAt, revokedAt
- **Mutée par** : `/api/admin/invoices/[id]/send`

**Entitlement**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| userId → User | | |
| productCode | String | Réf. PRODUCT_REGISTRY (lib/entitlement/types.ts) |
| label | String | |
| status | EntitlementStatus | |
| startsAt, endsAt? | DateTime | |
| sourceInvoiceId? → Invoice | | |
| metadata | Json? | |
| suspendedAt, suspendReason, revokedAt | DateTime?, String?, DateTime? | |
- **Mutée par** : `activateEntitlements()` (via MARK_PAID sur Invoice), `suspendEntitlements()` (via CANCEL sur Invoice)

#### Domaine : ARIA (2 modèles)

**AriaConversation** — studentId → Student, subject, title?, messages → AriaMessage[]
- **Mutée par** : `/api/aria/chat`

**AriaMessage** — conversationId → AriaConversation, role, content, feedback?
- **Mutée par** : `/api/aria/chat`, `/api/aria/feedback`

#### Domaine : Gamification (2 modèles)

**Badge** — name @unique, description, category (ASSIDUITE/PROGRESSION/CURIOSITE), condition
- **Mutée par** : seeds / admin

**StudentBadge** — studentId → Student, badgeId → Badge ; unique [studentId, badgeId]
- **Mutée par** : `/api/aria/feedback` (déclenchement automatique), logique badges

#### Domaine : Rapports (2 modèles)

**StudentReport** — studentId → Student, coachId? → CoachProfile, title, content, period, averageGrade?
- **Mutée par** : pas de route identifiée (potentiellement legacy)

**GeneratedPedagogicalReport**
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| studentId → Student, coachId? → CoachProfile | | |
| subject, stageSlug?, kind | String | |
| promptVersion, templateVersion | String | |
| status | GeneratedReportStatus | |
| contextJson, llmJson, validatedJson | Json? | |
| latexSource | String? | |
| pdfUrl | String? | |
- **Unique** : [studentId, stageSlug, subject, kind, inputChecksum]
- **Mutée par** : `/api/coach/students/[id]/generated-reports`

#### Domaine : Stages (6 modèles)

**Stage** — slug @unique, title, type (StageType), subject[] (Subject[]), level[], startDate, endDate, capacity, priceAmount (Decimal), isVisible, isOpen
- **FK sortantes** : reservations, sessions, documents, bilans, coaches, canonicalBilans (→ Bilan)
- **Mutée par** : `/api/admin/stages`

**StageSession** — stageId → Stage, title, subject, startAt, endAt, coachId? → CoachProfile
- **Mutée par** : `/api/admin/stages/[id]/sessions`

**StageCoach** — stageId → Stage, coachId → CoachProfile, role? ; unique [stageId, coachId]
- **Mutée par** : `/api/admin/stages/[id]/coaches`

**StageDocument** — stageId → Stage, stageSessionId? → StageSession, uploadedById → User, fileUrl, fileType
- **Mutée par** : pas de route identifiée (potentiellement admin upload)

**StageBilan**
| Champ | Type | Notes |
|-------|------|-------|
| stageId → Stage, studentId → Student, coachId → CoachProfile | | |
| contentEleve, contentParent, contentInterne? | String (Text) | Trois vues |
| scoreGlobal? | Float | |
| domainScores | Json? | |
| strengths, areasForGrowth | String[] | |
| nextSteps | String? (Text) | Prochaines étapes |
| pdfUrl | String? | URL du PDF généré |
| isPublished, publishedAt | Boolean, DateTime? | |
- **Unique** : [stageId, studentId]
- **Mutée par** : `/api/stages/[stageSlug]/bilans`

**StageReservation**
| Champ | Type | Notes |
|-------|------|-------|
| parentName, studentName?, email, phone, classe | String | Données saisie publique |
| academyId, academyTitle | String | Référence stage |
| price | Float | |
| status | String (default PENDING) | Legacy |
| richStatus | StageReservationStatus? | Enum ajouté après |
| paymentStatus | PaymentStatus? | |
| activationToken | String? @unique | |
- **Unique** : [email, academyId]
- **Mutée par** : `/api/stages/[stageSlug]/inscrire`, `/api/stages/[stageSlug]/reservations/[id]/confirm`

#### Domaine : Contacts & CRM (1 modèle)

**ContactLead** — name, email, phone?, profile?, interest?, urgency?, source?, status (ContactLeadStatus)
- **Mutée par** : `/api/contact`

#### Domaine : Notification (1 modèle)

**Notification** — userId, userRole, type, title, message, data (Json), read (Boolean)
- **Mutée par** : `/api/notifications` (PATCH read), créée par logique interne

#### Domaine : Documents (1 modèle)

**UserDocument** — title, originalName, mimeType, sizeBytes, localPath @unique, documentType, visibilityScope, subject?, userId → User, uploadedById? → User
- **Mutée par** : `/api/admin/documents`, `/api/coach/students/[id]/documents`, `/api/assistante/students/[id]/documents`

#### Domaine : Diagnostic & Évaluation (5 modèles)

**Diagnostic** — publicShareId @unique, type, definitionKey?, studentFirstName/LastName/Email, data (Json), status, analysisResult?, analysisJson?, studentMarkdown?, parentsMarkdown?, nexusMarkdown?
- **Mutée par** : `/api/bilan-pallier2-maths`, `/api/bilan-pallier2-maths/retry`

**Assessment** — publicShareId @unique, subject, grade, studentEmail, studentName, answers (Json), scoringResult (Json?), globalScore?, status (AssessmentStatus), domainScores → DomainScore[], skillScores → SkillScore[]
- **Mutée par** : `/api/assessments/submit`

**DomainScore** — assessmentId → Assessment, domain, score
- **Mutée par** : `/api/assessments/submit` (créé avec Assessment)

**SkillScore** — assessmentId → Assessment, skillTag, score
- **Mutée par** : `/api/assessments/submit` (créé avec Assessment)

**Bilan** (modèle canonique de convergence)
| Champ | Type | Notes |
|-------|------|-------|
| id | String @id | |
| publicShareId | String @unique | |
| type | BilanType | |
| subject | String | |
| legacyDiagnosticId, legacyAssessmentId, legacyStageBilanId | String? @unique | Migration links |
| sourceData | Json? | Données brutes spécifiques au sourceVersion |
| studentId? → Student, stageId? → Stage, coachId? → CoachProfile | | |
| studentEmail, studentName | String | |
| globalScore?, confidenceIndex?, ssn?, uai? | Float? | Learning Graph v2 |
| domainScores | Json? | |
| studentMarkdown?, parentsMarkdown?, nexusMarkdown? | String? | 3 vues rendues |
| analysisJson | Json? | |
| status | BilanStatus | |
| sourceVersion | String? | Discriminant de version |
| engineVersion | String? | |
| ragUsed, ragCollections | Boolean, String[] | |
- **Mutée par** : `/api/bilans`, `/api/bilan-gratuit`, `/api/eleve/bilan-diagnostic-maths-terminale`, `/api/coach/students/[id]/bilan-diagnostic-maths-terminale`, `/api/coach/eaf-stage-printemps/students/[id]/report`, `/api/coach/maths-premiere-stage-printemps/students/[id]/report`, `/api/eleve/questionnaire-*`

#### Domaine : Learning Graph v2 (2 modèles)

**ProgressionHistory** — studentId → Student, ssn (Float), date
- **Mutée par** : `/api/admin/recompute-ssn`, logique SSN interne

**ProjectionHistory** — studentId → Student, ssnProjected, confidenceIndex, modelVersion, inputSnapshot (Json?)
- **Mutée par** : logique ML interne

#### Domaine : Trajectoire (1 modèle)

**Trajectory** — studentId → Student, title, targetScore?, horizon (3/6/12_MONTHS), status (TrajectoryStatus), milestones (Json)
- **Mutée par** : `/api/coach/trajectory`

#### Domaine : Progression académique (3 modèles)

**MathsProgress** — userId → User, level (MathsLevel), track (AcademicTrack), completedChapters[], masteredChapters[], totalXp, quizScore, comboCount, streak, diagnosticResults?, timePerChapter?, errorTags?, etc.
- **Unique** : [userId, level, track]
- **Mutée par** : `/api/programme/maths-1ere/progress`, `/api/programme/maths-terminale/progress`

**EamProgress** — userId @unique → User, checks (Json), quiz (Json)
- **Mutée par** : `/api/eam/progress`

**NsiPracticeProgress** — userId @unique → User, data (Json), version
- **Mutée par** : `/api/eleve/nsi-pratique-2026/progress`, `/api/coach/nsi-pratique-2026/students/[id]/progress`

#### Domaine : Coach Notes (1 modèle)

**CoachNote** — studentId, coachId → User, body, pinned (Boolean)
- **Mutée par** : `/api/coach/students/[id]/notes`

#### Domaine : Mode Survie (2 modèles)

**SurvivalProgress** — studentId @unique → Student, examDate, reflexesState (Json), phrasesState (Json), qcmAttempts, qcmCorrect, rituals (Json), notePotentielle?
- **Mutée par** : `/api/student/survival/*`

**SurvivalAttempt** — progressId → SurvivalProgress, itemType, itemId, correctAnswer, givenAnswer, isCorrect, timeSpentSec
- **Mutée par** : `/api/student/survival/reflexes/[id]/attempt`, `/api/student/survival/qcm/attempt`

#### Domaine : EAF Préparation (1 modèle)

**EafPreparationReport** — studentId → Student, coachId → CoachProfile, 11 champs textuels (linearReading, workPresentation, interview, oralExpression, writingMethod, languageMastery, literaryCulture, strengths, areasToImprove, nextSessionGoals, coachFreeComment ; tous String? @db.Text), status (default "DRAFT"), completionRatio (Int default 0), validatedAt (DateTime?), validatedBy (String?) ; unique [studentId, coachId]
- **Mutée par** : `/api/coach/students/[id]/eaf-preparation-report`

#### Domaine : NPC — Nexus Pedagogy Cockpit (8 modèles)

**CopySubmission** — studentId → Student, coachId? → CoachProfile, subject, gradeLevel?, title, status (CopySubmissionStatus), pages → CopyPage[], aiJob → AiProcessingJob?, report → PedagogicalReport?
- **Mutée par** : `/api/npc/submissions`

**AssessmentSource** — name, type (AssessmentSourceType), subject, gradeLevel?, isOfficialAnnale, year?
- **Mutée par** : `/api/npc/submissions` (référencé)

**CopyPage** — submissionId → CopySubmission, pageNumber, status (CopyPageStatus), documentType, originalFilePath, ocrText?, ocrConfidence?
- **Mutée par** : `/api/npc/submissions/[id]/documents`

**AiProcessingJob** — type (AiJobType), status (AiJobStatus), priority, copySubmissionId? → CopySubmission, inputData/outputData (Json?), retryCount, tokensUsed?
- **Mutée par** : `/api/npc/submissions/[id]/generate`

**PedagogicalReport** — copySubmissionId? → CopySubmission, studentId → Student, coachId? → CoachProfile, status (PedagogicalReportStatus), visibility (ReportVisibility), diagnostic (Json), strengths[], weaknesses[], competenceMatrix → CompetenceMatrix?, remediationRoadmap → RemediationRoadmap?
- **Mutée par** : `/api/npc/submissions/[id]/generate`

**CompetenceMatrix** — reportId @unique → PedagogicalReport, matrixData (Json), globalScore?, confidenceLevel?
- **Mutée par** : créée avec PedagogicalReport

**RemediationRoadmap** — reportId @unique → PedagogicalReport, title, description?, estimatedDuration?, tasks → RoadmapTask[]
- **Mutée par** : créée avec PedagogicalReport

**RoadmapTask** — roadmapId → RemediationRoadmap, title, description, order, type, resourceIds[], externalUrls[], isCompleted
- **Mutée par** : créée avec RemediationRoadmap

#### Domaine : Contenu pédagogique (1 modèle)

**PedagogicalContent** — title, content, subject, grade?, embedding_vector (pgvector), tags (Json)
- **Mutée par** : seeds / ingest RAG (pas de route API identifiée)

#### Domaine : Messagerie (1 modèle)

**Message** — senderId?, receiverId? → User, content, fileUrl?, readAt?
- **Mutée par** : `/api/messages/send`

#### Domaine : Audit & Système (2 modèles)

**CronExecution** — jobName, executionKey, status (CronExecutionStatus), startedAt, completedAt?, error?, metadata? ; unique [jobName, executionKey]
- **Mutée par cron** : `allocateMonthlyCredits`, `expireOldCredits`, `checkExpiringCredits`

**NpcAuditLog** — reportId? → PedagogicalReport, action, actorId, actorRole, entityType, entityId, details (Json?)
- **Mutée par** : opérations NPC (validation, feedback)

#### Domaine : Feedback NPC (1 modèle)

**ReportFeedback** — reportId → PedagogicalReport, submittedById, type (FeedbackType), comment?, severity?, isResolved
- **Mutée par** : opérations NPC

### Crons (source : `lib/cron-jobs.ts`)

| Job | Fréquence | Modèles mutés | Idempotent |
|-----|-----------|---------------|------------|
| `checkExpiringCredits` | Quotidien | CronExecution (lecture seule CreditTransaction) | Non (envoie emails) |
| `expireOldCredits` | Mensuel | CreditTransaction (crée EXPIRATION + met à 0), CronExecution | Oui (SERIALIZABLE) |
| `allocateMonthlyCredits` | Mensuel | CreditTransaction (crée MONTHLY_ALLOCATION), CronExecution | Oui (clé année-mois) |

---

## (b) Surface API

**Source** : `find app/api -name route.ts` → 173 fichiers
**Convention de garde** : `lib/guards.ts` exporte `requireAuth`, `requireRole`, `requireAnyRole` ; certaines routes utilisent `auth()` directement (session NextAuth) sans garde centralisée.

### Auth & Activation (5 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handler | OAuth/JWT auth | User (session) |
| `/api/auth/reset-password` | POST | Aucune (token) | Reset mot de passe | User |
| `/api/auth/resend-activation` | POST | Aucune (email) | Renvoyer activation | User |
| `/api/student/activate` | GET, POST | Token-based | Activer compte élève | User |
| `/api/notifications` | GET, PATCH | auth() | Lire/marquer notifications | Notification |

### Facturation & Paiements (11 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/admin/invoices` | GET, POST | requireRole(ADMIN) | CRUD factures | Invoice, InvoiceItem, InvoiceSequence |
| `/api/admin/invoices/[id]` | PATCH | auth() inline + canPerformStatusAction (ADMIN/ASSISTANTE) | Transitions statut (MARK_SENT/MARK_PAID/CANCEL) | Invoice, Entitlement, InvoiceAccessToken (révocation sur transitions terminales) |
| `/api/admin/invoices/[id]/send` | POST | auth + ADMIN/ASSISTANTE | Envoyer facture par email | Invoice, InvoiceAccessToken |
| `/api/invoices/[id]/pdf` | GET | auth + token dual-path | Télécharger PDF | — (lecture) |
| `/api/invoices/[id]/receipt/pdf` | GET | auth RBAC | Télécharger reçu | — (lecture) |
| `/api/payments/pending` | GET | requireAuth (ADMIN/ASSISTANTE) | Virements en attente | — (lecture) |
| `/api/payments/check-pending` | GET | auth (PARENT) | Vérifier paiement en cours | — (lecture) |
| `/api/payments/clictopay/init` | POST | auth | Initier paiement ClicToPay | Payment, ClicToPayTransaction |
| `/api/payments/clictopay/webhook` | POST | Aucune (webhook) | Callback ClicToPay | Payment, ClicToPayTransaction |
| `/api/payments/validate` | POST | auth | Valider paiement | Payment |
| `/api/payments/bank-transfer/confirm` | POST | auth | Confirmer virement | Payment |

### Sessions & Booking (7 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/sessions/book` | POST | auth | Réserver session | SessionBooking, CreditTransaction |
| `/api/sessions/cancel` | POST | requireAnyRole(ELEVE, COACH, ASSISTANTE) | Annuler session (politique 24h/48h) | SessionBooking, CreditTransaction |
| `/api/sessions/video` | GET, POST | auth | Gestion vidéo | SessionBooking |
| `/api/student/sessions` | GET | requireRole(ELEVE) | Mes sessions | — (lecture) |
| `/api/coach/sessions/[sessionId]/report` | POST | requireRole(COACH) | Rapport de session | SessionReport |
| `/api/coaches/availability` | GET, POST, DELETE | auth (COACH pour écriture) | Disponibilités coach | CoachAvailability |
| `/api/coaches/available` | GET | auth (ELEVE/PARENT) | Coaches disponibles | — (lecture) |

### Crédits & Abonnements (10 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/student/credits` | GET | requireRole(ELEVE) | Solde crédits | — (lecture) |
| `/api/assistante/students/credits` | GET, POST | requireRole(ASSISTANTE) | Gérer crédits | CreditTransaction |
| `/api/parent/credit-request` | POST | auth (PARENT) | Demande crédits | SubscriptionRequest |
| `/api/assistante/credit-requests` | GET, PATCH | requireRole(ASSISTANTE) | Traiter demandes crédits | SubscriptionRequest |
| `/api/subscriptions/change` | POST | auth | Changement formule | Subscription |
| `/api/subscriptions/aria-addon` | POST | auth | Ajouter addon ARIA | Subscription |
| `/api/parent/subscription-requests` | GET, POST | auth (PARENT) | Demandes abonnement | SubscriptionRequest |
| `/api/parent/subscriptions` | GET, POST | auth (PARENT) | Abonnements parent | Subscription |
| `/api/assistante/subscription-requests` | GET, POST, PATCH | requireRole(ASSISTANTE) | Traiter demandes abo | SubscriptionRequest |
| `/api/assistante/subscriptions` | GET, POST, PATCH | requireRole(ASSISTANTE) | Gérer abonnements | Subscription |

### Gestion Coach (12 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/coach/dashboard` | GET | requireRole(COACH) | Dashboard coach | — (lecture) |
| `/api/coach/students` | GET | requireRole(COACH) | Élèves assignés | — (lecture) |
| `/api/coach/students/[id]` | GET | requireRole(COACH) + assignment check | Profil élève | — (lecture) |
| `/api/coach/students/[id]/notes` | GET, POST | auth() inline ; GET: COACH/ADMIN, POST: COACH uniquement + `isCoachRattachedToStudent` | Notes privées | CoachNote |
| `/api/coach/students/[id]/survival-mode` | POST | auth (COACH/ADMIN/ASSISTANTE) | Activer/désactiver survie | Student, CoachNote |
| `/api/coach/students/[id]/documents` | GET, POST | auth (COACH) | Documents élève | UserDocument |
| `/api/coach/stages` | GET | requireRole(COACH) | Stages assignés | — (lecture) |
| `/api/coach/trajectory` | POST | auth (COACH/ADMIN) | Créer trajectoire | Trajectory |
| `/api/coach/students/eam-summary` | GET | requireRole(COACH) | Résumé EAM | — (lecture) |
| `/api/assistante/coaches` | GET | requireAnyRole(ADMIN, ASSISTANTE) | Lister coaches | — (lecture) |
| `/api/assistante/coaches/manage` | GET, POST, DELETE | requireRole(ASSISTANTE) | CRUD coaches | CoachProfile, User |
| `/api/assistante/coaches/manage/[id]` | GET, PATCH, DELETE | requireRole(ASSISTANTE) | Gérer un coach | CoachProfile, User |

### Gestion Élèves & Parents (16 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/student/documents` | GET | requireRole(ELEVE) | Mes documents | — (lecture) |
| `/api/student/documents/[id]/download` | GET | auth | Télécharger document | — (lecture) |
| `/api/admin/documents` | POST | requireAnyRole(ADMIN, ASSISTANTE) | Upload document | UserDocument |
| `/api/student/trajectory` | GET | auth (multi-rôle) | Trajectoire active | — (lecture) |
| `/api/student/nexus-index` | GET | auth (multi-rôle) | Score Nexus Index™ | — (lecture) |
| `/api/student/resources` | GET | requireRole(ELEVE) | Ressources | — (lecture) |
| `/api/parent/dashboard` | GET | requireRole(PARENT) | Dashboard parent | — (lecture) |
| `/api/parent/children` | GET | auth (PARENT) | Enfants du parent | — (lecture) |
| `/api/parent/stages` | GET | auth (PARENT) | Stages des enfants | — (lecture) |
| `/api/parent/bilans/[id]/pdf` | GET | auth (PARENT) | PDF bilan | — (lecture) |
| `/api/assistante/students` | GET, POST | requireRole(ASSISTANTE) | CRUD élèves | Student, User |
| `/api/assistante/students/[id]` | GET, PATCH, DELETE | requireRole(ASSISTANTE) | Gérer un élève | Student, User |
| `/api/assistante/students/[id]/documents` | GET, POST | requireRole(ASSISTANTE) | Documents élève | UserDocument |
| `/api/assistante/activate-student` | POST | requireRole(ASSISTANTE) | Activer compte élève | User |
| `/api/assistante/assignments` | GET, POST | requireAnyRole(ADMIN, ASSISTANTE) + RBAC `can(role, 'ASSIGN', 'COACH_ASSIGNMENT')` | Affectations coach-élève | CoachStudentAssignment |
| `/api/assistante/assignments/[id]` | GET, PATCH | requireAnyRole(ADMIN, ASSISTANTE) | Gérer affectation | CoachStudentAssignment |

### Stages & Réservations (16 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/stages` | GET | Public | Lister stages publics | — (lecture) |
| `/api/stages/[slug]` | GET | Public | Détail stage | — (lecture) |
| `/api/stages/[slug]/inscrire` | POST | Public | Inscription stage | StageReservation |
| `/api/stages/[slug]/bilans` | GET, POST | requireAnyRole(ADMIN, ASSISTANTE, COACH) | Bilans de stage | StageBilan |
| `/api/stages/[slug]/reservations` | GET | requireAnyRole | Réservations | — (lecture) |
| `/api/stages/[slug]/reservations/[id]/confirm` | POST | auth | Confirmer réservation | StageReservation |
| `/api/admin/stages` | GET, POST | requireRole(ADMIN) | CRUD stages admin | Stage |
| `/api/admin/stages/[id]` | GET, PATCH, DELETE | requireRole(ADMIN) | Gérer un stage | Stage |
| `/api/admin/stages/[id]/sessions` | GET, POST | requireRole(ADMIN) | Sessions de stage | StageSession |
| `/api/admin/stages/[id]/sessions/[sid]` | GET, PATCH, DELETE | requireRole(ADMIN) | Gérer session | StageSession |
| `/api/admin/stages/[id]/coaches` | GET, POST, DELETE | requireRole(ADMIN) | Affecter coaches | StageCoach |
| `/api/reservation/verify` | POST | Public | Vérifier réservation | — (lecture) |
| `/api/eleve/stages` | GET | requireRole(ELEVE) | Mes stages | — (lecture) |
| `/api/parent/stages` | GET | auth (PARENT) | Stages enfants | — (lecture) |
| `/api/assistante/stages` | GET | requireRole(ASSISTANTE) | Lister stages | — (lecture) |
| `/api/assistante/stages/planning` | GET | requireRole(ASSISTANTE) | Planning stages | — (lecture) |

### Diagnostics & Bilans (13 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/diagnostics/definitions` | GET | Public | Définitions diagnostics | — (lecture) |
| `/api/bilan-pallier2-maths` | POST | requireAnyRole(ELEVE, COACH, ADMIN, ASSISTANTE) | Créer diagnostic maths | Diagnostic |
| `/api/bilan-pallier2-maths/retry` | POST | requireAnyRole(ADMIN, ASSISTANTE, COACH) | Relancer LLM | Diagnostic |
| `/api/bilan-gratuit` | POST | auth | Bilan gratuit | Bilan, ParentProfile |
| `/api/bilan-gratuit/status` | GET | auth | Statut bilan gratuit | — (lecture) |
| `/api/bilan-gratuit/dismiss` | POST | auth (PARENT) | Masquer banner | ParentProfile |
| `/api/bilans` | GET, POST | auth | CRUD bilans | Bilan |
| `/api/bilans/[id]` | GET, PATCH, DELETE | auth | Gérer bilan | Bilan |
| `/api/bilans/[id]/export` | GET | auth | Export PDF | — (lecture) |
| `/api/bilans/generate` | POST | auth | Générer bilan | Bilan |
| `/api/eleve/bilan-diagnostic-maths-terminale` | GET, POST | requireRole(ELEVE) | Diagnostic maths terminale | Bilan |
| `/api/coach/students/[id]/bilan-diagnostic-maths-terminale` | GET, PATCH, POST | auth (COACH) | Vue/correction coach | Bilan |
| `/api/student/bilans/[publicShareId]` | GET | Public (share link) | Bilan partagé | — (lecture) |

### ARIA (3 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/aria/conversations` | GET | requireRole(ELEVE) | Historique conversations | — (lecture) |
| `/api/aria/chat` | POST | auth | Envoyer message ARIA | AriaConversation, AriaMessage |
| `/api/aria/feedback` | POST | requireRole(ELEVE) | Feedback sur réponse | AriaMessage, StudentBadge |

### Programmes & Progression (~25 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/programme/maths-1ere/progress` | GET | auth | Progression maths 1ère | — (lecture) |
| `/api/programme/maths-1ere/rag` | GET, POST | auth | RAG remediation | — |
| `/api/programme/maths-terminale/progress` | GET | auth | Progression maths Term | — (lecture) |
| `/api/programme/maths-1ere-stmg/progress` | GET | auth | Progression STMG | — (lecture) |
| `/api/programme/maths-1ere-stmg/rag` | POST | auth | RAG STMG | — |
| `/api/programme/maths-1ere-stmg/stage-progress` | GET | auth | Stage STMG | — (lecture) |
| `/api/eleve/questionnaire-maths-premiere-stage-printemps` | GET, POST | requireRole(ELEVE) | Questionnaire maths stage | Bilan |
| `/api/eleve/questionnaire-eaf-stage-printemps` | GET, POST | requireRole(ELEVE) | Questionnaire EAF stage | Bilan |
| `/api/coach/maths-premiere-stage-printemps/students` | GET | requireRole(COACH) | Élèves maths stage | — (lecture) |
| `/api/coach/maths-premiere-stage-printemps/students/[id]/report` | GET, POST | requireRole(COACH) | Rapport maths | Bilan |
| `/api/coach/maths-premiere-stage-printemps/students/[id]/regenerate-student` | POST | requireRole(COACH) | Regénérer rapport élève | Bilan |
| `/api/coach/maths-premiere-stage-printemps/students/[id]/regenerate-parent` | POST | requireRole(COACH) | Regénérer rapport parent | Bilan |
| `/api/coach/eaf-stage-printemps/students` | GET | requireRole(COACH) | Élèves EAF stage | — (lecture) |
| `/api/coach/eaf-stage-printemps/students/[id]/report` | GET, POST, PATCH | requireRole(COACH) | Rapport EAF | Bilan |
| `/api/coach/eaf-stage-printemps/students/[id]/report/regenerate` | POST | requireRole(COACH) | Regénérer EAF | Bilan |
| `/api/coach/students/[id]/eaf-preparation-report` | GET, POST, PATCH | auth (COACH) | Préparation EAF | EafPreparationReport |
| `/api/coach/students/[id]/eaf-preparation-report/validate` | POST | auth (COACH) | Valider EAF | EafPreparationReport |
| `/api/coach/nsi-pratique-2026/students` | GET | requireRole(COACH) | Élèves NSI | — (lecture) |
| `/api/coach/nsi-pratique-2026/students/[id]/progress` | GET, POST | requireRole(COACH) | Progression NSI | NsiPracticeProgress |
| `/api/eleve/nsi-pratique-2026/progress` | GET, POST | requireRole(ELEVE) | Ma progression NSI | NsiPracticeProgress |
| `/api/eam/progress` | GET, POST | auth | Progression EAM | EamProgress |
| `/api/coach/students/eam-summary` | GET | requireRole(COACH) | Résumé EAM cohorte | — (lecture) |
| `/api/student/survival/*` | GET, POST | requireRole(ELEVE) | Mode survie | SurvivalProgress, SurvivalAttempt |

### Assessments (5 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/assessments/submit` | POST | auth | Soumettre assessment | Assessment, DomainScore, SkillScore |
| `/api/assessments/[id]/status` | GET | auth | Statut assessment | — (lecture) |
| `/api/assessments/[id]/result` | GET | auth | Résultat | — (lecture) |
| `/api/assessments/[id]/export` | GET | auth | Export | — (lecture) |
| `/api/assessments/predict` | POST | auth | Prédiction IA | — (lecture) |

### NPC (6 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/npc/submissions` | GET, POST | auth | CRUD soumissions | CopySubmission |
| `/api/npc/submissions/[id]/generate` | POST | requireRole(COACH) | Générer rapport NPC | AiProcessingJob, PedagogicalReport, CompetenceMatrix, RemediationRoadmap |
| `/api/npc/submissions/[id]/documents` | GET, POST | auth | Documents soumission | CopyPage |
| `/api/npc/submissions/[id]/documents/[docId]` | GET, DELETE | auth | Gérer document | CopyPage |
| `/api/npc/uploads` | POST | auth | Upload fichier | — (filesystem) |
| `/api/npc/files/[...path]` | GET | Aucune | Télécharger fichier NPC | — (filesystem) |

### Rapports générés (5 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/coach/students/[id]/generated-reports` | GET, POST | requireRole(COACH) | CRUD rapports | GeneratedPedagogicalReport |
| `/api/coach/students/[id]/generated-reports/[rid]` | GET, PATCH, DELETE | requireRole(COACH) | Gérer rapport | GeneratedPedagogicalReport |
| `/api/coach/students/[id]/generated-reports/[rid]/generate` | POST | requireRole(COACH) | Lancer génération | GeneratedPedagogicalReport |
| `/api/coach/students/[id]/generated-reports/[rid]/regenerate` | POST | requireRole(COACH) | Regénérer | GeneratedPedagogicalReport |
| `/api/coach/students/[id]/generated-reports/[rid]/download` | GET | requireRole(COACH) | Télécharger PDF | — (lecture) |

### Admin Dashboards & Analytics (8 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/admin/dashboard` | GET | requireRole(ADMIN) | KPIs dashboard | — (lecture multi-modèles) |
| `/api/admin/analytics` | GET | requireRole(ADMIN) | Analytics détaillées | — (lecture) |
| `/api/admin/activities` | GET | requireRole(ADMIN) | Journal activité | — (lecture) |
| `/api/admin/users` | GET | requireRole(ADMIN) | Lister utilisateurs | — (lecture) |
| `/api/admin/users/search` | GET | auth (ADMIN/ASSISTANTE) | Recherche utilisateurs | — (lecture) |
| `/api/admin/subscriptions` | GET | requireRole(ADMIN) | Abonnements | — (lecture) |
| `/api/admin/recompute-ssn` | POST | requireRole(ADMIN) | Recalculer SSN | Student, ProgressionHistory |
| `/api/admin/directeur/stats` | GET | requireRole(ADMIN) | Stats direction | — (lecture) |

### Assistante Dashboard (4 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/assistante/dashboard` | GET | requireRole(ASSISTANTE) | Dashboard assistante | — (lecture) |
| `/api/assistante/planning` | GET | requireRole(ASSISTANTE) | Planning | — (lecture) |
| `/api/assistante/sessions` | GET | requireRole(ASSISTANTE) | Sessions | — (lecture) |
| `/api/assistante/quotes/pdf` | GET | requireRole(ASSISTANTE) | Générer devis PDF | — (lecture + PDF) |

### Messagerie & Contact (4 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/messages/send` | POST | auth | Envoyer message | Message |
| `/api/messages/conversations` | GET | auth | Conversations | — (lecture) |
| `/api/notify/email` | POST | Aucune (interne) | Email notification | — (email) |
| `/api/contact` | POST | Public | Formulaire contact | ContactLead |

### Système & Divers (6 routes)

| Route | Méthodes | Garde | Action | Modèles mutés |
|-------|----------|-------|--------|---------------|
| `/api/health` | GET | Aucune | Health check DB | — (lecture) |
| `/api/internal/health` | GET | Aucune | Health check interne | — (lecture) |
| `/api/me/next-step` | GET | auth | Prochaine action recommandée | — (lecture) |
| `/api/analytics/event` | POST | Aucune | Tracking analytics | — (analytics) |
| `/api/newsletter` | POST | Public | Inscription newsletter | — |
| `/api/admin/test-email` | GET, POST | auth (ADMIN/ASSISTANTE) | Tester config email | — (email) |

---

## (b-bis) Classification des 173 routes par schéma d'autorisation

**Objectif** : chiffres exacts par seau, somme = 173. Input direct de la matrice RBAC (DOC-4).

### Résumé

| Seau | Description | Compte |
|------|-------------|--------|
| **(a)** | Garde centralisée `lib/guards.ts` (`requireRole`, `requireAnyRole`, `requireAuth`) ou `lib/rbac.ts` (`enforcePolicy`) | **68** |
| **(b)** | `auth()` inline (NextAuth session, vérification rôle manuelle sans garde centralisée) | **80** |
| **(c)** | Public par design (pas d'authentification, justifié) | **25** |
| **(d)** | Aucune garde détectée (suspect — devrait probablement être protégé) | **0** |
| | **TOTAL** | **173** |

### (a) Garde centralisée — 68 routes

| # | Route | Méthodes | Expression de garde |
|---|-------|----------|---------------------|
| 1 | `/api/admin/activities` | GET | `requireRole(ADMIN)` |
| 2 | `/api/admin/analytics` | GET | `requireRole(ADMIN)` |
| 3 | `/api/admin/dashboard` | GET | `requireRole(ADMIN)` |
| 4 | `/api/admin/documents` | POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 5 | `/api/admin/stages` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE)` / `requireRole(ADMIN)` |
| 6 | `/api/admin/stages/[stageId]` | GET, PATCH, DELETE | `requireRole(ADMIN)` |
| 7 | `/api/admin/stages/[stageId]/coaches` | GET, POST, DELETE | `requireRole(ADMIN)` |
| 8 | `/api/admin/stages/[stageId]/sessions` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 9 | `/api/admin/stages/[stageId]/sessions/[sessionId]` | PATCH, DELETE | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 10 | `/api/admin/subscriptions` | GET, PUT | `requireRole(ADMIN)` |
| 11 | `/api/admin/users` | GET, POST, PATCH, DELETE | `requireRole(ADMIN)` |
| 12 | `/api/admin/users/search` | GET | `requireAnyRole(ADMIN)` |
| 13 | `/api/assistante/assignments` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 14 | `/api/assistante/assignments/[id]` | GET, PATCH | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 15 | `/api/assistante/coaches` | GET | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 16 | `/api/assistante/planning` | GET | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 17 | `/api/assistante/quotes/pdf` | POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 18 | `/api/assistante/sessions` | POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 19 | `/api/assistante/stages` | GET | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 20 | `/api/assistante/students` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 21 | `/api/assistante/students/[studentId]` | GET | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 22 | `/api/assistante/students/[studentId]/documents` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 23 | `/api/bilan-pallier2-maths` | POST, GET | `requireAnyRole(ADMIN, ASSISTANTE, COACH)` |
| 24 | `/api/bilan-pallier2-maths/retry` | POST | `requireAnyRole(ADMIN, ASSISTANTE, COACH)` |
| 25 | `/api/bilans` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE, COACH)` |
| 26 | `/api/bilans/[id]` | GET, PUT, DELETE | `requireAnyRole(...)` per method |
| 27 | `/api/bilans/[id]/export` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE, COACH, ELEVE, PARENT)` |
| 28 | `/api/bilans/generate` | POST, GET | `requireAnyRole(ADMIN, ASSISTANTE, COACH)` |
| 29 | `/api/coach/eaf-stage-printemps/students` | GET | `requireRole(COACH)` |
| 30 | `/api/coach/eaf-stage-printemps/students/[studentId]/report` | GET, POST, PATCH | `requireRole(COACH)` |
| 31 | `/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate` | POST | `requireRole(COACH)` |
| 32 | `/api/coach/maths-premiere-stage-printemps/students` | GET | `requireRole(COACH)` |
| 33 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent` | POST | `requireRole(COACH)` |
| 34 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student` | POST | `requireRole(COACH)` |
| 35 | `/api/coach/maths-premiere-stage-printemps/students/[studentId]/report` | GET, POST, PATCH | `requireRole(COACH)` |
| 36 | `/api/coach/nsi-pratique-2026/students` | GET | `requireAnyRole(COACH, ADMIN)` |
| 37 | `/api/coach/nsi-pratique-2026/students/[studentId]/progress` | GET | `requireAnyRole(COACH, ADMIN)` |
| 38 | `/api/coach/stages` | GET | `requireRole(COACH)` |
| 39 | `/api/coach/students` | GET | `requireRole(COACH)` |
| 40 | `/api/coach/students/[studentId]` | GET | `requireRole(COACH)` |
| 41 | `/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale` | GET, PATCH | `requireRole(COACH)` |
| 42 | `/api/coach/students/[studentId]/documents` | GET, POST | `requireRole(COACH)` |
| 43 | `/api/coach/students/[studentId]/eaf-preparation-report` | GET, PUT | `requireRole(COACH)` |
| 44 | `/api/coach/students/[studentId]/eaf-preparation-report/validate` | POST | `requireRole(COACH)` |
| 45 | `/api/coach/students/[studentId]/generated-reports` | GET, POST | `requireRole(COACH)` |
| 46 | `/api/coach/students/[studentId]/generated-reports/[reportId]/download` | GET | `requireRole(COACH)` |
| 47 | `/api/coach/students/[studentId]/generated-reports/[reportId]/generate` | POST | `requireRole(COACH)` (re-export) |
| 48 | `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | POST | `requireRole(COACH)` |
| 49 | `/api/eleve/bilan-diagnostic-maths-terminale` | GET, POST | `requireRole(ELEVE)` |
| 50 | `/api/eleve/nsi-pratique-2026/progress` | GET, PUT | `requireRole(ELEVE)` |
| 51 | `/api/eleve/questionnaire-eaf-stage-printemps` | GET, POST | `requireRole(ELEVE)` |
| 52 | `/api/eleve/questionnaire-maths-premiere-stage-printemps` | GET, POST | `requireRole(ELEVE)` |
| 53 | `/api/eleve/stages` | GET | `requireRole(ELEVE)` |
| 54 | `/api/internal/health` | GET | `enforcePolicy('admin.dashboard')` (lib/rbac) |
| 55 | `/api/parent/bilans/[id]/pdf` | GET | `requireRole(PARENT)` |
| 56 | `/api/parent/stages` | GET | `requireRole(PARENT)` |
| 57 | `/api/sessions/book` | POST | `requireAnyRole(PARENT, ELEVE)` |
| 58 | `/api/sessions/cancel` | POST | `requireAnyRole(ELEVE, COACH, ASSISTANTE)` |
| 59 | `/api/stages/[stageSlug]/bilans` | GET, POST | `requireAnyRole(ADMIN, ASSISTANTE, COACH)` |
| 60 | `/api/stages/[stageSlug]/reservations` | GET | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 61 | `/api/stages/[stageSlug]/reservations/[reservationId]/confirm` | POST | `requireAnyRole(ADMIN, ASSISTANTE)` |
| 62 | `/api/student/bilans/[publicShareId]` | GET | `requireRole(ELEVE)` |
| 63 | `/api/student/credits` | GET | `requireRole(ELEVE)` |
| 64 | `/api/student/dashboard` | GET | `requireRole(ELEVE)` |
| 65 | `/api/student/documents/[id]/download` | GET | `requireRole(ELEVE)` |
| 66 | `/api/student/resources/official/[slug]` | GET | `requireRole(ELEVE)` |
| 67 | `/api/student/sessions` | GET | `requireRole(ELEVE)` |
| 68 | `/api/student/stages` | GET | `requireRole(ELEVE)` |

### (b) Inline `auth()` — 80 routes

| # | Route | Méthodes | Expression auth |
|---|-------|----------|-----------------|
| 1 | `/api/admin/directeur/stats` | GET | `auth()` + ADMIN |
| 2 | `/api/admin/invoices` | POST, GET | `auth()` + ADMIN |
| 3 | `/api/admin/invoices/[id]` | PATCH | `auth()` + ADMIN/ASSISTANTE + `canPerformStatusAction` |
| 4 | `/api/admin/invoices/[id]/send` | POST | `auth()` + ADMIN/ASSISTANTE |
| 5 | `/api/admin/recompute-ssn` | POST | `auth()` + ADMIN |
| 6 | `/api/admin/test-email` | POST, GET | `auth()` + ADMIN/ASSISTANTE |
| 7 | `/api/aria/chat` | POST | `auth()` + session |
| 8 | `/api/aria/conversations` | GET | `auth()` + session |
| 9 | `/api/aria/feedback` | POST | `auth()` + session |
| 10 | `/api/assessments/[id]/export` | GET | `auth()` + session |
| 11 | `/api/assessments/[id]/result` | GET | `auth()` + session |
| 12 | `/api/assessments/[id]/status` | GET | `auth()` + session |
| 13 | `/api/assessments/predict` | POST | `auth()` + session |
| 14 | `/api/assessments/test` | GET | `auth()` + session |
| 15 | `/api/assistante/activate-student` | POST | `auth()` + ASSISTANTE |
| 16 | `/api/assistante/coaches/manage` | GET, POST | `auth()` + ASSISTANTE |
| 17 | `/api/assistante/coaches/manage/[id]` | PUT, DELETE | `auth()` + ASSISTANTE |
| 18 | `/api/assistante/credit-requests` | GET, POST | `auth()` + ASSISTANTE |
| 19 | `/api/assistante/dashboard` | GET | `auth()` + ASSISTANTE |
| 20 | `/api/assistante/students/credits` | GET, POST | `auth()` + ASSISTANTE |
| 21 | `/api/assistante/subscription-requests` | GET, PATCH | `auth()` + ASSISTANTE |
| 22 | `/api/assistante/subscriptions` | GET, POST | `auth()` + ASSISTANTE |
| 23 | `/api/bilan-gratuit/dismiss` | POST | `auth()` + session |
| 24 | `/api/bilan-gratuit/status` | GET | `auth()` + session |
| 25 | `/api/coach/dashboard` | GET | `auth()` + COACH |
| 26 | `/api/coach/sessions/[sessionId]/report` | POST, GET | `auth()` + COACH |
| 27 | `/api/coach/students/eam-summary` | GET | `auth()` + COACH |
| 28 | `/api/coach/students/[studentId]/dossier` | GET | `auth()` + rôle check |
| 29 | `/api/coach/students/[studentId]/notes` | GET, POST | `auth()` + GET: COACH/ADMIN, POST: COACH only |
| 30 | `/api/coach/students/[studentId]/survival-mode` | POST | `auth()` + COACH/ADMIN/ASSISTANTE |
| 31 | `/api/coach/trajectory` | POST | `auth()` + COACH |
| 32 | `/api/coaches/availability` | POST, GET, DELETE | `auth()` + COACH |
| 33 | `/api/coaches/available` | GET | `auth()` + session |
| 34 | `/api/documents/[id]` | GET | `auth()` + session |
| 35 | `/api/eam/progress` | GET, POST | `auth()` + ELEVE |
| 36 | `/api/invoices/[id]/pdf` | GET | `auth()` + dual-path (token ou RBAC) |
| 37 | `/api/invoices/[id]/receipt/pdf` | GET | `auth()` + session |
| 38 | `/api/me/next-step` | GET | `auth()` + session |
| 39 | `/api/messages/conversations` | GET | `auth()` + session |
| 40 | `/api/messages/send` | POST | `auth()` + session |
| 41 | `/api/notifications` | GET, PATCH | `auth()` + session |
| 42 | `/api/npc/files/[...path]` | GET | `auth()` + session |
| 43 | `/api/npc/submissions` | POST, GET | `auth()` + session |
| 44 | `/api/npc/submissions/[submissionId]/documents` | GET, POST | `auth()` + session |
| 45 | `/api/npc/submissions/[submissionId]/documents/[documentId]` | PATCH, DELETE | `auth()` + session |
| 46 | `/api/npc/submissions/[submissionId]/generate` | POST | `auth()` + session |
| 47 | `/api/npc/uploads` | POST | `auth()` + session |
| 48 | `/api/parent/children` | GET, POST | `auth()` + PARENT |
| 49 | `/api/parent/credit-request` | POST | `auth()` + PARENT |
| 50 | `/api/parent/dashboard` | GET | `auth()` + PARENT |
| 51 | `/api/parent/subscription-requests` | POST, GET | `auth()` + PARENT |
| 52 | `/api/parent/subscriptions` | GET, POST | `auth()` + PARENT |
| 53 | `/api/payments/bank-transfer/confirm` | POST | `auth()` + session |
| 54 | `/api/payments/check-pending` | GET | `auth()` + session |
| 55 | `/api/payments/clictopay/init` | POST | `auth()` + session |
| 56 | `/api/payments/pending` | GET | `auth()` + session |
| 57 | `/api/payments/validate` | POST | `auth()` + session |
| 58 | `/api/programme/maths-1ere/progress` | POST, GET | `auth()` + session |
| 59 | `/api/programme/maths-1ere/rag` | POST | `auth()` + session |
| 60 | `/api/programme/maths-1ere-stmg/progress` | POST, GET | `auth()` + session |
| 61 | `/api/programme/maths-1ere-stmg/rag` | POST | `auth()` + session |
| 62 | `/api/programme/maths-1ere-stmg/stage-progress` | GET, POST | `auth()` + session |
| 63 | `/api/programme/maths-terminale/progress` | POST, GET | `auth()` + session |
| 64 | `/api/reservation` | GET, PATCH | `auth()` + ADMIN/ASSISTANTE (POST est public, compté en seau c) |
| 65 | `/api/sessions/video` | POST | `auth()` + session |
| 66 | `/api/student/automatismes/attempts` | POST, GET | `auth()` + session |
| 67 | `/api/student/automatismes/attempts/[id]` | GET | `auth()` + session |
| 68 | `/api/student/automatismes/check-answer` | POST | `auth()` + session |
| 69 | `/api/student/automatismes/series` | GET | `auth()` + session |
| 70 | `/api/student/automatismes/series/[id]` | GET | `auth()` + session |
| 71 | `/api/student/documents` | GET | `auth()` + session |
| 72 | `/api/student/nexus-index` | GET | `auth()` + session |
| 73 | `/api/student/resources` | GET | `auth()` + session |
| 74 | `/api/student/survival/phrases/[phraseId]/copied` | POST | `auth()` + session |
| 75 | `/api/student/survival/progress` | GET, POST | `auth()` + session |
| 76 | `/api/student/survival/qcm/attempt` | POST | `auth()` + session |
| 77 | `/api/student/survival/reflexes/[reflexId]/attempt` | POST | `auth()` + session |
| 78 | `/api/student/survival/ritual` | GET | `auth()` + session |
| 79 | `/api/student/trajectory` | GET | `auth()` + session |
| 80 | `/api/students/[studentId]/badges` | GET | `auth()` + session |

### (c) Public par design — 25 routes

| # | Route | Méthodes | Justification |
|---|-------|----------|---------------|
| 1 | `/api/auth/[...nextauth]` | GET, POST | Handler NextAuth — EST le mécanisme d'authentification |
| 2 | `/api/auth/resend-activation` | POST | Utilisateur non authentifié demande renvoi (rate-limited) |
| 3 | `/api/auth/reset-password` | POST | Reset mot de passe, non authentifié (rate-limited) |
| 4 | `/api/bilan-gratuit` | POST | Formulaire bilan gratuit public (CSRF + rate-limited) |
| 5 | `/api/contact` | POST | Formulaire contact site public (rate-limited) |
| 6 | `/api/newsletter` | POST | Inscription newsletter publique (rate-limited) |
| 7 | `/api/health` | GET | Healthcheck monitoring |
| 8 | `/api/diagnostics/definitions` | GET | Metadata safe, pas de données sensibles |
| 9 | `/api/stages` | GET | Liste stages publics du site vitrine |
| 10 | `/api/stages/[stageSlug]` | GET | Détail stage public |
| 11 | `/api/stages/[stageSlug]/inscrire` | POST | Inscription stage visiteur anonyme (rate-limited) |
| 12 | `/api/public-documents/corrige-dnb-maths-2026` | GET | PDF téléchargeable publiquement |
| 13 | `/api/reservation` | POST | Réservation formulaire public (CSRF + honeypot + rate-limited) |
| 14 | `/api/reservation/verify` | POST | Vérification code réservation sans session |
| 15 | `/api/student/activate` | GET, POST | Activation compte via token email (token-based) |
| 16 | `/api/payments/clictopay/webhook` | POST | Callback processeur paiement (HMAC optionnel) |
| 17 | `/api/analytics/event` | POST | Ingestion analytics côté client (stub no-op) |
| 18 | `/api/subscriptions/aria-addon` | POST | Déprécié : retourne 410 Gone immédiatement |
| 19 | `/api/subscriptions/change` | POST | Déprécié : retourne 410 Gone immédiatement |
| 20 | `/api/notify/email` | POST | Notification email server-side (CSRF + rate-limited, pas de destinataire user-controlled) |
| 21 | `/api/assessments/submit` | POST | Soumission assessment universel (rate-limited, tracking IP) |
| 22 | `/api/lamis/attempt` | POST | Enregistrement tentative LAMIS (pas de persistence DB) |
| 23 | `/api/lamis/exercises` | GET | Catalogue exercices LAMIS (données statiques) |
| 24 | `/api/lamis/export` | POST | Export CSV depuis données client (stateless) |
| 25 | `/api/lamis/progress` | POST | Calcul progression depuis données client (stateless) |

### (d) Aucune garde détectée (suspect) — 0 routes

Aucune route identifiée sans garde qui devrait en avoir une. Toutes les routes sans auth tombent dans le seau (c) avec justification.

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

## Annexe : Spot-check DOC-1 vs code

5 routes API + 5 modèles Prisma vérifiés côte à côte contre le code source. Les écarts identifiés ont été corrigés dans cette version du document.

### Routes API

| # | Route | DOC-1 (v1) | Code réel | Verdict | Correction |
|---|-------|-----------|-----------|---------|------------|
| 1 | `/api/sessions/cancel` | POST, `requireAnyRole(ELEVE, COACH, ASSISTANTE)`, mute SessionBooking + CreditTransaction | Identique | MATCH | — |
| 2 | `/api/assistante/assignments` | GET+POST, `requireRole(ASSISTANTE)` | `requireAnyRole(ADMIN, ASSISTANTE)` + RBAC `can()` | MISMATCH | Corrigé : ADMIN ajouté |
| 3 | `/api/coach/students/[id]/notes` | GET+POST, auth COACH/ADMIN | POST restreint COACH uniquement + `isCoachRattachedToStudent` | MISMATCH | Corrigé : distinction GET/POST |
| 4 | `/api/stages/[slug]/inscrire` | POST, Public, mute StageReservation | Identique | MATCH | — |
| 5 | `/api/admin/invoices/[id]` | PATCH, `canPerformStatusAction`, mute Invoice + Entitlement | Mute aussi InvoiceAccessToken (révocation sur transitions terminales) | MISMATCH | Corrigé : InvoiceAccessToken ajouté |

### Modèles Prisma

| # | Modèle | DOC-1 (v1) | Code réel | Verdict | Correction |
|---|--------|-----------|-----------|---------|------------|
| 6 | CoachStudentAssignment | Champs, FK, relations | Identique (createdAt/updatedAt omis = boilerplate standard) | MATCH | — |
| 7 | Entitlement | Champs, FK, relations | Identique | MATCH | — |
| 8 | StageBilan | Champs listés | Manque `nextSteps` (String?) et `pdfUrl` (String?) | MISMATCH | Corrigé : 2 champs ajoutés |
| 9 | EafPreparationReport | « 9 champs textuels » | 11 champs textuels + `validatedAt`/`validatedBy` manquants | MISMATCH | Corrigé : 11 champs, validatedAt/By ajoutés |
| 10 | CronExecution | Champs, unique constraint | Identique | MATCH | — |

### Bilan spot-check

- **5/10 MATCH, 5/10 MISMATCH (v1)**
- **Pattern** : omissions (champs secondaires, rôles additionnels, side-effects) — jamais de fabrication
- **Sévérité** : 1 medium (StageBilan), 4 low
- **Tous les écarts ont été corrigés dans cette version**
- **Implication** : le pattern d'omission signifie que d'autres entrées peuvent avoir des lacunes similaires (champs mineurs, rôles secondaires). DOC-1 reste fiable pour les flux principaux mais ne doit pas être considéré comme exhaustif au niveau champ pour les modèles non spot-checkés.

---

> **FIN DOC-1** — En attente de validation avant DOC-2.
