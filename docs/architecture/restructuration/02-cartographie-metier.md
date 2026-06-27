# DOC-2 — Cartographie métier & incohérences

> Chaque affirmation est adossée à DOC-1 (sections a/b) et au code source.
> Preuve au niveau champ. On ne consolide pas pour consolider.
> Date : 2026-06-27

---

## Sommaire

1. [Signal 1 : Sprawl des modèles « rapport/bilan »](#signal-1--sprawl-des-7-modèles-rapportbilan)
2. [Signal 2 : Silos de progression par matière](#signal-2--silos-de-progression-par-matière)
3. [Signal 3 : Triade Diagnostic/Assessment/Bilan](#signal-3--triade-diagnosticassessmentbilan)
4. [Signal 4 : Chaîne facturation devis→paiement→entitlement→accès](#signal-4--chaîne-facturation)
5. [Signal 5 : Source de vérité « qui coache qui »](#signal-5--source-de-vérité-qui-coache-qui)
6. [Machines à états réelles](#machines-à-états-réelles)
7. [Carte des règles métier → SSOT](#carte-des-règles-métier--ssot)
8. [Risques](#risques)

---

## Signal 1 : Sprawl des 7 modèles « rapport/bilan »

### Modèles concernés

| Modèle | Table | Champs (hors id/timestamps) | Scope | Route créatrice |
|--------|-------|------|-------|-----------------|
| StudentReport | `student_reports` | 8 | Rapport périodique de suivi | **Aucune route production** (seed/test only) |
| SessionReport | `session_reports` | 10 | Débrief post-session 1:1 | `POST /api/coach/sessions/[sessionId]/report` |
| StageBilan | `stage_bilans` | 12 | Évaluation post-stage par coach | `POST /api/stages/[stageSlug]/bilans` (upsert) |
| EafPreparationReport | `eaf_preparation_reports` | 15 | Grille EAF rubric-based | `PUT /api/coach/students/[id]/eaf-preparation-report` |
| Bilan | `bilans` | 28 | Modèle canonique unifié | 6+ routes (voir Signal 3) |
| PedagogicalReport | `pedagogical_reports` | 14 + 3 relations | Diagnostic IA sur copie (NPC) | `POST /api/npc/submissions/[id]/generate` |
| GeneratedPedagogicalReport | `generated_pedagogical_reports` | 18 | PDF LLM fusionnant bilan élève + rapport coach | `lib/reports/stage/maybeCreateGeneratedReportJob.ts` |

### Champs partagés (preuve de recouvrement)

| Champ | StudentReport | SessionReport | StageBilan | EafPrep | Bilan | PedReport | GenPedReport |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `studentId` | x | x | x | x | x (?) | x | x |
| `coachId` | x (?) | x | x | x | x (?) | x (?) | x (?) |
| `strengths` | — | — | x (`String[]`) | x (`String? Text`) | — | x (`String[]`) | — |
| `recommendations`/`nextSteps` | x | x | x (`nextSteps`) | x (`nextSessionGoals`) | — | — | — |
| `domainScores`/`globalScore` | — | — | x (`scoreGlobal`, `domainScores Json`) | — | x (`globalScore`, `domainScores Json`) | — (dans CompetenceMatrix) | — |
| `isPublished`/`publishedAt` | — | — | x | — | x | — | — |
| `pdfUrl` | — | — | x | — | — | — | x |
| `status` (machine à états) | — | — | — | x (String) | x (BilanStatus enum) | x (PedReportStatus) | x (GenReportStatus) |
| `errorCode`/`retryCount` | — | — | — | — | x | — | x |

### Verdict par modèle

**StudentReport — MORT.** Aucune route production ne le crée (`grep -r 'prisma.studentReport.create' app/` : 0 résultats hors tests). Candidat à la suppression.

**SessionReport — JUSTIFIÉ SÉPARÉ.** Scope distinct : 1:1 avec `SessionBooking` (FK unique `sessionId`). Champs spécifiques : `performanceRating` (Int 1-5), `attendance` (Boolean), `engagementLevel` (enum), `homeworkAssigned`, `nextSessionFocus`. Pas substituable par Bilan.

**StageBilan — REDONDANCE PARTIELLE avec Bilan.** Les champs `scoreGlobal`/`domainScores`/`isPublished`/`publishedAt` existent dans les deux. Migration en cours : `Bilan.legacyStageBilanId` (String? @unique) existe comme bridge. Les nouveaux flux coach (EAF, maths) écrivent directement dans Bilan avec `type=STAGE_POST`. L'ancien flux `/api/stages/[stageSlug]/bilans` écrit encore dans StageBilan. **Convergence inachevée.**

**EafPreparationReport — JUSTIFIÉ SÉPARÉ.** 11 champs textuels de grille rubric (linearReading, workPresentation, interview, etc.) n'ont aucun équivalent dans les autres modèles. Sert d'INPUT au GeneratedPedagogicalReport (via `coachReportId`), pas de substitut. Unique `[studentId, coachId]`.

**Bilan (canonique) — CIBLE DE CONVERGENCE.** Superset intentionnel absorbant Diagnostic, Assessment, StageBilan via `BilanType` + `sourceVersion`. 5 sourceVersions actifs. Bridge FKs `legacy*Id` pour migration.

**PedagogicalReport (NPC) — JUSTIFIÉ SÉPARÉ.** Scope distinct : diagnostic IA sur copie scannée. A ses propres relations enfants (CompetenceMatrix, RemediationRoadmap, ReportFeedback, NpcAuditLog) et son propre pipeline (CopySubmission → AiProcessingJob → PedagogicalReport). Pas fusionnable avec Bilan sans casser le pipeline NPC.

**GeneratedPedagogicalReport — JUSTIFIÉ SÉPARÉ.** Scope distinct : PDF LaTeX généré par LLM à partir de 2 sources (bilan élève + rapport coach). Champs spécifiques : `latexSource`, `promptVersion`, `templateVersion`, `inputChecksum`, `kind` (EAF_STAGE_POST / MATHS_PREMIERE_STAGE_POST). Dédupliqué via `@@unique([studentId, stageSlug, subject, kind, inputChecksum])`.

### Conclusion Signal 1

| Modèle | Verdict |
|--------|---------|
| StudentReport | **MORT** — supprimer |
| SessionReport | **Séparation justifiée** |
| StageBilan | **Redondance partielle** — convergence vers Bilan à achever |
| EafPreparationReport | **Séparation justifiée** (input rubric) |
| Bilan | **Cible canonique** |
| PedagogicalReport | **Séparation justifiée** (pipeline NPC distinct) |
| GeneratedPedagogicalReport | **Séparation justifiée** (pipeline LaTeX distinct) |

**Coût actuel** : 2 modèles problématiques (StudentReport mort, StageBilan ↔ Bilan convergence inachevée). Les 5 autres ont des scopes distincts justifiés.

---

## Signal 2 : Silos de progression par matière

### Comparaison champ par champ

| Aspect | MathsProgress | EamProgress | NsiPracticeProgress | SurvivalProgress |
|--------|:---:|:---:|:---:|:---:|
| Champs domaine | **28** | **2** (`checks`, `quiz`) | **2** (`data`, `version`) | **8** + relation enfant |
| Pattern de stockage | Scalaires typés | JSON blob | JSON blob | Hybride (scalaires + JSON) |
| FK cible | `User` | `User` | `User` | `Student` |
| Cardinalité | Multiple (`@@unique[userId, level, track]`) | 1:1 (`@unique userId`) | 1:1 (`@unique userId`) | 1:1 (`@unique studentId`) |
| Table enfant | Non | Non | Non | Oui (`SurvivalAttempt`) |
| Champs spécifiques notables | `completedChapters[]`, `masteredChapters[]`, `totalXp`, `quizScore`, `comboCount`, `streak`, `srsQueue`, `diagnosticResults`, `errorTags`, 6 booleans feature-flags | `checks Json`, `quiz Json` | `data Json`, `version Int` | `examDate`, `reflexesState`, `phrasesState`, `qcmAttempts`, `qcmCorrect`, `rituals`, `notePotentielle` |

### Verdict

**MathsProgress — JUSTIFIÉ SÉPARÉ.** 28 champs scalaires typés (Int, Boolean, String[], Json) avec sémantique spécifique (XP, combos, streaks, SRS queue, error tags). Multi-row par user (level+track). Forcer dans un blob JSON = perte de type safety et d'indexabilité. Le modèle le plus mature.

**EamProgress + NsiPracticeProgress — CANDIDATS À LA FUSION.** Structure quasi-identique : `{ userId @unique, data: Json, timestamps }`. La seule différence est `version Int` sur NsiPracticeProgress. Une table unifiée `SubjectProgress` avec discriminateur `subject` et `@@unique([userId, subject])` fonctionnerait sans perte. **Économie : 1 table.**

**SurvivalProgress — JUSTIFIÉ SÉPARÉ.** FK vers `Student` (pas `User`), relation enfant `SurvivalAttempt` pour tracking granulaire des réponses, champs domaine spécifiques (`examDate`, `notePotentielle`, `rituals`).

### Conclusion Signal 2

| Modèle(s) | Verdict |
|-----------|---------|
| MathsProgress | **Séparation justifiée** |
| EamProgress + NsiPracticeProgress | **Vraie redondance** — fusionnable |
| SurvivalProgress + SurvivalAttempt | **Séparation justifiée** |

---

## Signal 3 : Triade Diagnostic/Assessment/Bilan

### Champs partagés entre les trois modèles (14 champs identiques)

| Champ | Diagnostic | Assessment | Bilan |
|-------|:---:|:---:|:---:|
| `publicShareId` (String @unique) | x | x | x |
| `studentEmail` (String) | x | x | x |
| `studentPhone` (String?) | x | x | x |
| `status` (enum/string) | x (String libre) | x (AssessmentStatus) | x (BilanStatus) |
| `analysisJson` (Json?) | x | x | x |
| `studentMarkdown` (String?) | x | x | x |
| `parentsMarkdown` (String?) | x | x | x |
| `nexusMarkdown` (String?) | x | x | x |
| `errorCode` (String?) | x | x | x |
| `errorDetails` (String?) | x | x | x |
| `retryCount` (Int) | x | x | x |
| `createdAt` / `updatedAt` | x | x | x |

### Champs dans Assessment + Bilan mais PAS Diagnostic

`subject`, `studentName`, `studentId` (FK), `globalScore`, `confidenceIndex`, `ssn`, `uai`, `progress`, `engineVersion`, `domainScores`

### Champs UNIQUEMENT dans Diagnostic (pas dans Bilan)

`studentFirstName`/`studentLastName` (nom splitté), `establishment`, `teacherName`, `mathAverage`, `specialtyAverage`, `bacBlancResult`, `classRanking`, `definitionKey`, `definitionVersion`, `promptVersion`, `modelUsed`, `analysisResult` (legacy String), `actionPlan` (legacy)

### Champs UNIQUEMENT dans Assessment (pas dans Bilan)

`grade`, `studentMetadata`, `answers` (Json), `duration`, `startedAt`, `completedAt`, `scoringResult` (Json), `assessmentVersion`, `userAgent`, `ipAddress`, `skillScores` (relation), `domainScores` (relation → DomainScore table)

### Champs UNIQUEMENT dans Bilan

`type` (BilanType enum), `legacyDiagnosticId/AssessmentId/StageBilanId`, `sourceData`, `stageId` (FK), `coachId` (FK), `isPublished`/`publishedAt`, `sourceVersion`, `ragUsed`/`ragCollections`

### Migration : état actuel (vérifié en code)

| Route | Crée | Modèle cible | Status migration |
|-------|------|-------------|------------------|
| `POST /api/bilan-pallier2-maths` | `prisma.diagnostic.create` | **Diagnostic** (legacy) | Non migré |
| `POST /api/assessments/submit` | `prisma.assessment.create` | **Assessment** (legacy) | Non migré |
| `POST /api/student/automatismes/attempts` | `prisma.assessment.create` | **Assessment** (legacy) | Non migré |
| `POST /api/bilans` | `prisma.bilan.create` | **Bilan** (canonique) | OK |
| `POST /api/eleve/questionnaire-*` | `prisma.bilan.create` | **Bilan** | OK |
| `POST /api/eleve/bilan-diagnostic-maths-terminale` | `prisma.bilan.create` | **Bilan** | OK |
| `POST /api/coach/eaf-stage-printemps/.../report` | `prisma.bilan.create` | **Bilan** | OK |
| `POST /api/coach/maths-premiere-stage-printemps/.../report` | `prisma.bilan.create` | **Bilan** | OK |

**5 sourceVersion actifs** (tous sur Bilan) :
`maths_premiere_stage_printemps_v1`, `eaf_stage_printemps_v1`, `maths_terminale_v1`, `coach_eaf_stage_printemps_v1`, `coach_maths_premiere_stage_printemps_v1`

### Bridge FKs (strangler fig)

`Bilan.legacyDiagnosticId → Diagnostic.id` (String? @unique, pas de @relation Prisma)
`Bilan.legacyAssessmentId → Assessment.id` (String? @unique, pas de @relation Prisma)
`Bilan.legacyStageBilanId → StageBilan.id` (String? @unique, pas de @relation Prisma)

Script de migration existant : `scripts/migrate-bilans.ts` (copie sourceData, rattache legacy FKs).

### DomainScore/SkillScore : orphelins de Bilan

Les tables relationnelles `DomainScore` et `SkillScore` ont un FK vers `Assessment` uniquement. Bilan stocke ses domain scores en `Json?`. Si Assessment migre vers Bilan, ces tables deviennent orphelines ou doivent être re-parentées.

### Verdict Signal 3

**Migration en cours, pas achevée.** 14 champs de sortie dupliqués identiquement sur les 3 modèles. Bilan est la cible canonique (superset). 2 routes legacy écrivent encore dans Diagnostic (1 route) et Assessment (2 routes). DomainScore/SkillScore non re-parentés. Coût : triple maintenance des champs de rendu tant que la migration n'est pas complète.

---

## Signal 4 : Chaîne facturation

### Modèles impliqués

`Payment` → (aucune FK) → `Invoice` → `InvoiceItem` (FK) → `Entitlement` (FK `sourceInvoiceId`)

**Fait critique** : Payment et Invoice n'ont **aucune FK** entre eux. Ils sont liés uniquement par la logique applicative dans les routes.

### Deux chemins de création

**Chemin 1 — Webhook ClicToPay** (`app/api/payments/validate/route.ts`) :
1. Webhook arrive → trouve Payment par `externalId`
2. Dans une `$transaction` : met Payment à COMPLETED
3. Crée Invoice directement en status PAID (saute DRAFT/SENT)
4. Appelle `activateEntitlements(invoice.id, tx)` atomiquement

**Chemin 2 — Facture manuelle admin** (`app/api/admin/invoices/[id]/route.ts`) :
1. Invoice créée séparément (DRAFT)
2. Admin transition DRAFT → SENT → PAID via PATCH
3. MARK_PAID déclenche `activateEntitlements()` dans une transaction

### Incohérence de type de montant

| Modèle | Champ montant | Type |
|--------|--------------|------|
| Payment | `amount` | `Float` |
| Invoice | `subtotal`, `discountTotal`, `taxTotal`, `total` | `Int` (millimes) |
| InvoiceItem | `unitPrice`, `total` | `Int` (millimes) |
| ClicToPayTransaction | `amount` | `Float` |

**Risque** : un Payment.amount en Float (e.g., `150.5`) et un Invoice.total en Int millimes (e.g., `150500`) représentent la même valeur avec des unités différentes. La conversion se fait dans `validateTransition()` via `assertMillimes()` mais seulement pour le `amountPaid` du MARK_PAID — pas pour le montant initial du Payment.

### Machine à états Invoice (source : `lib/invoice/transitions.ts`)

```
         MARK_SENT          MARK_PAID
DRAFT ──────────→ SENT ──────────→ PAID (terminal)
  │                 │
  │ CANCEL          │ CANCEL
  ▼                 ▼
CANCELLED (terminal)   CANCELLED (terminal)
```

**Transitions** : `validateTransition(currentStatus, action, meta?, invoiceTotal?)` — pure function.
**Guard RBAC** : `canPerformStatusAction(role)` — ADMIN et ASSISTANTE uniquement.
**Idempotence** : si déjà dans le statut cible, retourne `{ valid: true, noop: true }`.

### Side-effects des transitions (source : `app/api/admin/invoices/[id]/route.ts`)

| Action | Side-effects (dans $transaction) |
|--------|----------------------------------|
| MARK_SENT | Update status, append event. Pas de side-effect entitlement. |
| MARK_PAID | Update status + `paidAt` + `paymentMethod`. Révoquer tous access tokens. **`activateEntitlements(invoice.id, tx)`** → crée/prolonge entitlements + octroie crédits. |
| CANCEL | Update status + `cancelledAt`. Révoquer access tokens. **`suspendEntitlements(invoice.id, 'Invoice cancelled', tx)`** → suspend entitlements ACTIVE de cette facture. |

### Moteur d'entitlements (source : `lib/entitlement/engine.ts`)

| Mode | Comportement | Produits |
|------|-------------|----------|
| SINGLE | Noop si déjà ACTIVE pour ce productCode. Crée sinon. | STAGE_*, PREMIUM_* |
| EXTEND | Prolonge `endsAt` de `defaultDurationDays` si ACTIVE. Crée trace `(extension)`. Crée frais sinon. | ABONNEMENT_*, ARIA_ADDON_* |
| STACK | Crée toujours un nouvel entitlement. | CREDIT_PACK_* |

Si `grantsCredits > 0` : exécute `tx.student.update({ credits: { increment } })`.

### Verdict Signal 4

**Pas de machine à états unifiée.** Payment et Invoice sont des silos sans FK. La chaîne tient par la logique applicative. L'incohérence `Float` vs `Int millimes` est un risque d'arrondi. La machine à états Invoice→Entitlement via libs est bien implémentée (ACID, idempotente), mais le chemin webhook saute DRAFT/SENT, ce qui crée deux chemins incompatibles vers PAID.

---

## Signal 5 : Source de vérité « qui coache qui »

### Modèle déclaré : CoachStudentAssignment

Source : `prisma/schema.prisma` — `coachId` → CoachProfile, `studentId` → Student, `assignmentType` (PRIMARY/SECONDARY/STAGE/TEMPORARY), `status` (ACTIVE/SUSPENDED/ENDED), `subjects Subject[]`.

Géré par : `POST/PATCH /api/assistante/assignments`.

### Autres modèles avec `coachId` (set INDÉPENDAMMENT de CoachStudentAssignment)

| Modèle | Champ `coachId` | Set par | Vérifie l'assignment ? |
|--------|----------------|---------|----------------------|
| Session | `coachId → CoachProfile?` | Routes session | Non vérifié en code |
| SessionBooking | `coachId → User` | `/api/assistante/sessions` | Non vérifié en code |
| SessionReport | `coachId → CoachProfile` | `/api/coach/sessions/.../report` | Non vérifié (route vérifie auth COACH, pas assignment) |
| StageBilan | `coachId → CoachProfile` | `/api/stages/.../bilans` | Non — le coach crée le bilan pour tout étudiant du stage |
| Bilan | `coachId → CoachProfile?` | Multiples routes coach | Vérifié partiellement (certaines routes vérifient `isCoachRattachedToStudent`) |
| StageSession | `coachId → CoachProfile?` | Admin stage sessions | Non — admin assigne directement |
| StageCoach | `coachId → CoachProfile` | `/api/admin/stages/[id]/coaches` | Non — table de jonction stage-coach, pas student |
| CoachNote | `coachId → User` | `/api/coach/students/[id]/notes` | Oui — `isCoachRattachedToStudent()` vérifié |
| EafPreparationReport | `coachId → CoachProfile` | `/api/coach/.../eaf-preparation-report` | Oui — `assertCoachCanAccessStudent()` |
| CopySubmission (NPC) | `coachId → CoachProfile?` | `/api/npc/submissions` | Oui — via `canManageSubmissionDocuments()` |
| PedagogicalReport | `coachId → CoachProfile?` | NPC pipeline | Oui — hérité de CopySubmission |
| GeneratedPedReport | `coachId → CoachProfile?` | Report pipeline | Non — set depuis context, pas vérifié |

### Verdict Signal 5

**CoachStudentAssignment est la SOT déclarée mais pas imposée.** Le `coachId` est dénormalisé sur 12+ modèles. Certaines routes vérifient l'assignment (CoachNote, EafPreparationReport, NPC), d'autres non (SessionBooking, StageBilan, GeneratedPedReport). Le risque : un coach dont l'assignment passe à ENDED continue d'apparaître comme `coachId` sur les records existants. Pas de cascade de dé-affectation.

**Séparation justifiée pour StageCoach** : table de jonction stage-coach (quel coach enseigne quel stage), scope différent de coach-student (qui tutore qui).

---

## Machines à états réelles

### 1. Session : `SessionStatus` enum

```
SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED
    │           │            │
    │ cancel    │ cancel     │ no-show
    ▼           ▼            ▼
CANCELLED   CANCELLED    NO_SHOW

SCHEDULED → RESCHEDULED (puis re-SCHEDULED)
```

**Enum** : `SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW | RESCHEDULED`
**Transitions** : pas de fonction `validateTransition` dédiée. Les transitions sont inline dans les routes (`/api/sessions/cancel`, `/api/coach/sessions/[id]/report`).
**Politique d'annulation** : 24h avant pour ELEVE (via `sessions/cancel`), 48h pour COACH. Remboursement crédits via `CreditTransaction.create(type: REFUND)`.

### 2. Stage Reservation : `StageReservationStatus` enum

```
PENDING → CONFIRMED → COMPLETED
    │         │
    │         │ cancel
    ▼         ▼
WAITLISTED  CANCELLED
    │
    │ confirm
    ▼
CONFIRMED
```

**Enum** : `PENDING | CONFIRMED | WAITLISTED | CANCELLED | COMPLETED`
**Note** : double statut sur StageReservation — `status` (String legacy) + `richStatus` (StageReservationStatus? enum). Coexistence non résolue.

### 3. Facturation : `InvoiceStatus` enum

Voir [Signal 4](#signal-4--chaîne-facturation) pour le diagramme et les side-effects.

### 4. Pipeline pédagogique : Diagnostic → Bilan → Trajectoire → Roadmap

**Pas une machine à états linéaire** — c'est un pipeline à étapes indépendantes :

| Étape | Modèle | Status enum | Transitions |
|-------|--------|-------------|-------------|
| Diagnostic | `Diagnostic` ou `Bilan` | Diagnostic: String libre (`RECEIVED→VALIDATED→SCORED→GENERATING→ANALYZED→FAILED`) / Bilan: `BilanStatus` (`PENDING→SCORING→GENERATING→COMPLETED→FAILED`) | Inline dans routes + `lib/bilan-generator.ts` |
| Bilan rendu | `Bilan` | `BilanStatus` | `PENDING→SCORING→GENERATING→COMPLETED` |
| Trajectoire | `Trajectory` | `TrajectoryStatus` (`ACTIVE→PAUSED→COMPLETED→ABANDONED`) | `POST /api/coach/trajectory` crée en ACTIVE |
| Roadmap NPC | `RemediationRoadmap` | Pas d'enum status propre — via `PedagogicalReport.status` | Pipeline NPC |

**Observation** : le Diagnostic utilise un `status: String` libre (6 valeurs non-enum), alors que Bilan utilise `BilanStatus` enum (5 valeurs). Pas de correspondance 1:1. La migration Diagnostic→Bilan devra normaliser les statuts.

### 5. Pipeline NPC : Soumission → OCR → IA → Rapport

```
CopySubmission.status:
PENDING_UPLOAD → UPLOADED → PROCESSING_OCR → (OCR_FAILED)
                                 ↓
                          READY_FOR_AI → QUEUED_FOR_ANALYSIS → ANALYZING → (ANALYSIS_FAILED)
                                                                    ↓
                                                               COMPLETED → ARCHIVED

AiProcessingJob.status:
PENDING → QUEUED → CLAIMED → PROCESSING → (RETRYING) → COMPLETED | FAILED | CANCELLED

PedagogicalReport.status:
DRAFT → PENDING_VALIDATION → VALIDATED → SENT_TO_STUDENT → READ_BY_STUDENT → ARCHIVED
```

**Pas de `validateTransition` centralisée** — transitions inline dans `lib/npc/` et les routes NPC.

---

## Carte des règles métier → SSOT

### Sources canoniques

| Règle métier | SSOT | Accesseur | Consommateurs |
|-------------|------|-----------|---------------|
| Tarifs annuels, stages, ponctuels, packs | `data/pricing.canonical.json` | `lib/pricing.ts` (46 importeurs) | Pages offres, composants marketing, facturation, tests |
| Règles de paiement (acompte 30 %, 9 échéances, 5 % comptant, cap 20 %) | `data/pricing.canonical.json` → `rules.payment` | `computeDeposit()`, `computeSchedule()`, `applyDiscount()` | Facturation admin, devis assistante |
| Produits & activation (14 codes, modes SINGLE/EXTEND/STACK) | `lib/entitlement/types.ts` → `PRODUCT_REGISTRY` | `lib/entitlement/engine.ts` | `/api/payments/validate`, `/api/admin/invoices/[id]` |
| Features & gating (10 features, fallback HIDE/DISABLE/REDIRECT) | `lib/access/features.ts` | `lib/access/rules.ts` → `resolveAccess()` | `lib/access/guard.ts` |
| RBAC policies (30+ routes, 5 rôles) | `lib/rbac.ts` | `can()`, `enforcePolicy()` | 17 fichiers (routes + guard) |
| Groupes (max, min open) | `data/pricing.canonical.json` → `rules.group_max/min_open` | `lib/pricing.ts` → `getRules()` | **Aussi dupliqué dans `lib/group-rules.ts`** (4 composants marketing) |
| Entité juridique, banque, contact | `lib/legal.ts` | Direct import | 37 fichiers |
| CGV (remboursements, paiements) | `lib/cgv-policy.ts` | Direct import | 13 fichiers |
| Plans opérationnels (noms, prix, crédits) | `data/pricing.canonical.json` → `operational_*` | `lib/operational-catalog.ts` → `lib/constants.ts` | Dashboard, API subscriptions |
| Design tokens | `lib/theme/tokens.ts` | `tailwind.config.mjs` | Tous composants |
| Rate-limit presets | `lib/rate-limit/presets.ts` | `checkRateLimit()` | 20+ routes |

### Incohérences détectées

#### 1. `group-rules.ts` duplique `pricing.canonical.json` (MEDIUM)

**Preuve** :
- `pricing.canonical.json` → `rules.group_max: 5`, `rules.group_min_open: { lycee: 3, college: 4, online_live: 3, stage: 3, stage_college: 4 }`
- `lib/group-rules.ts` → `GROUP_RULES.group_max: 5`, `GROUP_RULES.group_min_open: { lycee: 3, college: 4 }`

Valeurs cohérentes pour les clés communes, mais `group-rules.ts` **manque** `online_live`, `stage`, `stage_college`. 4 composants marketing lisent `group-rules.ts` au lieu de `lib/pricing.ts`.

**Risque** : si `pricing.canonical.json` change, `group-rules.ts` ne suit pas automatiquement.

#### 2. Noms de plans ≠ codes PRODUCT_REGISTRY (MEDIUM)

**Preuve** :
- `operational_subscription_plans` : clés `ACCES_PLATEFORME`, `HYBRIDE`, `IMMERSION`
- `PRODUCT_REGISTRY` : codes `ABONNEMENT_ESSENTIEL`, `ABONNEMENT_HYBRIDE`, `ABONNEMENT_IMMERSION`

Le bridge est dans `resolveProductCode()` (fonction locale dans `app/api/payments/validate/route.ts`). Aucun lien compile-time entre les deux registres.

**Risque** : un nouveau plan ajouté dans un registre mais pas l'autre → entitlements silencieusement non activés.

#### 3. Crédits ACCES_PLATEFORME vs ABONNEMENT_ESSENTIEL (HIGH)

**Preuve** :
- `operational_subscription_plans.ACCES_PLATEFORME.credits_per_month: 0`
- `PRODUCT_REGISTRY.ABONNEMENT_ESSENTIEL.grantsCredits: 4`
- `resolveProductCode()` mappe `ACCES_PLATEFORME` / `ESSENTIEL` / `PLAN` → `ABONNEMENT_ESSENTIEL`

**Conséquence** : un client achetant « Accès Plateforme » (annoncé 0 crédits) reçoit 4 crédits via le moteur d'entitlements. Soit le marketing ment, soit le code ment. À clarifier.

#### 4. Feature `admin_facturation` orpheline (LOW)

`lib/access/features.ts` définit `admin_facturation` avec `requires: ['admin_facturation']`, mais aucun produit dans `PRODUCT_REGISTRY` ne grant cette feature. Fonctionne uniquement via l'exemption rôle ADMIN. La feature string est morte dans la couche entitlement.

---

## Risques

### Repris de DOC-1

**R1 — `/api/stages/[stageSlug]/inscrire` : rate-limit permissif** (DOC-1 b-ter).
Preset `api` (60/min) au lieu de `expensive` (10/h). Pas de CAPTCHA, pas de CSRF. Risque de spam de fausses inscriptions. Bloqué par contrainte unique `[email, academyId]` mais un attaquant peut varier les emails.

### Révélés par la cartographie

**R2 — Incohérence crédits ACCES_PLATEFORME / ABONNEMENT_ESSENTIEL** (HIGH).
Voir incohérence #3 ci-dessus. Impact direct sur la facturation.

**R3 — Payment.amount Float vs Invoice.total Int millimes** (MEDIUM).
Aucune conversion systématique. `assertMillimes()` ne vérifie que le `amountPaid` du MARK_PAID, pas le montant initial. Risque d'arrondi sur les centimes.

**R4 — Double statut StageReservation** (MEDIUM).
`status` (String legacy "PENDING"/"CONFIRMED") + `richStatus` (StageReservationStatus? enum). Les deux coexistent. Les routes lisent tantôt l'un tantôt l'autre. Risque d'état incohérent.

**R5 — CoachStudentAssignment non imposé** (MEDIUM).
12+ modèles dénormalisent `coachId` sans vérifier l'assignment actif. Si un assignment passe à ENDED, les records existants gardent l'ancien `coachId`. Pas de cascade.

**R6 — Diagnostic status String libre vs BilanStatus enum** (LOW).
6 valeurs String non contraintes (`RECEIVED`, `VALIDATED`, `SCORED`, `GENERATING`, `ANALYZED`, `FAILED`) vs 5 valeurs enum BilanStatus. La migration devra normaliser.

**R7 — DomainScore/SkillScore orphelins de Bilan** (LOW).
Ces tables relationnelles ne sont liées qu'à Assessment. Si Assessment migre vers Bilan, elles deviennent orphelines. Bilan stocke ses scores en `Json?` — les deux approches divergent.

**R8 — StudentReport mort** (LOW).
Modèle dans le schéma sans route production. Poids mort, confusion potentielle.

**R9 — Pas de `validateTransition` centralisée pour les sessions et les réservations** (LOW).
Seule Invoice a une machine à états formelle (`lib/invoice/transitions.ts`). Les autres cycles (session, réservation, NPC) font des transitions inline dans les routes sans validation centralisée.

---

> **FIN DOC-2** — En attente de validation avant DOC-3.
