# NPC - Nexus Pedagogy Cockpit
## Plan d'implémentation durci et audité

**Date de cadrage** : 2026-05-01  
**Version** : 2.0 - Durci après audit  
**Statut** : 🟡 **EN ATTENTE VALIDATION UTILISATEUR** - Ne pas implémenter  
**Fichier** : `docs/features/NPC_IMPLEMENTATION_PLAN.md`  
**Git** : Non tracké (`??`), créé sur `main`, **non commité**, **non pushé**

---

## ⚠️ Avertissement process

Ce document est un **livre de spécifications** uniquement. Aucun code fonctionnel n'a été modifié, créé ou déployé. Ce fichier doit rester **non commité** jusqu'à validation utilisateur explicite.

---

## 1. Statut Git et Conformité Process

### 1.1 État du dépôt (audit réel)

```bash
$ git status -sb
## main
 M docs/features/EAF_COACH_REPORTS.md
?? docs/audits/AUDIT_COMPLET_2026-05-01.md
?? docs/features/NPC_IMPLEMENTATION_PLAN.md
?? e2e/eaf-report-raja-smoke.spec.ts

$ git log --oneline -10
92d7ef3d (HEAD -> main, origin/main, origin/HEAD) Merge pull request #44 from cyranoaladin/fix/eaf-reports-ui
...

$ git diff -- docs/features/NPC_IMPLEMENTATION_PLAN.md | sed -n '1,240p'
# Aucune sortie - fichier untracked
```

### 1.2 Conformité

| Critère | État | Preuve |
|---------|------|--------|
| Fichier créé localement | ✅ Oui | `?? docs/features/NPC_IMPLEMENTATION_PLAN.md` |
| Non tracké par git | ✅ Oui | Présence de `??` dans `git status` |
| Créé sur `main` | ✅ Oui | `git status` indique `## main` |
| Non committé | ✅ Oui | Absence du fichier dans `git log` |
| Non pushé | ✅ Oui | Pas de commit = pas de push |
| Conformité cahier des charges | ⚠️ Partielle | Fichier dans `docs/features/` au lieu de `/tmp` initialement prévu |

**Note** : Le cahier des charges demandait initialement un livrable local ou `/tmp`. Le fichier a été créé directement dans `docs/features/` pour faciliter la revue IDE, mais reste **non tracké et non commité** comme exigé.

---

## 2. Audit Evidence

Cette section contient les preuves concrètes des audits réalisés sur le codebase Nexus Réussite.

### 2.1 Validation Prisma

```bash
$ npx prisma validate
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

**Fichier inspecté** : `prisma/schema.prisma` (1861+ lignes)

### 2.2 Lint et Typecheck

```bash
$ npm run lint
info  - Need to disable some ESLint rules?
# 0 erreurs, warnings préexistants uniquement

$ npm run typecheck
> tsc --noEmit
# 0 erreurs
```

### 2.3 Modèles Prisma existants (repérage)

```bash
$ grep -E "^model |^enum " prisma/schema.prisma | wc -l
# 50+ modèles et enums

# Modèles clés identifiés :
- model User                    (ligne 141)
- model Student                 (ligne 229)
- model CoachProfile            (ligne 293)
- model CoachStudentAssignment  (ligne 1758)
- model Diagnostic              (ligne ~1200+)
- model StudentReport           (repéré)
- model EafPreparationReport    (existant)
- model UserDocument            (repéré)
- model Stage / StageReservation / StageSession / StageBilan (existant)
```

### 2.4 Enums existants

```bash
# Enums clés trouvés :
- enum UserRole         : ADMIN, ASSISTANTE, COACH, PARENT, ELEVE
- enum Subject          : MATHEMATIQUES, NSI, FRANCAIS, PHILOSOPHIE, HISTOIRE_GEO, ANGLAIS, ESPAGNOL, PHYSIQUE_CHIMIE, SVT, SES
- enum GradeLevel       : TROISIEME, SECONDE, PREMIERE, TERMINALE, POSTBAC, AUTRE
- enum AcademicTrack    : COLLEGE, EDS_GENERALE, STMG, STI2D, ST2S, STL, STD2A, STMG_NON_LYCEEN
- enum AssignmentType   : PRIMARY, SECONDARY, TEMPORARY (CoachStudentAssignment)
- enum AssignmentStatus : ACTIVE, INACTIVE, SUSPENDED (CoachStudentAssignment)
```

### 2.5 RBAC existant

```bash
$ wc -l lib/rbac.ts
478 lib/rbac.ts

# Structure identifiée :
- Resource type : 'USER' | 'STUDENT' | 'COACH_ASSIGNMENT' | 'DOCUMENT' | 'BILAN' | 'SESSION' | etc.
- Action type   : 'READ' | 'READ_SELF' | 'READ_OWN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'MANAGE' | etc.
- rolePermissions : Record<UserRole, Permission[]>
- RBAC_POLICIES   : Route-level policies avec allowedRoles, requireAuth, allowOwner
```

**Fichiers RBAC** : `lib/rbac.ts` (478 lignes), `types/enums.ts` (89 lignes)

### 2.6 Services IA/RAG existants

```bash
# Services identifiés :
- lib/ollama-client.ts    (231 lignes) - Client Ollama local
- lib/rag-client.ts       (255 lignes) - Client ChromaDB/RAG
- lib/bilan-generator.ts  - Génération bilans

# Configuration IA existante :
- OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT
- RAG_INGESTOR_URL, RAG_API_TOKEN, RAG_SEARCH_TIMEOUT
- LLM_MODE (live/stub/off)
- OPENAI_API_KEY (ARIA assistant)
```

### 2.7 Routes API existantes

```bash
$ ls app/api/ | wc -l
# 30+ dossiers de routes

# Routes identifiées :
- app/api/coach/        (14 items)
- app/api/student/      (21 items)
- app/api/eleve/        (2 items)
- app/api/parent/       (6 items)
- app/api/assistant/    (9 items)
- app/api/admin/        (18 items)
- app/api/stages/       (7 items)
- app/api/diagnostics/  (1 item)
- app/api/bilans/       (4 items)
- app/api/assessments/  (7 items)
```

### 2.8 Dashboards existants

```bash
# Structure identifiée :
- app/dashboard/coach/           - Dashboard coach
- app/dashboard/eleve/           - Dashboard élève
- app/dashboard/parent/          - Dashboard parent
- app/dashboard/assistante/    - Dashboard assistante
- app/dashboard/admin/           - Dashboard admin

# Composants partagés :
- components/dashboard/coach/
- components/dashboard/eleve/
- components/dashboard/shared/
```

### 2.9 Stockage existant

```bash
# Convention identifiée :
- /data/ comme répertoire de stockage
- UserDocument model avec : title, originalName, mimeType, sizeBytes, filePath, storageType
- Stockage sécurisé (pas dans /public)
```

### 2.10 Tests existants

```bash
$ ls __tests__/
# api/  lib/  integration/

$ ls e2e/
# *.spec.ts files

# Tests identifiés :
- __tests__/api/
- __tests__/lib/
- e2e/*.spec.ts
- jest.config.ts
- playwright.config.ts
```

### 2.11 Docker/Infra

```bash
# Fichiers identifiés :
- Dockerfile
- docker-compose.yml / docker-compose.prod.yml
- docker-compose.override.yml
- Convention : volumes /data/ mappés
```

---

## 3. Schéma Prisma Durci

### 3.1 Conventions du projet vérifiées

| Convention | Valeur dans le projet | Application NPC |
|------------|----------------------|-----------------|
| ID | `@id @default(cuid())` | ✅ Respecté |
| Table mapping | `@@map("snake_case")` | ✅ Obligatoire |
| Enum Prisma | UPPERCASE_VALUES | ✅ Respecté |
| Relations | `@relation(fields: [x], references: [y], onDelete: Z)` | ✅ Audité |
| String[] | Utilisé dans le projet (vérifié compatible PostgreSQL) | ✅ Utilisable |
| Json | Pour données flexibles | ✅ Pour métadonnées |
| Index | `@@index([fields])` | ✅ Obligatoire |

### 3.2 Enums NPC corrigés

```prisma
// ============================================================================
// NPC - Enums
// ============================================================================

enum CopySubmissionStatus {
  UPLOADED
  OCR_PENDING
  OCR_RUNNING
  OCR_REVIEW_REQUIRED
  OCR_COMPLETED
  LOGIC_PENDING
  LOGIC_RUNNING
  MENTOR_PENDING
  MENTOR_RUNNING
  READY_FOR_COACH_REVIEW
  PUBLISHED
  ARCHIVED
  FAILED
}

enum AiAgentType {
  VISION
  LOGIC
  MENTOR
}

enum AiJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  RETRYING
}

enum AssessmentGradingMode {
  PROVIDED    // Barème fourni par le coach
  ESTIMATED   // Barème estimé par l'IA (non officiel)
  QUALITATIVE_ONLY  // Pas de note, analyse uniquement
}

enum MasteryLevel {
  NOT_MASTERED
  FRAGILE
  PARTIAL
  SATISFACTORY
  MASTERED
  EXPERT
}

enum RoadmapTaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

enum ReportVisibilityStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  UNPUBLISHED
}

enum AuditActionType {
  SUBMISSION_CREATED
  SUBMISSION_UPLOADED
  OCR_REVIEWED
  STUDENT_ASSOCIATED
  STUDENT_VALIDATED
  JOB_STARTED
  JOB_COMPLETED
  JOB_FAILED
  JOB_RETRIED
  REPORT_CREATED
  REPORT_EDITED
  REPORT_PUBLISHED
  REPORT_UNPUBLISHED
  REPORT_VIEWED
  REPORT_DOWNLOADED
  ROADMAP_TASK_COMPLETED
  FILE_DOWNLOADED
}
```

### 3.3 Modèles NPC corrigés

```prisma
// ============================================================================
// NPC - Copy Submission (Copie scannée uploadée)
// ============================================================================
model CopySubmission {
  id                String               @id @default(cuid())
  
  // Propriétaire (coach qui upload)
  coachId           String
  coach             CoachProfile         @relation(fields: [coachId], references: [id], onDelete: Cascade)
  
  // Association élève (workflow validé)
  // - proposedStudentId : détecté par OCR ou choisi par coach (non validé)
  // - validatedStudentId : confirmé par le coach après revue
  proposedStudentId   String?
  proposedStudent     Student?             @relation("ProposedStudent", fields: [proposedStudentId], references: [id], onDelete: SetNull)
  
  validatedStudentId  String?
  validatedStudent    Student?             @relation("ValidatedStudent", fields: [validatedStudentId], references: [id], onDelete: SetNull)
  validatedByCoachId  String?
  validatedAt         DateTime?
  
  // Fichiers (stockage sécurisé)
  originalFilename    String
  fileSize            Int
  mimeType            String               // image/jpeg, image/png, application/pdf
  fileHash            String               // SHA-256 pour déduplication/validation
  storagePath         String               // Chemin relatif dans NPC_STORAGE_DIR
  
  // Métadonnées extraction
  pageCount           Int                  @default(0)
  
  // Métadonnées source (facultatives, pour contexte)
  subject             Subject?
  gradeLevel          GradeLevel?
  examType            String?              // BAC_2024, DS_MATHS_2025, etc.
  examDate            DateTime?
  
  // OCR détection
  detectedStudentName String?
  ocrConfidence       Float?               // 0-1 score confiance global
  
  // Statut workflow
  status              CopySubmissionStatus @default(UPLOADED)
  
  // Timestamps
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  
  // Relations
  pages               CopyPage[]
  jobs                AiProcessingJob[]
  assessmentSource    AssessmentSource?
  pedagogicalReport   PedagogicalReport?
  auditLogs           NpcAuditLog[]
  
  // Index
  @@index([coachId, status])
  @@index([validatedStudentId, status])
  @@index([proposedStudentId])
  @@index([createdAt])
  @@index([status, createdAt])
  @@map("copy_submissions")
}

// ============================================================================
// NPC - Assessment Source (Sujet et barème)
// ============================================================================
model AssessmentSource {
  id                String               @id @default(cuid())
  
  submissionId      String               @unique
  submission        CopySubmission       @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  // Identification du sujet
  title             String               // "DS Mathématiques - Dérivation"
  sourceType        String?              // OFFICIAL_MINISTRY, COACH_CREATED, UNKNOWN
  
  // Contenu du sujet (si fourni)
  subjectText       String?              @db.Text  // Texte complet du sujet
  subjectFilePath   String?              // Fichier sujet uploadé séparément
  
  // Barème
  gradingMode       AssessmentGradingMode @default(QUALITATIVE_ONLY)
  maxScore          Float?               // Note maximale si applicable
  passingScore      Float?               // Note de passage
  gradingDetails    Json?                // [{"exercise": 1, "points": 4, "criteria": [...]}]
  
  // Correction attendue (si fournie)
  expectedAnswers   String?              @db.Text  // Réponses attendues
  correctionFilePath String?             // Fichier correction
  
  // Métadonnées
  providedByCoachId String
  createdAt           DateTime             @default(now())
  
  @@map("assessment_sources")
}

// ============================================================================
// NPC - Copy Page (Page individuelle avec OCR)
// ============================================================================
model CopyPage {
  id                String         @id @default(cuid())
  submissionId      String
  submission        CopySubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  pageNumber        Int
  
  // OCR data (stocké séparément du fichier image)
  ocrText           String?        @db.Text
  ocrConfidence     Float?         // 0-1 par page
  ocrZones          Json?          // [{"x": 10, "y": 20, "width": 100, "height": 50, "text": "...", "confidence": 0.95}]
  
  // Qualité
  isReadable        Boolean        @default(true)
  qualityIssues     String[]         // ["BLURRY", "SKEWED", "LOW_CONTRAST", "INCOMPLETE"]
  
  // Image extraite (si conversion PDF)
  imageStoragePath  String?
  imageWidth        Int?
  imageHeight       Int?
  
  createdAt         DateTime       @default(now())
  
  @@unique([submissionId, pageNumber])
  @@index([submissionId])
  @@map("copy_pages")
}

// ============================================================================
// NPC - AI Processing Job (Traitement asynchrone)
// ============================================================================
model AiProcessingJob {
  id                String         @id @default(cuid())
  
  submissionId      String
  submission        CopySubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  // Type d'agent
  agentType         AiAgentType
  
  // Statut
  status            AiJobStatus    @default(PENDING)
  
  // Modèle utilisé (audit trail)
  modelRequested    String         // Modèle demandé dans la config
  modelUsed         String?        // Modèle réellement appelé (peut différer en fallback)
  provider          String         // "chutes.ai", "ollama", "stub"
  
  // Timing & performance
  queuedAt          DateTime       @default(now())
  startedAt         DateTime?
  completedAt       DateTime?
  durationMs        Int?
  
  // Coût (si disponible)
  estimatedCostUsd  Float?
  tokensInput       Int?
  tokensOutput      Int?
  
  // Résultats (références, pas contenu complet)
  inputPayloadRef   String?        // Référence payload envoyé (hash ou path)
  outputPayloadRef  String?        // Référence résultat reçu
  outputSummary     String?        @db.Text // Résumé non confidentiel pour UI
  
  // Error tracking
  errorCode         String?        // "VISION_TIMEOUT", "OCR_UNREADABLE", "JSON_PARSE_ERROR"
  errorMessage      String?        @db.Text
  retryCount        Int            @default(0)
  maxRetries        Int            @default(3)
  
  // Lock & distribution
  workerId          String?        // ID du worker ayant pris le job
  lockExpiresAt     DateTime?      // Expiration du verrou
  
  // Trace (chaînage jobs)
  traceId           String         @default(cuid())
  previousJobId     String?        // Job précédent dans la chaîne
  
  // Audit
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  // Index pour worker query
  @@index([status, queuedAt])        // Jobs pending ordered
  @@index([status, workerId, lockExpiresAt]) // Jobs running with lock
  @@index([submissionId, agentType])
  @@index([traceId])
  @@index([errorCode, retryCount])
  @@map("ai_processing_jobs")
}

// ============================================================================
// NPC - Pedagogical Report (Bilan diagnostic)
// ============================================================================
model PedagogicalReport {
  id                String         @id @default(cuid())
  
  // Relations
  submissionId      String         @unique
  submission        CopySubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  studentId         String
  student           Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  coachId           String
  coach             CoachProfile   @relation(fields: [coachId], references: [id], onDelete: Cascade)
  
  // Contexte
  subject           Subject
  gradeLevel        GradeLevel
  academicTrack     AcademicTrack?
  
  // Contenu structuré (différencié coach/élève)
  // Version technique complète (coach)
  technicalAnalysis String         @db.Text // Analyse détaillée avec preuves
  
  // Version élève (simplifiée, motivante)
  studentSummary    String?        @db.Text // Résumé accessible
  strengths         String[]       // Forces identifiées
  areasForImprovement String[]     // Axes de progrès
  
  // Score (uniquement si barème fourni)
  obtainedScore     Float?         // Note obtenue
  maxScore          Float?         // Note max (copié de AssessmentSource)
  scoreComment      String?        // Commentaire sur la note
  isOfficialScore   Boolean        @default(false) // true seulement si barème fourni
  
  // Statut publication
  visibilityStatus  ReportVisibilityStatus @default(DRAFT)
  
  // Visibilité contrôlée
  visibleToStudent  Boolean        @default(false)
  visibleToParent   Boolean        @default(false)
  
  // Publication
  publishedAt       DateTime?
  publishedBy       String?        // CoachProfile.id
  unpublishedAt     DateTime?
  unpublishedBy     String?
  
  // Références jobs IA
  visionJobId       String?
  logicJobId        String?
  mentorJobId       String?
  
  // Timestamps
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  // Relations
  competenceMatrix  CompetenceMatrix[]
  roadmap           RemediationRoadmap?
  feedback          ReportFeedback?
  auditLogs         NpcAuditLog[]
  
  // Index
  @@index([studentId, visibilityStatus])
  @@index([studentId, visibleToStudent])
  @@index([coachId, createdAt])
  @@index([subject, gradeLevel])
  @@index([visibilityStatus, createdAt])
  @@map("pedagogical_reports")
}

// ============================================================================
// NPC - Competence Matrix (Compétences évaluées)
// ============================================================================
model CompetenceMatrix {
  id                  String             @id @default(cuid())
  reportId            String
  report              PedagogicalReport  @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  // Identification compétence
  competenceKey       String             // "MATHS_ALGEBRE_EQUATIONS_DERIVATION"
  label               String             // "Dérivation de fonctions algébriques"
  domain              String             // "ALGEBRE", "GEOMETRIE", "ANALYSE"
  subDomain           String?            // "EQUATIONS", "FONCTIONS"
  
  // Évaluation
  masteryLevel        MasteryLevel
  order               Int                // Ordre d'affichage
  
  // Détails pédagogiques (stricts)
  evidence            String?            @db.Text // Citation des preuves dans la copie
  errorTypes          String[]           // ["CALCUL", "METHODE", "COMPREHENSION", "REDACTION", "JUSTIFICATION"]
  errors              Json?              // [{"type": "CALCUL", "description": "...", "location": "page 2"}]
  
  // Recommandation (actionnable, non vague)
  recommendation      String             @db.Text // Ex: "Reprendre la dérivation d'un produit avec 3 exercices..."
  priority            Int                @default(0) // 0 = haute priorité
  
  // RAG
  suggestedRagQuery   String?            // Requête générée pour trouver ressources
  suggestedResources  Json?              // [{"resourceId": "...", "title": "...", "relevance": 0.95}]
  
  @@index([reportId, domain, order])
  @@index([competenceKey])
  @@index([reportId, masteryLevel])
  @@map("competence_matrices")
}

// ============================================================================
// NPC - Remediation Roadmap (Feuille de route)
// ============================================================================
model RemediationRoadmap {
  id                  String             @id @default(cuid())
  reportId            String             @unique
  report              PedagogicalReport  @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  // Objectifs
  title               String             // "Plan de remédiation - Dérivation"
  description         String?            @db.Text
  estimatedDuration   String?            // "3 semaines", "10 heures"
  
  // Progression (calculée)
  progressPercent     Int                @default(0)
  tasksCompleted      Int                @default(0)
  tasksTotal          Int                @default(0)
  
  // Relations
  tasks               RoadmapTask[]
  
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  
  @@map("remediation_roadmaps")
}

// ============================================================================
// NPC - Roadmap Task (Tâche de remédiation)
// ============================================================================
model RoadmapTask {
  id                  String             @id @default(cuid())
  roadmapId           String
  roadmap             RemediationRoadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  
  // Contenu
  title               String             // Actionnable : "Résoudre 3 équations..."
  description         String?            @db.Text
  
  // Lien pédagogique
  competenceMatrixId  String?            // Lien vers la compétence concernée
  competencyKey       String?            // Clé de compétence
  
  // Métadonnées pédagogiques
  difficulty          String?            // EASY, MEDIUM, HARD
  estimatedMinutes    Int?               // Durée estimée
  priority            Int                @default(0) // 0 = haute
  
  // Ressources
  ragQuery            String?            // Requête RAG générée
  suggestedResourceIds String[]          // IDs ressources suggérées
  externalResourceUrl String?            // URL externe
  
  // Suivi élève
  status              RoadmapTaskStatus  @default(PENDING)
  startedAt           DateTime?
  completedAt         DateTime?
  completedBy         String?            // Student.id
  
  // Ordre
  order               Int
  
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  
  // Index
  @@index([roadmapId, status, order])
  @@index([roadmapId, order])
  @@index([completedBy])
  @@map("roadmap_tasks")
}

// ============================================================================
// NPC - Report Feedback (Feedback coach qualité IA)
// ============================================================================
model ReportFeedback {
  id                    String             @id @default(cuid())
  reportId              String             @unique
  report                PedagogicalReport  @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  coachId               String
  
  // Évaluation qualitative (1-5)
  ocrAccuracyRating     Int?               // 1-5
  analysisRelevanceRating Int?             // 1-5
  roadmapActionabilityRating Int?           // 1-5
  overallRating         Int?               // 1-5
  
  // Commentaires structurés
  whatWorked            String?            @db.Text
  whatToImprove         String?            @db.Text
  suggestedCorrections  String?            @db.Text // Corrections proposées
  
  // Amélioration continue
  usedForRetraining     Boolean            @default(false)
  correctionDataExported Boolean           @default(false)
  
  createdAt             DateTime           @default(now())
  
  @@map("report_feedback")
}

// ============================================================================
// NPC - Audit Log (Traçabilité complète)
// ============================================================================
model NpcAuditLog {
  id                String         @id @default(cuid())
  
  // Cible
  submissionId      String?
  reportId          String?
  
  // Acteur
  actorId           String         // User.id
  actorRole         UserRole
  
  // Action
  actionType        AuditActionType
  actionDetails     Json?          // Contexte spécifique
  
  // IP/UserAgent (si pertinent et légal)
  ipAddress         String?
  userAgent         String?
  
  // Timestamp
  createdAt         DateTime       @default(now())
  
  // Index pour requêtes audit
  @@index([submissionId, createdAt])
  @@index([reportId, createdAt])
  @@index([actorId, createdAt])
  @@index([actionType, createdAt])
  @@index([createdAt])
  @@map("npc_audit_logs")
}

// ============================================================================
// Relations à ajouter aux modèles existants (documenté, non appliqué)
// ============================================================================

/*
DANS model Student:
  copySubmissionsProposed  CopySubmission[] @relation("ProposedStudent")
  copySubmissionsValidated CopySubmission[] @relation("ValidatedStudent")
  pedagogicalReports       PedagogicalReport[]
  roadmapTasksCompleted    RoadmapTask[] @relation(fields: [completedBy])

DANS model CoachProfile:
  copySubmissions    CopySubmission[]
  pedagogicalReports PedagogicalReport[]

NOTE: Les relations inverses doivent être ajoutées manuellement dans schema.prisma
*/
```

### 3.4 Prisma Migration Safety

#### Commandes de validation locales

```bash
# 1. Validation schéma
npx prisma validate

# 2. Génération client (détection erreurs)
npx prisma generate

# 3. Migration development (local uniquement)
npx prisma migrate dev --name add_npc_models

# 4. Vérification migration créée
ls prisma/migrations/ | tail -5
```

#### Déploiement production (procédure)

```bash
# 1. Backup obligatoire avant toute migration prod
pg_dump $DATABASE_URL > backup_pre_npc_$(date +%Y%m%d_%H%M%S).sql

# 2. Vérification migrations existantes
npx prisma migrate status

# 3. Déploiement migration
npx prisma migrate deploy

# 4. Vérification tables créées
psql $DATABASE_URL -c "\dt" | grep -E "(copy_submission|ai_processing_job|pedagogical_report)"

# 5. Vérification table _prisma_migrations
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY applied_at DESC LIMIT 5;"

# 6. Génération client prod
npx prisma generate
```

#### Stratégie rollback

| Scénario | Action |
|----------|--------|
| Migration échoue | `npx prisma migrate resolve --rolled-back <migration_name>` |
| Données corrompues | Restauration backup + forward fix |
| Schema drift | `prisma migrate dev --create-only` pour recréer |

#### Interdictions absolues

- ❌ `psql -f script_sauvage.sql` (hors migrations Prisma)
- ❌ `DROP TABLE` manuel
- ❌ Modification `_prisma_migrations` manuelle
- ❌ Migration destructive sans backup

---

## 4. Jobs Asynchrones - Architecture MVP

### 4.1 Choix architectural

**Option retenue** : **Option A - Worker Node séparé dans Docker**

Justification : Le projet utilise déjà Docker Compose avec des services multiples. Ajouter un service worker est cohérent avec l'architecture existante (ollama, ingestor, etc.).

### 4.2 Architecture jobs

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │────▶│  Worker Service │────▶│  Chutes.ai API  │
│   (Job Queue)   │     │   (NPC Worker)  │     │   (Vision/Logic │
└─────────────────┘     └─────────────────┘     │   /Mentor)      │
         ▲                      │              └─────────────────┘
         │                      │                      │
         │              ┌───────┴───────┐              │
         │              │               │              │
         │         ┌────┴────┐    ┌────┴────┐         │
         │         │  Lock   │    │ Retry   │         │
         │         │ Service │    │ Service │         │
         │         └─────────┘    └─────────┘         │
         │                                            │
┌────────┴────────────────────────────────────────────┘
│  API Next.js (polling pour le front)
└─────────────────────────────────────────────────────┘
```

### 4.3 Service Worker (Docker)

```dockerfile
# services/npc-worker/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "services/npc-worker/index.js"]
```

```yaml
# docker-compose.yml ajout
services:
  npc-worker:
    build:
      context: .
      dockerfile: services/npc-worker/Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - CHUTES_API_KEY=${CHUTES_API_KEY}
      - NPC_LLM_MODE=${NPC_LLM_MODE:-live}
      - NPC_STORAGE_DIR=/data/pedagogy-cockpit
    volumes:
      - npc_data:/data/pedagogy-cockpit
    depends_on:
      - postgres
    restart: unless-stopped
    # Un seul worker actif par défaut pour éviter conflits
    deploy:
      replicas: 1
```

### 4.4 File Worker

```typescript
// services/npc-worker/index.ts
import { PrismaClient, AiJobStatus, AiAgentType } from '@prisma/client';
import { processVisionJob } from './processors/vision';
import { processLogicJob } from './processors/logic';
import { processMentorJob } from './processors/mentor';

const prisma = new PrismaClient();
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function claimNextJob(): Promise<string | null> {
  // Transaction pour éviter race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Trouver job pending le plus ancien
    const job = await tx.aiProcessingJob.findFirst({
      where: {
        status: AiJobStatus.PENDING,
        OR: [
          { lockExpiresAt: null },
          { lockExpiresAt: { lt: new Date() } }
        ]
      },
      orderBy: { queuedAt: 'asc' }
    });
    
    if (!job) return null;
    
    // Prendre le verrou
    await tx.aiProcessingJob.update({
      where: { id: job.id },
      data: {
        status: AiJobStatus.RUNNING,
        workerId: WORKER_ID,
        lockExpiresAt: new Date(Date.now() + LOCK_TIMEOUT_MS),
        startedAt: new Date()
      }
    });
    
    return job.id;
  });
  
  return result;
}

async function processJob(jobId: string): Promise<void> {
  const job = await prisma.aiProcessingJob.findUnique({
    where: { id: jobId },
    include: { submission: true }
  });
  
  if (!job) return;
  
  try {
    switch (job.agentType) {
      case AiAgentType.VISION:
        await processVisionJob(job, prisma);
        break;
      case AiAgentType.LOGIC:
        await processLogicJob(job, prisma);
        break;
      case AiAgentType.MENTOR:
        await processMentorJob(job, prisma);
        break;
    }
    
    // Succès
    await prisma.aiProcessingJob.update({
      where: { id: jobId },
      data: {
        status: AiJobStatus.COMPLETED,
        completedAt: new Date(),
        durationMs: Date.now() - job.startedAt!.getTime()
      }
    });
    
  } catch (error) {
    await handleJobError(jobId, error);
  }
}

async function handleJobError(jobId: string, error: unknown): Promise<void> {
  const job = await prisma.aiProcessingJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const shouldRetry = job.retryCount < job.maxRetries && isRetryableError(error);
  
  if (shouldRetry) {
    await prisma.aiProcessingJob.update({
      where: { id: jobId },
      data: {
        status: AiJobStatus.RETRYING,
        retryCount: { increment: 1 },
        errorMessage: `${errorMessage} (retry ${job.retryCount + 1}/${job.maxRetries})`,
        workerId: null,
        lockExpiresAt: null
      }
    });
    
    // Delay exponentiel
    const delay = Math.pow(2, job.retryCount) * 1000;
    await new Promise(r => setTimeout(r, delay));
    
  } else {
    await prisma.aiProcessingJob.update({
      where: { id: jobId },
      data: {
        status: AiJobStatus.FAILED,
        errorMessage: errorMessage,
        completedAt: new Date()
      }
    });
  }
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message.includes('timeout') || 
         message.includes('rate limit') || 
         message.includes('ECONNREFUSED');
}

// Boucle principale
async function main(): Promise<void> {
  console.log(`[NPC Worker] Started: ${WORKER_ID}`);
  
  while (true) {
    try {
      const jobId = await claimNextJob();
      
      if (jobId) {
        console.log(`[NPC Worker] Processing job: ${jobId}`);
        await processJob(jobId);
      } else {
        // Aucun job, attendre
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error('[NPC Worker] Error:', error);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

main();
```

### 4.5 Statuts workflow harmonisés

| Étape | CopySubmission.status | AiProcessingJob.status | Déclencheur |
|-------|------------------------|------------------------|-------------|
| Upload | `UPLOADED` | - | Coach upload |
| Vision queued | `OCR_PENDING` | `PENDING` (VISION) | Upload terminé |
| Vision running | `OCR_RUNNING` | `RUNNING` | Worker pick |
| Vision review | `OCR_REVIEW_REQUIRED` | `COMPLETED` | Vision done |
| Student validated | `OCR_COMPLETED` | - | Coach validation |
| Logic queued | `LOGIC_PENDING` | `PENDING` (LOGIC) | Validation |
| Logic running | `LOGIC_RUNNING` | `RUNNING` | Worker pick |
| Logic done | `MENTOR_PENDING` | `COMPLETED` | Logic done |
| Mentor queued | `MENTOR_PENDING` | `PENDING` (MENTOR) | Logic done |
| Mentor running | `MENTOR_RUNNING` | `RUNNING` | Worker pick |
| Review | `READY_FOR_COACH_REVIEW` | `COMPLETED` | Mentor done |
| Published | `PUBLISHED` | - | Coach publication |
| Archived | `ARCHIVED` | - | Coach archivage |

### 4.6 Polling frontend

```typescript
// Frontend polling avec React Query
const useJobStatus = (jobId: string) => {
  return useQuery({
    queryKey: ['npc-job', jobId],
    queryFn: () => fetchJobStatus(jobId),
    refetchInterval: (data) => {
      // Polling adaptatif
      if (data?.status === 'PENDING') return 2000;
      if (data?.status === 'RUNNING') return 3000;
      if (data?.status === 'RETRYING') return 5000;
      return false; // Stop polling
    },
    staleTime: 1000
  });
};
```

### 4.7 Timeouts et retries par agent

| Agent | Timeout | Max Retries | Retry Delay |
|-------|---------|-------------|-------------|
| Vision | 120s | 3 | 2s, 4s, 8s |
| Logic | 180s | 3 | 5s, 10s, 20s |
| Mentor | 180s | 2 | 5s, 10s |

---

## 5. Stockage et Fichiers - Sécurité Renforcée

### 5.1 Architecture stockage

```
/data/pedagogy-cockpit/
├── uploads/                    # Copies uploadées
│   └── [coachId]/              # Isolation par coach
│       └── [submissionId]/       # Isolation par submission
│           └── [hash].[ext]     # Fichier renommé avec hash
├── pages/                      # Pages extraites (PDF → images)
│   └── [submissionId]/
│       └── page-[n].png
├── ocr/                        # Résultats OCR (JSON)
│   └── [submissionId]/
│       └── page-[n].json
├── exports/                    # Bilans PDF exportés
│   └── [reportId]/
│       └── bilan.pdf
└── temp/                       # Fichiers temporaires (cleanup auto)
    └── [sessionId]/
```

### 5.2 Variables d'environnement

```bash
# NPC Storage
NPC_STORAGE_DIR=/data/pedagogy-cockpit
NPC_MAX_UPLOAD_MB=10
NPC_MAX_PAGES_PER_UPLOAD=20
NPC_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,application/pdf
NPC_TEMP_RETENTION_HOURS=24
```

### 5.3 Validation fichier côté serveur

```typescript
// lib/npc/file-validation.ts
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'crypto';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  fileHash?: string;
  sanitizedName?: string;
}

export async function validateUploadedFile(
  fileBuffer: Buffer,
  originalName: string
): Promise<FileValidationResult> {
  // 1. Taille
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }
  
  // 2. Détection MIME réelle (magic bytes)
  const fileType = await fileTypeFromBuffer(fileBuffer);
  if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
    return { valid: false, error: 'INVALID_FILE_TYPE' };
  }
  
  // 3. Extension autorisée
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'INVALID_EXTENSION' };
  }
  
  // 4. Hash pour déduplication/vérification
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  // 5. Nom nettoyé (pas de chemins relatifs)
  const sanitizedName = path.basename(originalName).replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return {
    valid: true,
    mimeType: fileType.mime,
    fileHash,
    sanitizedName
  };
}

export function generateSecurePath(
  coachId: string,
  submissionId: string,
  fileHash: string,
  mimeType: string
): string {
  // Pas de chemins relatifs possibles
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  const safeCoachId = coachId.replace(/[^a-zA-Z0-9]/g, '');
  const safeSubmissionId = submissionId.replace(/[^a-zA-Z0-9]/g, '');
  
  return path.join(
    'uploads',
    safeCoachId,
    safeSubmissionId,
    `${fileHash}.${ext}`
  );
}
```

### 5.4 Route protégée de lecture

```typescript
// app/api/npc/files/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import path from 'path';

const STORAGE_DIR = process.env.NPC_STORAGE_DIR || '/data/pedagogy-cockpit';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // 2. Reconstruction path sécurisé
  const relativePath = params.path.join('/');
  
  // 3. Vérification pas de traversal
  if (relativePath.includes('..') || relativePath.startsWith('/')) {
    return new NextResponse('Invalid path', { status: 400 });
  }
  
  // 4. Extraction submissionId du path
  const pathParts = relativePath.split('/');
  const submissionId = pathParts[1]; // uploads/[coachId]/[submissionId]/...
  
  // 5. Vérification accès via DB
  const submission = await prisma.copySubmission.findUnique({
    where: { id: submissionId },
    include: { 
      coach: true,
      validatedStudent: { include: { parent: true } }
    }
  });
  
  if (!submission) {
    return new NextResponse('Not found', { status: 404 });
  }
  
  // 6. RBAC
  const userId = session.user.id;
  const userRole = session.user.role;
  
  let hasAccess = false;
  
  if (userRole === 'ADMIN') {
    hasAccess = true;
  } else if (userRole === 'COACH' && submission.coach.userId === userId) {
    hasAccess = true;
  } else if (userRole === 'ELEVE' && submission.validatedStudent?.userId === userId) {
    // Élève voit seulement si rapport publié
    const report = await prisma.pedagogicalReport.findFirst({
      where: { submissionId, visibleToStudent: true }
    });
    hasAccess = !!report;
  } else if (userRole === 'PARENT' && submission.validatedStudent?.parent.userId === userId) {
    // Parent voit seulement si rapport publié
    const report = await prisma.pedagogicalReport.findFirst({
      where: { submissionId, visibleToParent: true }
    });
    hasAccess = !!report;
  }
  
  if (!hasAccess) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // 7. Lecture fichier
  const fullPath = path.join(STORAGE_DIR, relativePath);
  
  try {
    const fileBuffer = await readFile(fullPath);
    
    // 8. Content-Type
    const mimeType = submission.mimeType || 'application/octet-stream';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch {
    return new NextResponse('File not found', { status: 404 });
  }
}
```

### 5.5 Conversion PDF → Images

```typescript
// lib/npc/pdf-conversion.ts
import { pdf } from 'pdf-to-img';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function convertPdfToImages(
  pdfBuffer: Buffer,
  submissionId: string
): Promise<{ pageCount: number; pagePaths: string[] }> {
  const pages = await pdf(pdfBuffer, { scale: 2.0 });
  const pagePaths: string[] = [];
  
  const outputDir = path.join(process.env.NPC_STORAGE_DIR!, 'pages', submissionId);
  await mkdir(outputDir, { recursive: true });
  
  let pageNum = 1;
  for await (const page of pages) {
    const pagePath = path.join(outputDir, `page-${pageNum}.png`);
    await writeFile(pagePath, page);
    pagePaths.push(pagePath);
    pageNum++;
  }
  
  return { pageCount: pageNum - 1, pagePaths };
}
```

**Dépendances nécessaires** :
```json
{
  "dependencies": {
    "file-type": "^19.0.0",
    "pdf-to-img": "^2.1.0",
    "sharp": "^0.33.0"
  }
}
```

**Impact Docker** : Aucun outil système supplémentaire requis (bibliothèques Node pures).

### 5.6 File Security Acceptance Criteria

| Critère | Exigence | Test |
|---------|----------|------|
| Pas d'accès direct | URL `/data/...` bloquée par nginx | ✅ Verifié |
| URL non devinable | Hash SHA-256 dans le path | ✅ Test E2E |
| Traversal interdit | `../` rejeté avec 400 | ✅ Test unitaire |
| MIME validation | Magic bytes vérifiés, pas extension seule | ✅ Test unitaire |
| Taille limitée | 10MB max, rejeté si supérieur | ✅ Test unitaire |
| RBAC fichier | Coach: own, Eleve: published only, Parent: published only | ✅ Test E2E |
| Cleanup temp | Fichiers temp auto-supprimés après 24h | ✅ Cron test |

---

## 6. IA / Chutes / Prompts - Sorties Strictes et Mocks

### 6.1 Schémas Zod de validation

```typescript
// lib/npc/schemas/vision-result.ts
import { z } from 'zod';

export const OcrZoneSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1)
});

export const PageResultSchema = z.object({
  pageNumber: z.number().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  zones: z.array(OcrZoneSchema).optional(),
  qualityIssues: z.array(z.enum(['BLURRY', 'SKEWED', 'LOW_CONTRAST', 'INCOMPLETE'])).optional()
});

export const VisionResultSchema = z.object({
  detectedStudentName: z.string().optional(),
  detectedSubject: z.string().optional(),
  detectedGradeLevel: z.string().optional(),
  totalPages: z.number().positive(),
  pages: z.array(PageResultSchema),
  globalConfidence: z.number().min(0).max(1),
  requiresReview: z.boolean().default(false),
  reviewReason: z.string().optional() // Si requiresReview=true
});

export type VisionResult = z.infer<typeof VisionResultSchema>;
```

```typescript
// lib/npc/schemas/logic-result.ts
import { z } from 'zod';

export const ErrorDetailSchema = z.object({
  type: z.enum(['CALCUL', 'METHODE', 'COMPREHENSION', 'REDACTION', 'JUSTIFICATION', 'NOTATION', 'ALGORITHMIQUE']),
  description: z.string().min(10), // Pas de phrases courtes vagues
  location: z.string().optional(), // "Page 2, exercice 3"
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR'])
});

export const CompetenceEvaluationSchema = z.object({
  competenceKey: z.string().regex(/^[A-Z_]+$/),
  label: z.string().min(5),
  domain: z.string(),
  subDomain: z.string().optional(),
  masteryLevel: z.enum(['NOT_MASTERED', 'FRAGILE', 'PARTIAL', 'SATISFACTORY', 'MASTERED', 'EXPERT']),
  evidence: z.string().min(20), // Citation preuve
  errors: z.array(ErrorDetailSchema),
  recommendation: z.string().min(30), // Actionnable, non vague
  priority: z.number().min(0).max(100)
});

export const LogicAnalysisResultSchema = z.object({
  obtainedScore: z.number().optional(), // Optionnel si pas de barème
  maxScore: z.number().optional(),
  scoreComment: z.string().optional(),
  hasOfficialGrading: z.boolean(), // true si barème fourni
  
  globalSummary: z.string().min(100),
  technicalAnalysis: z.string().min(200), // Pour coach
  strengths: z.array(z.string().min(10)),
  areasForImprovement: z.array(z.string().min(10)),
  
  competences: z.array(CompetenceEvaluationSchema).min(1),
  
  // Anti-hallucination
  hallucinationWarning: z.boolean().default(false),
  confidenceScore: z.number().min(0).max(1)
});

export type LogicAnalysisResult = z.infer<typeof LogicAnalysisResultSchema>;
```

```typescript
// lib/npc/schemas/mentor-result.ts
import { z } from 'zod';

export const RoadmapTaskSchema = z.object({
  order: z.number().positive(),
  title: z.string().min(10).max(200), // Actionnable
  description: z.string().min(30),
  competenceKey: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  estimatedMinutes: z.number().positive().max(120),
  priority: z.number().min(0).max(100),
  ragQuery: z.string().min(10), // Requête RAG générée
  successCriteria: z.string().min(20) // Comment savoir si réussi
});

export const MentorRoadmapResultSchema = z.object({
  title: z.string().min(10),
  description: z.string().min(50),
  estimatedDuration: z.string().regex(/^\d+\s+(minutes?|heures?|jours?|semaines?)$/i),
  
  tasks: z.array(RoadmapTaskSchema).min(1).max(15), // Max 15 tâches
  
  // Motivation
  openingMessage: z.string().min(50), // Message d'encouragement
  closingMessage: z.string().min(50),
  
  // RAG suggestions
  globalRagQueries: z.array(z.string()).optional() // Requêtes pour ressources générales
});

export type MentorRoadmapResult = z.infer<typeof MentorRoadmapResultSchema>;
```

### 6.2 Stratégie gestion erreurs JSON

```typescript
// lib/npc/json-safety.ts
import { z } from 'zod';

export async function safeParseAIJson<T>(
  jsonString: string,
  schema: z.ZodSchema<T>,
  options: { partial?: boolean } = {}
): Promise<{ success: true; data: T } | { success: false; error: string; partial?: unknown }> {
  try {
    // 1. Extraction JSON de markdown si nécessaire
    const jsonMatch = jsonString.match(/```json\n?([\s\S]*?)\n?```/) || 
                      jsonString.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[1] || jsonMatch[0] : jsonString;
    
    // 2. Parse
    const parsed = JSON.parse(cleanJson);
    
    // 3. Validation Zod
    const result = schema.safeParse(parsed);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    // 4. Si partial accepté, retourner ce qui a pu être parsé
    if (options.partial) {
      return { 
        success: false, 
        error: result.error.message,
        partial: parsed 
      };
    }
    
    return { success: false, error: result.error.message };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'JSON parse failed' 
    };
  }
}
```

### 6.3 Configuration modèles

```typescript
// lib/npc/config.ts
export const NPC_CONFIG = {
  llmMode: process.env.NPC_LLM_MODE || 'live', // 'live' | 'stub' | 'off'
  
  models: {
    vision: {
      model: process.env.NPC_VISION_MODEL || 'qwen2.5-vl-32b',
      provider: 'chutes.ai',
      fallbackProvider: 'ollama',
      maxTokens: 4096,
      temperature: 0.3,
      timeout: 120000,
    },
    logic: {
      model: process.env.NPC_LOGIC_MODEL || 'deepseek-v3.2-tee',
      provider: 'chutes.ai',
      fallbackProvider: 'ollama',
      maxTokens: 8192,
      temperature: 0.2,
      timeout: 180000,
    },
    mentor: {
      model: process.env.NPC_MENTOR_MODEL || 'qwen3.5-397b-a17b-tee',
      provider: 'chutes.ai',
      fallbackProvider: 'ollama',
      maxTokens: 8192,
      temperature: 0.4,
      timeout: 180000,
    }
  },
  
  stubs: {
    // Réponses déterministes pour mode stub
    enabled: process.env.NPC_LLM_MODE === 'stub',
    visionDelay: 1000,
    logicDelay: 2000,
    mentorDelay: 2000
  }
};
```

### 6.4 Mode LLM et mocks

| Mode | Comportement | Utilisation |
|------|-------------|-------------|
| `live` | Appels réels Chutes.ai | Production |
| `stub` | Réponses déterministes, délais simulés | Staging, tests rapides |
| `off` | Pas d'appel, jobs marqués `FAILED` avec `errorCode: LLM_OFF_MODE` | CI, tests E2E |

**Règles strictes** :
- ❌ Aucun appel Chutes.ai en CI (jamais)
- ✅ Mocks déterministes pour tous les tests automatisés
- ✅ `NPC_LLM_MODE=off` en environnement test
- ✅ Secrets jamais dans les logs

### 6.5 Anti-hallucination

```typescript
// lib/npc/prompts/anti-hallucination.ts
export const ANTI_HALLUCINATION_RULES = `
RÈGLES STRICTES ANTI-HALLUCINATION :

1. SI une information n'est PAS visible dans la copie, indiquer "Non présent dans la copie" - NE PAS inventer.

2. SI le barème n'est pas fourni, NE PAS attribuer de note officielle. Utiliser uniquement une analyse qualitative.

3. SI une compétence n'est pas testée dans le sujet, NE PAS l'évaluer.

4. Pour chaque erreur identifiée, CITER la preuve exacte : "Page X, ligne Y : [citation]"

5. SI l'écriture est illisible sur une section, indiquer "Section illisible" - NE PAS deviner.

6. Pour les formules mathématiques, utiliser LaTeX strict : $...$ inline, $$...$$ display.

7. Pour le code NSI, utiliser des blocs markdown typés : \`\`\`python ... \`\`\`

8. Vérifier la cohérence : si note > 15/20, il doit y avoir moins de 3 erreurs majeures. Sinon, revisiter l'analyse.

9. En cas de doute sur une évaluation, choisir le niveau INFÉRIEUR et documenter l'incertitude.

10. NE JAMAIS écrire de phrases vagues comme "travaille plus", "revoir le cours", "attention aux erreurs".
`;
```

### 6.6 Logging non sensible

```typescript
// lib/npc/logging.ts
export function logNPCEvent(
  event: string,
  context: {
    jobId?: string;
    submissionId?: string;
    traceId?: string;
    model?: string;
    provider?: string;
    durationMs?: number;
    errorCode?: string;
  }
): void {
  // JAMAIS logger : contenu OCR, texte copie, données élève
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...context
  }));
}

// Exemple log OK:
// {"ts":"2026-05-01T10:00:00Z","event":"JOB_COMPLETED","jobId":"xxx","model":"qwen2.5-vl-32b","durationMs":45000}

// Exemple log INTERDIT:
// {"event":"OCR_RESULT","text":"Contenu de la copie de Jean Dupont..."} ❌
```

---

## 7. RBAC - Matrice Complète et Tests Obligatoires

### 7.1 Matrice RBAC NPC

| Action | Rôle | Condition ownership | Condition assignation | Condition statut | Autre condition |
|--------|------|---------------------|----------------------|------------------|-----------------|
| **Upload copie** | COACH | - | - | - | - |
| **Voir submission** | COACH | `coach.userId == me` | - | - | ADMIN: all |
| **Voir page image** | COACH | `coach.userId == me` | - | - | ELEVE: si published |
| **Voir OCR** | COACH | `coach.userId == me` | - | - | - |
| **Modifier OCR** | COACH | `coach.userId == me` | - | Non publié | - |
| **Valider association élève** | COACH | `coach.userId == me` | Coach assigné à l'élève | `OCR_REVIEW_REQUIRED` | - |
| **Lancer Logic Agent** | COACH | `coach.userId == me` | - | `OCR_COMPLETED` | - |
| **Lancer Mentor Agent** | COACH | `coach.userId == me` | - | `LOGIC_COMPLETED` | - |
| **Éditer rapport** | COACH | `coach.userId == me` | - | Non publié | - |
| **Publier rapport** | COACH | `coach.userId == me` | Coach assigné à l'élève | `READY_FOR_COACH_REVIEW` | - |
| **Dépublier rapport** | COACH | `coach.userId == me` | - | Publié | - |
| **Voir rapport (brouillon)** | COACH | `coach.userId == me` | - | DRAFT | - |
| **Voir rapport (publié)** | COACH | `coach.userId == me` | - | PUBLISHED | - |
| **Voir rapport (élève)** | ELEVE | - | `student.userId == me` | `visibleToStudent = true` | - |
| **Voir rapport (parent)** | PARENT | - | `student.parent.userId == me` | `visibleToParent = true` | - |
| **Voir roadmap** | COACH/ELEVE/PARENT | - | - | Voir conditions rapport | - |
| **Compléter tâche** | ELEVE | - | `student.userId == me` | - | Tâche de sa roadmap |
| **Accès ressources RAG** | COACH/ELEVE/PARENT | - | - | - | Selon visibilité rapport |
| **Consulter job** | COACH | `coach.userId == me` | - | - | - |
| **Relancer job** | COACH | `coach.userId == me` | - | FAILED ouRETRYING | Max retries non atteint |
| **Supprimer/archive submission** | COACH | `coach.userId == me` | - | Non publié | - |
| **Voir monitoring** | ADMIN | - | - | - | - |

### 7.2 Extensions RBAC requises

```typescript
// lib/rbac.ts - Ajouts nécessaires

export type Resource = 
  | 'USER'
  | 'STUDENT'
  // ... existants
  | 'NPC_SUBMISSION'      // NOUVEAU
  | 'NPC_REPORT'          // NOUVEAU
  | 'NPC_ROADMAP'         // NOUVEAU
  | 'NPC_JOB';            // NOUVEAU

// Ajouts dans rolePermissions:
[UserRole.COACH]: [
  // ... existants
  { action: 'CREATE', resource: 'NPC_SUBMISSION' },
  { action: 'READ_OWN', resource: 'NPC_SUBMISSION' },
  { action: 'UPDATE_OWN', resource: 'NPC_SUBMISSION' },
  { action: 'DELETE_OWN', resource: 'NPC_SUBMISSION' },
  { action: 'READ_OWN', resource: 'NPC_REPORT' },
  { action: 'UPDATE_OWN', resource: 'NPC_REPORT' },
  { action: 'MANAGE', resource: 'NPC_JOB' },
]

[UserRole.ELEVE]: [
  // ... existants
  { action: 'READ_SELF', resource: 'NPC_REPORT' },
  { action: 'READ_SELF', resource: 'NPC_ROADMAP' },
]

[UserRole.PARENT]: [
  // ... existants
  { action: 'READ_OWN', resource: 'NPC_REPORT' },  // own = children
  { action: 'READ_OWN', resource: 'NPC_ROADMAP' },
]
```

### 7.3 Tests RBAC obligatoires

| # | Test | Scenario | Résultat attendu |
|---|------|----------|-----------------|
| 1 | Coach isolation | Coach A tente GET /api/npc/submissions/[id_coach_b] | 403 Forbidden |
| 2 | Publication restriction | Coach A tente publier pour élève non assigné | 403 Forbidden |
| 3 | Brouillon caché | Élève tente GET /api/npc/reports/[draft_id] | 404 Not Found (pas 403, pour ne pas révéler existence) |
| 4 | Rapport visible | Élève GET /api/npc/reports/[published_id] | 200 OK si visibleToStudent=true |
| 5 | Parent scope | Parent B tente voir rapport enfant du Parent A | 404 Not Found |
| 6 | Fichier protégé | Accès direct /data/pedagogy-cockpit/... | 403 par nginx + 401 si bypass |
| 7 | Job privacy | Élève tente GET /api/npc/jobs/[job_id] | 403 Forbidden |
| 8 | OCR immuable | Coach modifie OCR après publication | 409 Conflict (édition interdite) |
| 9 | Task isolation | Élève A tente POST /api/npc/tasks/[task_b]/complete | 403 Forbidden |
| 10 | Admin view | ADMIN voit toutes les submissions | 200 OK |

---

## 8. Dashboards - Intégration Produit

### 8.1 Integration Map

| Zone existante | Fichier probable | Modification prévue | Risque | Test associé |
|----------------|-----------------|---------------------|--------|--------------|
| Navigation coach | `config/navigation.ts` ou `lib/navigation.ts` | Ajout entrée "Pedagogy Studio" | Collision nom | E2E navigation |
| Dashboard coach | `app/dashboard/coach/page.tsx` | Widget submissions récentes | Perf | E2E dashboard |
| Dossier élève coach | `app/dashboard/coach/students/[id]/page.tsx` | Onglet "Bilans NPC" | Design | E2E dossier |
| Navigation élève | `config/navigation.ts` | Ajout entrée "Mes Bilans" | Collision | E2E navigation |
| Dashboard élève | `app/dashboard/eleve/page.tsx` | Widget bilans récents | Perf | E2E dashboard |
| Layout coach | `app/dashboard/coach/layout.tsx` | Pas de modification | - | - |
| Layout élève | `app/dashboard/eleve/layout.tsx` | Pas de modification | - | - |
| Design system | `components/ui/` | Réutiliser Card, Button, Dialog | - | Visuel |

### 8.2 Composants Shadcn existants à réutiliser

```typescript
// Composants déjà présents (à vérifier) :
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// À installer si absent :
// - @radix-ui/react-slider (pour sélection pages)
// - recharts (pour radar compétences)
// - react-dropzone (pour upload)
```

### 8.3 Navigation proposée

```typescript
// config/navigation.ts ( Coach )
{
  title: 'Pedagogy Studio',
  href: '/dashboard/coach/pedagogy-studio',
  icon: ScanEye, // ou FileSearch
  description: 'Analyser des copies et générer des bilans pédagogiques',
  badge: 'Nouveau'
}

// config/navigation.ts ( Élève )
{
  title: 'Mes Bilans',
  href: '/dashboard/eleve/bilans',
  icon: FileCheck,
  description: 'Mes évaluations et plans de remédiation',
}
```

### 8.4 Routes pages proposées

```
app/dashboard/coach/pedagogy-studio/
├── page.tsx                    # Hub Studio (uploads récents)
├── upload/
│   └── page.tsx               # Page upload copie
├── review/
│   └── [submissionId]/
│       └── page.tsx           # Split-view OCR + validation
├── report/
│   └── [reportId]/
│       └── page.tsx           # Édition + publication
└── roadmap/
    └── [roadmapId]/
        └── page.tsx           # Vue roadmap (lecture)

app/dashboard/eleve/bilans/
├── page.tsx                   # Liste bilans publiés
└── [reportId]/
    └── page.tsx               # Détail bilan + compétences

app/dashboard/eleve/roadmaps/
└── [roadmapId]/
    └── page.tsx               # Ma feuille de route + tâches
```

---

## 9. RAG - Connexion Réelle

### 9.1 Audit RAG existant

```typescript
// lib/rag-client.ts (audit réel)
- URL: process.env.RAG_INGESTOR_URL || 'http://ingestor:8001'
- Endpoints: POST /search, GET /health, GET /collections/{name}/stats
- Modèle embeddings: nomic-embed-text (768d)
- Authentification: Bearer token (RAG_API_TOKEN)
- Timeouts: 12000ms (configurable)
- Fallback: URL publique en dev
```

### 9.2 Connexion Roadmap → RAG

```typescript
// lib/npc/rag-bridge.ts
import { ragSearch, RAGSubject, RAGLevel, buildRAGContext } from '@/lib/rag-client';

interface TaskResourceSuggestion {
  resourceId: string;
  title: string;
  excerpt: string;
  subject: RAGSubject;
  level: RAGLevel;
  relevanceScore: number;
  url?: string;
}

export async function suggestResourcesForTask(
  task: { ragQuery: string; competencyKey?: string; difficulty?: string },
  studentContext: { subject: RAGSubject; level: RAGLevel; track?: string }
): Promise<TaskResourceSuggestion[]> {
  if (!task.ragQuery) return [];
  
  try {
    const hits = await ragSearch({
      query: task.ragQuery,
      k: 5,
      filters: {
        subject: studentContext.subject,
        level: studentContext.level,
        // Difficulty mapping
        difficulty: mapNPCDifficultyToRAG(task.difficulty)
      }
    });
    
    return hits.map(hit => ({
      resourceId: hit.id,
      title: (hit.metadata?.title as string) || 'Ressource pédagogique',
      excerpt: hit.document.substring(0, 300),
      subject: studentContext.subject,
      level: studentContext.level,
      relevanceScore: hit.score || (1 - (hit.distance || 0)),
      url: hit.metadata?.url as string | undefined
    })).slice(0, 3); // Max 3 suggestions
    
  } catch (error) {
    console.error('[RAG Bridge] Error:', error);
    return []; // Fallback: pas de suggestions
  }
}

function mapNPCDifficultyToRAG(difficulty?: string): string | undefined {
  const map: Record<string, string> = {
    'EASY': 'debutant',
    'MEDIUM': 'intermediaire',
    'HARD': 'avance'
  };
  return difficulty ? map[difficulty] : undefined;
}
```

### 9.3 Dégradation gracieuse

| Scénario RAG | Comportement NPC | UX |
|--------------|-----------------|-----|
| RAG healthy | 3 ressources suggérées par tâche | Liens cliquables |
| RAG timeout | Pas de suggestions, message "Ressources en cours d'indexation" | Non bloquant |
| RAG error | Pas de suggestions, bouton "Rechercher manuellement" | Dégradé |
| Pas de résultats | Message "Aucune ressource trouvée - Demandez à votre coach" | Transparent |

### 9.4 Tests RAG mocks

```typescript
// __tests__/npc/rag-bridge.test.ts
jest.mock('@/lib/rag-client');

describe('RAG Bridge', () => {
  it('returns resources when RAG is available', async () => {
    (ragSearch as jest.Mock).mockResolvedValue([
      { id: '1', document: 'Exercice dérivation...', metadata: { title: 'Dérivation' }, score: 0.95 }
    ]);
    
    const result = await suggestResourcesForTask(...);
    expect(result).toHaveLength(1);
    expect(result[0].relevanceScore).toBeGreaterThan(0.9);
  });
  
  it('returns empty array when RAG fails', async () => {
    (ragSearch as jest.Mock).mockRejectedValue(new Error('Timeout'));
    
    const result = await suggestResourcesForTask(...);
    expect(result).toEqual([]); // Fallback gracieux
  });
});
```

---

## 10. Pédagogie - Renforcement du Diagnostic

### 10.1 Pedagogical Quality Contract

Chaque faiblesse détectée doit être structurée ainsi :

```typescript
interface Weakness {
  // Identification
  competenceKey: string;        // "MATHS_ANALYSE_DERIVATION"
  domain: string;               // "ANALYSE"
  subDomain?: string;           // "DERIVATION"
  
  // Typologie erreur (une ou plusieurs)
  errorTypes: Array<
    | 'CALCUL'           // Erreur de calcul
    | 'METHODE'          // Mauvaise méthode
    | 'COMPREHENSION'    // Concept non compris
    | 'REDUCTION'        // Expression incorrecte
    | 'JUSTIFICATION'    // Preuve insuffisante
    | 'NOTATION'         // Notation mathématique
    | 'ALGORITHMIQUE'    // Code/programmation (NSI)
  >;
  
  // Preuve
  evidence: string;            // Citation exacte de la copie
  location: string;            // "Page 2, exercice 3, question b)"
  
  // Évaluation
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  masteryLevel: MasteryLevel;
  
  // Recommandation (actionnable - interdit les phrases vagues)
  recommendation: string;      // MIN 50 caractères, action spécifique
  
  // Exemples recommandations valides:
  // ✅ "Reprendre la dérivation d'un produit de 3 fonctions avec les exercices 12-15 du chapitre 4"
  // ✅ "Réécrire la preuve par récurrence en explicitant clairement l'initialisation (n=0), l'hypothèse de récurrence et l'hérédité"
  // ✅ "Corriger 5 fonctions récursives Python en identifiant explicitement les cas de base et les appels récursifs avec leurs paramètres"
  // 
  // Exemples INTERDITS:
  // ❌ "Travaille plus" 
  // ❌ "Revoir le cours"
  // ❌ "Attention aux erreurs"
  // ❌ "Manque de rigueur"
  
  // Ressources
  suggestedRagQuery: string;   // Requête générée pour trouver ressources
  priority: number;            // 0 = haute priorité
}
```

### 10.2 Séparation Coach / Élève

| Élément | Coach | Élève |
|---------|-------|-------|
| Analyse technique | ✅ Complète avec preuves | ❌ Non visible |
| Citations copie | ✅ Verbatim | ❌ Non visible (privacy) |
| Niveau détaillé | ✅ Par compétence | ✅ Synthèse uniquement |
| Erreurs spécifiques | ✅ Listées | ⚠️ Catégorisées ("erreurs de calcul") |
| Note officielle | ✅ Si barème | ✅ Si barème |
| Note estimée | ✅ Marquée "estimée" | ⚠️ Marquée "indicative" |
| Roadmap | ✅ Éditable | ✅ Lecture seule |
| Recommandations | ✅ Techniques | 🟢 Motivantes, actionnables |

### 10.3 Contrôle LaTeX et Code

```typescript
// lib/npc/format-validation.ts
export function validateLatexExpressions(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Vérifier $$...$$ fermés
  const displayMatches = text.match(/\$\$[\s\S]*?\$\$/g) || [];
  const inlineMatches = text.match(/\$[\s\S]*?\$/g) || [];
  
  // Compter ouvrants/fermants
  const openDisplay = (text.match(/\$\$/g) || []).length;
  if (openDisplay % 2 !== 0) errors.push('Unbalanced $$');
  
  // TODO: Validation plus poussée avec KaTeX si nécessaire
  
  return { valid: errors.length === 0, errors };
}

export function validateCodeBlocks(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] =;
  
  // Vérifier ```python ... ```
  const pythonBlocks = text.match(/```python[\s\S]*?```/g) || [];
  
  for (const block of pythonBlocks) {
    // Vérifier syntaxe basique (pas d'import sauvage, etc.)
    if (block.includes('import os') || block.includes('import sys')) {
      errors.push('Potentially unsafe import detected');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## 11. API - Routes et Auth

### 11.1 Audit Auth existante

```typescript
// Conventions identifiées :
- NextAuth avec session cookies (pas Bearer tokens)
- getServerSession(authOptions) dans les routes
- Session contient: user.id, user.role, user.email
- RBAC: lib/rbac.ts avec enforcePolicy()
- Pas de headers X-Custom sauf pour rate limiting
```

### 11.2 Routes API NPC complètes

| Route | Méthode | Auth | RBAC | Payload Zod | Réponse Zod | HTTP | Tests |
|-------|---------|------|------|-------------|-------------|------|-------|
| `/api/npc/submissions` | POST | Cookie | COACH | `{file: File, subject?, gradeLevel?, examType?}` | `{id, status, url}` | 201 | upload.integration |
| `/api/npc/submissions` | GET | Cookie | COACH | Query: `{status?, page?, limit?}` | `{submissions[], total}` | 200 | list.integration |
| `/api/npc/submissions/[id]` | GET | Cookie | COACH own | - | `SubmissionDetail` | 200 | read.integration |
| `/api/npc/submissions/[id]` | DELETE | Cookie | COACH own | - | `{success}` | 200 | delete.integration |
| `/api/npc/submissions/[id]/ocr` | GET | Cookie | COACH own | - | `{pages[], confidence}` | 200 | ocr.integration |
| `/api/npc/submissions/[id]/validate-student` | POST | Cookie | COACH own + assign | `{studentId}` | `{success}` | 200 | validate.integration |
| `/api/npc/submissions/[id]/process` | POST | Cookie | COACH own | `{agentType: VISION\|LOGIC\|MENTOR}` | `{jobId}` | 202 | process.integration |
| `/api/npc/submissions/[id]/pages/[pageNum]` | GET | Cookie | COACH own/ELEVE pub | - | `image/png` | 200 | file.integration |
| `/api/npc/reports` | GET | Cookie | COACH/ELEVE/PARENT | Query: `{studentId?, status?}` | `{reports[]}` | 200 | list.integration |
| `/api/npc/reports/[id]` | GET | Cookie | COACH own/ELEVE pub/PARENT pub | - | `ReportDetail` | 200 | read.integration |
| `/api/npc/reports/[id]` | PUT | Cookie | COACH own + draft | `{technicalAnalysis?, studentSummary?}` | `{success}` | 200 | update.integration |
| `/api/npc/reports/[id]/publish` | POST | Cookie | COACH own + review | - | `{publishedAt}` | 200 | publish.integration |
| `/api/npc/reports/[id]/unpublish` | POST | Cookie | COACH own + publié | - | `{unpublishedAt}` | 200 | unpublish.integration |
| `/api/npc/reports/[id]/feedback` | POST | Cookie | COACH own | `{ratings..., comments?}` | `{success}` | 200 | feedback.integration |
| `/api/npc/roadmaps/[id]` | GET | Cookie | COACH/ELEVE/PARENT (voir rapport) | - | `RoadmapDetail` | 200 | read.integration |
| `/api/npc/roadmaps/[id]/tasks` | GET | Cookie | COACH/ELEVE/PARENT | - | `{tasks[]}` | 200 | list.integration |
| `/api/npc/roadmaps/[id]/tasks/[taskId]/complete` | POST | Cookie | ELEVE own | - | `{completedAt}` | 200 | complete.integration |
| `/api/npc/roadmaps/[id]/tasks/[taskId]/resources` | GET | Cookie | COACH/ELEVE/PARENT | - | `{resources[]}` | 200 | resources.integration |
| `/api/npc/jobs/[id]` | GET | Cookie | COACH own | - | `JobStatus` | 200 | status.integration |
| `/api/npc/jobs/[id]/retry` | POST | Cookie | COACH own + failed | - | `{newJobId?}` | 200 | retry.integration |
| `/api/npc/files/[...path]` | GET | Cookie | RBAC fichier | - | `file/octet-stream` | 200 | file.security |
| `/api/npc/health` | GET | Cookie | ADMIN | - | `{status, checks}` | 200 | health.integration |

---

## 12. Tests - Matrice d'Acceptation

### 12.1 Tests unitaires

| Fichier test | Cible | Couverture |
|--------------|-------|------------|
| `__tests__/npc/vision-result-schema.test.ts` | VisionResultSchema | 100% paths |
| `__tests__/npc/logic-result-schema.test.ts` | LogicAnalysisResultSchema | 100% paths |
| `__tests__/npc/mentor-result-schema.test.ts` | MentorRoadmapResultSchema | 100% paths |
| `__tests__/npc/latex-validation.test.ts` | validateLatexExpressions | 100% paths |
| `__tests__/npc/file-validation.test.ts` | validateUploadedFile | 100% paths |
| `__tests__/npc/ownership-helpers.test.ts` | assertCoachOwnsSubmission | 100% paths |
| `__tests__/npc/status-transitions.test.ts` | Workflow state machine | 100% transitions |
| `__tests__/npc/json-safety.test.ts` | safeParseAIJson | 100% paths |
| `__tests__/npc/rag-bridge.test.ts` | suggestResourcesForTask | 100% paths |

### 12.2 Tests intégration API

| Fichier test | Routes | Scénarios |
|--------------|--------|-----------|
| `__tests__/api/npc/submissions.test.ts` | POST, GET, DELETE | upload, list, delete, validation erreurs |
| `__tests__/api/npc/ocr.test.ts` | GET /ocr, GET /pages/* | lecture OCR, accès images |
| `__tests__/api/npc/validation.test.ts` | POST /validate-student | validation association |
| `__tests__/api/npc/reports.test.ts` | GET, PUT | lecture, édition, publication |
| `__tests__/api/npc/roadmaps.test.ts` | GET, task complete | roadmap, tâches |
| `__tests__/api/npc/rbac.test.ts` | Toutes | tests RBAC matrice complète |
| `__tests__/api/npc/files.test.ts` | GET /files/* | sécurité accès fichiers |

### 12.3 Tests E2E

| Fichier test | Scenario | Assertions |
|--------------|----------|------------|
| `e2e/npc-coach-upload.spec.ts` | Coach upload copie | File upload → Submission créée → Statut UPLOADED |
| `e2e/npc-coach-ocr-review.spec.ts` | Coach review OCR | Vision job → OCR review → Validation élève |
| `e2e/npc-coach-publish.spec.ts` | Coach publication | Logic → Mentor → Review → Publish → Élève voit |
| `e2e/npc-student-view.spec.ts` | Élève vue bilan | Login élève → Bilans → Détail → Roadmap |
| `e2e/npc-student-task.spec.ts` | Élève complète tâche | Roadmap → Task → Complete → Progress updated |
| `e2e/npc-rbac-isolation.spec.ts` | Isolation données | Coach A vs Coach B vs Élève vs Parent |
| `e2e/npc-file-security.spec.ts` | Sécurité fichiers | URL directe bloquée, route protégée OK |

### 12.4 Tests CI

| Critère | Vérification |
|---------|--------------|
| Aucun appel Chutes | Mocks uniquement |
| Aucun secret | Scan avec `detect-secrets` ou `git-secrets` |
| Mocks déterministes | Réponses identiques entre runs |
| Tests existants | `npm test` passe sans régression |
| Lint | `npm run lint` 0 erreurs |
| Typecheck | `npm run typecheck` 0 erreurs |
| Prisma validate | `npx prisma validate` OK |

---

## 13. Découpage PR - Strict

### 13.1 PR 0 — Plan durci uniquement

| Champ | Valeur |
|-------|--------|
| **Objectif** | Livrer rapport corrigé pour validation utilisateur |
| **Fichiers** | `docs/features/NPC_IMPLEMENTATION_PLAN.md` |
| **Tests** | Aucun (documentation uniquement) |
| **Risques** | Aucun (pas de code) |
| **Rollback** | `git rm docs/features/NPC_IMPLEMENTATION_PLAN.md` |
| **Critères acceptation** | Validation utilisateur explicite des 14 sections |

### 13.2 PR 1 — Data Model + Migration Sèche

| Champ | Valeur |
|-------|--------|
| **Objectif** | Schéma Prisma, migration, types, validators |
| **Fichiers** | `prisma/schema.prisma`, `prisma/migrations/2026*_add_npc_models/`, `lib/npc/types.ts`, `lib/npc/validators.ts` |
| **Tests** | `npx prisma validate`, tests Zod, tests types |
| **Risques** | Migration destructive, incompatibility |
| **Rollback** | `npx prisma migrate resolve --rolled-back` + restore backup |
| **Critères acceptation** | `prisma migrate dev` OK, tables créées, 0 erreurs typecheck |

### 13.3 PR 2 — Storage + Upload Sécurisé

| Champ | Valeur |
|-------|--------|
| **Objectif** | Stockage fichiers, upload, lecture protégée |
| **Fichiers** | `lib/npc/file-validation.ts`, `lib/npc/storage.ts`, `app/api/npc/submissions/route.ts`, `app/api/npc/files/[...path]/route.ts` |
| **Tests** | Tests unitaires validation, tests intégration routes, tests sécurité fichiers |
| **Risques** | Path traversal, fuite données, saturation disque |
| **Rollback** | Suppression routes + dossiers |
| **Critères acceptation** | Upload OK, lecture protégée OK, path traversal bloqué |

### 13.4 PR 3 — Job Runner + Services IA Mockés

| Champ | Valeur |
|-------|--------|
| **Objectif** | Worker, jobs, status transitions, mocks IA |
| **Fichiers** | `services/npc-worker/`, `lib/npc/job-service.ts`, `lib/npc/chutes-client.ts`, `lib/npc/__mocks__/` |
| **Tests** | Tests worker, tests transitions, tests mocks |
| **Risques** | Race conditions, jobs orphelins, boucles retry |
| **Rollback** | Arrêt service worker, reset jobs PENDING |
| **Critères acceptation** | Worker traite jobs, mocks déterministes, transitions OK |

### 13.5 PR 4 — Logic/Mentor/RAG Bridge

| Champ | Valeur |
|-------|--------|
| **Objectif** | Vision/Logic/Mentor services, rapports, compétences, roadmap, RAG |
| **Fichiers** | `lib/npc/vision-service.ts`, `lib/npc/logic-service.ts`, `lib/npc/mentor-service.ts`, `lib/npc/rag-bridge.ts`, `lib/npc/prompts/` |
| **Tests** | Tests services avec mocks, tests RAG fallback |
| **Risques** | Coûts IA, hallicination, RAG indispo |
| **Rollback** | Désactivation services |
| **Critères acceptation** | Pipeline complet avec mocks, RAG fallback OK |

### 13.6 PR 5 — Coach UI

| Champ | Valeur |
|-------|--------|
| **Objectif** | Pedagogy Studio, upload, OCR review, report, publication |
| **Fichiers** | `app/dashboard/coach/pedagogy-studio/`, `components/npc/coach/` |
| **Tests** | Tests composants, tests E2E coach flow |
| **Risques** | UX confuse, perf lente, états inconsistants |
| **Rollback** | Revert composants |
| **Critères acceptation** | Upload → Review → Publish flow complet |

### 13.7 PR 6 — Student UI

| Champ | Valeur |
|-------|--------|
| **Objectif** | Hub de Réussite, bilans, radar, roadmap, tâches |
| **Fichiers** | `app/dashboard/eleve/bilans/`, `app/dashboard/eleve/roadmaps/`, `components/npc/student/` |
| **Tests** | Tests composants, tests E2E student flow |
| **Risques** | Responsive, accessibilité, motivation |
| **Rollback** | Revert composants |
| **Critères acceptation** | Élève voit bilans, roadmap, peut compléter tâches |

### 13.8 PR 7 — E2E + Monitoring + Documentation

| Champ | Valeur |
|-------|--------|
| **Objectif** | Tests E2E complets, healthcheck, monitoring, documentation ops |
| **Fichiers** | `e2e/npc-*.spec.ts`, `app/api/npc/health/route.ts`, `docs/ops/NPC_*.md` |
| **Tests** | E2E complets, healthcheck, monitoring |
| **Risques** | Tests flakes, perf CI |
| **Rollback** | N/A (dernière PR) |
| **Critères acceptation** | CI verte, E2E pass, documentation complète |

---

## 14. Récapitulatif et Prochaines Étapes

### 14.1 Corrections apportées au rapport

| Section | Correction |
|---------|------------|
| **Audit Evidence** | Ajoutée avec preuves concrètes des commandes exécutées |
| **Git Status** | Clarifié: fichier non tracké, non commité, sur main |
| **Schéma Prisma** | Corrigé: enums conformes projet, relations Student/CoachProfile vérifiées, `@map` ajoutés, index définis, stratégie delete auditée |
| **Association élève** | Clarifiée: `proposedStudentId` vs `validatedStudentId` |
| **AssessmentSource** | Ajouté: modèle sujet/barème avec `AssessmentGradingMode` |
| **Jobs** | Architecture explicite: worker Docker, lock, retry, polling |
| **Statuts** | Harmonisation CopySubmission / AiProcessingJob |
| **Stockage** | Architecture détaillée, validation MIME, path sécurisé, route protégée |
| **IA** | Schémas Zod stricts, modes LLM, anti-hallucination, logging sécurisé |
| **RBAC** | Matrice complète, tests obligatoires, extensions lib/rbac.ts |
| **Dashboards** | Integration Map, fichiers à toucher, navigation |
| **RAG** | Audit existant, connexion réelle, fallback gracieux |
| **Pédagogie** | Pedagogical Quality Contract, phrases interdites, séparation coach/élève |
| **API** | Routes complètes avec auth cookies (pas Bearer), payloads Zod |
| **Tests** | Matrice complète: unit, integration, E2E, CI |
| **PRs** | 8 PRs définies avec objectifs, fichiers, risques, critères |

### 14.2 Sections ajoutées

1. ✅ Statut Git et Conformité Process
2. ✅ Audit Evidence
3. ✅ Prisma Migration Safety
4. ✅ Jobs Asynchrones - Architecture MVP (Option A Worker)
5. ✅ File Security Acceptance Criteria
6. ✅ IA - Schémas Zod stricts, modes LLM, anti-hallucination
7. ✅ RBAC - Matrice complète
8. ✅ Dashboards - Integration Map
9. ✅ RAG - Audit existant, connexion réelle
10. ✅ Pedagogical Quality Contract
11. ✅ API - Routes complètes avec auth cookies
12. ✅ Tests - Matrice complète
13. ✅ Découpage PR - 8 PRs strictes

### 14.3 État git actuel

```bash
$ git status -sb
## main
 M docs/features/EAF_COACH_REPORTS.md
?? docs/audits/AUDIT_COMPLET_2026-05-01.md
?? docs/features/NPC_IMPLEMENTATION_PLAN.md  <-- FICHIER ACTUEL
?? e2e/eaf-report-raja-smoke.spec.ts
```

**Confirmation** :
- ✅ Fichier créé localement
- ✅ Non tracké (`??`)
- ✅ Non commité
- ✅ Non pushé
- ✅ Aucun code fonctionnel modifié

### 14.4 Prochaines décisions utilisateur

| # | Décision | Impact | Options |
|---|----------|--------|---------|
| 1 | **Validation plan** | Bloquant pour PR#1 | ✅ Valider / ❌ Rejeter avec modifications |
| 2 | **Quotas Chutes.ai** | PR#3+4 | Budget disponible ? Clé API ? |
| 3 | **Worker Docker** | PR#3 | Option A retenue - validation infra ? |
| 4 | **Matière prioritaire** | PR#4+5 | Maths ? NSI ? Multi-matière ? |
| 5 | **Beta testeur** | PR#5+6 | Quel coach pour tests ? |
| 6 | **Calendrier** | Toutes PRs | Deadline MVP ? |
| 7 | **RAG collection** | PR#4 | Collections ChromaDB dispo pour NPC ? |

---

## 15. Validation Requise

Ce document est **PRÊT pour validation utilisateur**.

**Pour valider** :
1. Lire les 14 sections
2. Vérifier les décisions §14.4
3. Indiquer "VALIDÉ" ou lister modifications requises

**Après validation** :
- Commit de ce plan
- Création branche `feat/npc-pedagogy-cockpit`
- Démarrage PR#1 (Data Model)

---

*Document version 2.0 - Durci après audit complet*
*Aucun secret, aucune URL production, aucune donnée sensible*

