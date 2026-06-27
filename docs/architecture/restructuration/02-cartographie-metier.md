# DOC-2 — Cartographie métier & incohérences (v2)

> Chaque affirmation est adossée à DOC-1 (sections a/b) et au code source.
> Preuve au niveau champ avec coordonnées fichier:ligne. On ne consolide pas pour consolider.
> Date : 2026-06-27

---

## Sommaire

1. [Signal 1 : Sprawl des modèles « rapport/bilan »](#signal-1--sprawl-des-7-modèles-rapportbilan)
2. [Signal 2 : Silos de progression par matière](#signal-2--silos-de-progression-par-matière)
3. [Signal 3 : Triade Diagnostic/Assessment/Bilan](#signal-3--triade-diagnosticassessmentbilan)
4. [Signal 4 : Chaîne facturation](#signal-4--chaîne-facturation)
5. [Signal 5 : Source de vérité « qui coache qui »](#signal-5--source-de-vérité-qui-coache-qui)
6. [Machines à états réelles](#machines-à-états-réelles)
7. [Carte des règles métier → SSOT](#carte-des-règles-métier--ssot)
8. [Risques](#risques)

---

## Signal 1 : Sprawl des 7 modèles « rapport/bilan »

### Verdict par modèle

**StudentReport — MORT.**
- Preuve mutation : `grep -r 'prisma.studentReport' app/ lib/` → 0 résultats hors `__tests__/` et `__tests__/setup/test-database.ts:112`
- Preuve lecture : `grep -r 'StudentReport' app/ lib/` → 0 résultats
- Seules occurrences : `__tests__/database/schema.test.ts:346` (create), `__tests__/setup/test-database.ts:112` (deleteMany cleanup)
- Relations déclarées dans le schéma (`prisma/schema.prisma:282` sur Student, `:342` sur CoachProfile) mais jamais consommées en production
- **Verdict** : modèle mort, 0 mutation production, 0 lecture production

**SessionReport — SÉPARATION JUSTIFIÉE.**
- Scope : 1:1 avec SessionBooking via `sessionId @unique` (`schema.prisma:793`)
- Champs spécifiques sans équivalent ailleurs : `performanceRating Int` (1-5), `attendance Boolean`, `engagementLevel EngagementLevel?`, `homeworkAssigned String?`, `nextSessionFocus String?`
- Créé par : `app/api/coach/sessions/[sessionId]/report/route.ts`

**StageBilan — REDONDANCE PARTIELLE avec Bilan, convergence inachevée.**
- Champs qui existent aussi dans Bilan : `scoreGlobal Float?` (StageBilan `:1151`) ↔ `globalScore Float?` (Bilan `:1369`), `domainScores Json?` (StageBilan `:1152`) ↔ (Bilan `:1373`), `isPublished Boolean` (StageBilan `:1158`) ↔ (Bilan `:1383`), `publishedAt DateTime?` (StageBilan `:1159`) ↔ (Bilan `:1384`)
- Bridge FK : `Bilan.legacyStageBilanId String? @unique` (`schema.prisma:1343`)
- Flux legacy actif : `app/api/stages/[stageSlug]/bilans/route.ts` écrit dans `prisma.stageBilan.upsert`
- Nouveaux flux coach écrivent dans Bilan : `app/api/coach/eaf-stage-printemps/.../report/route.ts`, `app/api/coach/maths-premiere-stage-printemps/.../report/route.ts`

**EafPreparationReport — SÉPARATION JUSTIFIÉE (grille rubric input).**
- 11 champs textuels de grille sans équivalent : `linearReading`, `workPresentation`, `interview`, `oralExpression`, `writingMethod`, `languageMastery`, `literaryCulture`, `strengths`, `areasToImprove`, `nextSessionGoals`, `coachFreeComment` (tous `String? @db.Text`, `schema.prisma:1922-1932`)
- Sert d'INPUT au GeneratedPedagogicalReport via `coachReportId` (`lib/reports/stage/buildReportContext.ts`)

**Bilan (canonique) — CIBLE DE CONVERGENCE.**
- 5 sourceVersions actifs (vérifiés par grep dans `lib/` et `app/api/`) :
  - `maths_premiere_stage_printemps_v1` (`app/api/eleve/questionnaire-maths-premiere-stage-printemps/route.ts`)
  - `eaf_stage_printemps_v1` (`app/api/eleve/questionnaire-eaf-stage-printemps/route.ts`)
  - `maths_terminale_v1` (`lib/diagnostic/maths-terminale/types.ts`)
  - `coach_eaf_stage_printemps_v1` (`lib/coach/eaf-stage-printemps/types.ts`)
  - `coach_maths_premiere_stage_printemps_v1` (`app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts`)

**PedagogicalReport (NPC) — SÉPARATION JUSTIFIÉE.**
- Pipeline distinct : CopySubmission → AiProcessingJob → PedagogicalReport → CompetenceMatrix + RemediationRoadmap
- Relations enfants propres : `competenceMatrix` (1:1, `schema.prisma:2226`), `remediationRoadmap` (1:1, `:2227`), `feedback ReportFeedback[]` (`:2230`), `auditLogs NpcAuditLog[]` (`:2231`)

**GeneratedPedagogicalReport — SÉPARATION JUSTIFIÉE.**
- Champs spécifiques : `latexSource String?` (`:2381`), `promptVersion`/`templateVersion` (`:2367-2368`), `inputChecksum` (`:2373`), `kind String` (`:2366`)
- Dédupliqué via `@@unique([studentId, stageSlug, subject, kind, inputChecksum])` (`:2388`)

---

## Signal 2 : Silos de progression par matière

### Constat factuel champ par champ

**EamProgress** (`schema.prisma:1773-1783`, table `eam_progress`) :
- `checks Json @default("{}")` — état des cases cochées
- `quiz Json @default("{}")` — résultats quiz
- Cardinalité : `userId @unique` (1:1 par user)

**NsiPracticeProgress** (`schema.prisma:1787-1797`, table `nsi_practice_progress`) :
- `data Json` — objet NsiProgress complet
- `version Int @default(1)` — version du schéma de données
- Cardinalité : `userId @unique` (1:1 par user)

**Différences factuelles** : EamProgress a 2 champs JSON distincts (`checks` + `quiz`), NsiPracticeProgress a 1 champ JSON unique (`data`) + un champ `version`. Les deux sont des wrappers JSON 1:1 par user avec la même structure de base `{ userId, timestamps }`.

**Proposition de design** (pas un fait) : ces deux modèles pourraient être fusionnés dans une table `SubjectProgress` avec discriminateur `subject String` et `@@unique([userId, subject])`. Le champ `version` de NsiPracticeProgress deviendrait nullable. La proposition économise 1 table mais perd la distinction sémantique au niveau schéma.

**MathsProgress** (`schema.prisma:1722-1769`, table `maths_progress`) :
- 28 champs domaine typés (Int, Boolean, String[], Json)
- Cardinalité : `@@unique([userId, level, track])` — multiple par user
- **Séparation justifiée** : forcer dans un blob JSON = perte de type safety et d'indexabilité

**SurvivalProgress** (`schema.prisma:1800-1815`, table `survival_progress`) :
- FK vers `Student` (pas `User` — `schema.prisma:1802`)
- Relation enfant `SurvivalAttempt` (`schema.prisma:1817-1828`)
- Champs domaine spécifiques : `examDate DateTime`, `notePotentielle Float?`
- **Séparation justifiée** : FK différente, table enfant, champs domaine distincts

---

## Signal 3 : Triade Diagnostic/Assessment/Bilan

### Champs de sortie dupliqués (14 champs identiques sur les 3 modèles)

| Champ | Diagnostic (ligne) | Assessment (ligne) | Bilan (ligne) |
|-------|:--:|:--:|:--:|
| `publicShareId String @unique` | :1000 | :1219 | :1339 |
| `studentEmail String` | :1011 | :1224 | :1357 |
| `studentPhone String?` | :1012 | :1226 | :1358 |
| `analysisJson Json?` | :1023 | :1241 | :1378 |
| `studentMarkdown String?` | :1024 | :1242 | :1374 |
| `parentsMarkdown String?` | :1025 | :1243 | :1375 |
| `nexusMarkdown String?` | :1026 | :1244 | :1376 |
| `errorCode String?` | :1027 | :1250 | :1386 |
| `errorDetails String?` | :1028 | :1251 | :1387 |
| `retryCount Int` | :1029 | :1252 | :1388 |

*(Les numéros de ligne renvoient à `prisma/schema.prisma`)*

### Routes créatrices (état de la migration)

| Route | Crée dans | Preuve |
|-------|----------|-------|
| `POST /api/bilan-pallier2-maths` | `Diagnostic` | `app/api/bilan-pallier2-maths/route.ts` → `prisma.diagnostic.create` |
| `POST /api/assessments/submit` | `Assessment` | `app/api/assessments/submit/route.ts` → `prisma.assessment.create` |
| `POST /api/student/automatismes/attempts` | `Assessment` | `app/api/student/automatismes/attempts/route.ts` → `prisma.assessment.create` |
| Toutes les autres routes bilans | `Bilan` | Voir Signal 1 sourceVersions |

**Conclusion** : 3 routes legacy, 6+ routes canoniques. Migration en cours, pas achevée.

### DomainScore/SkillScore orphelins de Bilan

- `DomainScore` : FK `assessmentId → Assessment` (`schema.prisma:1261`). Aucun lien vers Bilan.
- `SkillScore` : FK `assessmentId → Assessment` (`schema.prisma:1272`). Aucun lien vers Bilan.
- Bilan stocke ses scores en `domainScores Json?` (`schema.prisma:1373`) — approche différente (dénormalisée).

---

## Signal 4 : Chaîne facturation

### Payment ↔ Invoice : pas de FK

- `Payment` (`schema.prisma:555-575`) : aucun champ `invoiceId`
- `Invoice` (`schema.prisma:1501-1549`) : aucun champ `paymentId`
- Lien applicatif uniquement dans `app/api/payments/validate/route.ts:282-340` (crée Invoice dans $transaction)

### Machine à états Invoice

Source : `lib/invoice/transitions.ts:32-57` (const `TRANSITIONS`)

```
DRAFT → SENT (MARK_SENT) → PAID (MARK_PAID, terminal)
DRAFT → CANCELLED (CANCEL, terminal)
SENT → CANCELLED (CANCEL, terminal)
```

Guard : `canPerformStatusAction(role)` (`lib/invoice/transitions.ts:68`) — ADMIN + ASSISTANTE

### Side-effects MARK_PAID

Source : `app/api/admin/invoices/[id]/route.ts:157-210` (dans $transaction) :
1. `prisma.invoice.update` → status PAID, paidAt, paymentMethod (`:176`)
2. `prisma.invoiceAccessToken.updateMany` → revokedAt (`:188`)
3. `activateEntitlements(invoice.id, tx)` (`lib/entitlement/engine.ts:51`) → crée/prolonge entitlements + octroie crédits

### Side-effects CANCEL

Source : `app/api/admin/invoices/[id]/route.ts:215-250` :
1. `prisma.invoice.update` → status CANCELLED, cancelledAt (`:231`)
2. Token revocation (`:241`)
3. `suspendEntitlements(invoice.id, 'Invoice cancelled', tx)` (`lib/entitlement/engine.ts:155`)

### Moteur d'entitlements

Source : `lib/entitlement/engine.ts`, Product Registry : `lib/entitlement/types.ts:85-150`

| Mode | Comportement | Produits |
|------|-------------|----------|
| SINGLE | Noop si ACTIVE pour ce productCode. Crée sinon. | STAGE_*, PREMIUM_* |
| EXTEND | Prolonge `endsAt` si ACTIVE. Crée trace `(extension)`. | ABONNEMENT_*, ARIA_ADDON_* |
| STACK | Crée toujours. | CREDIT_PACK_* |

Credit grant : `lib/entitlement/engine.ts:130` — `tx.student.update({ credits: { increment: creditsGranted } })`

### Incohérence Float vs Int millimes

- `Payment.amount Float` (`schema.prisma:563`)
- `ClicToPayTransaction.amount Float` (`schema.prisma:596`)
- `Invoice.total Int` (millimes) (`schema.prisma:1529`, commentaire "in millimes")
- `InvoiceItem.unitPrice Int` (millimes) (`schema.prisma:1583`, commentaire "in millimes (1 TND = 1000)")
- `assertMillimes()` ne vérifie que `payment.amountPaid` lors de MARK_PAID (`lib/invoice/transitions.ts:133`), pas le montant initial

---

## Signal 5 : Source de vérité « qui coache qui »

### Classification des 14 modèles avec `coachId`

#### Propriétaire légitime (le coach EST l'auteur/responsable du record)

| Modèle | Ligne schema | Rôle du coachId |
|--------|:---:|---|
| CoachStudentAssignment | :1845 | SOT déclarée : quel coach tutore quel élève |
| CoachAvailability | :695 | Disponibilités du coach (self-referencing) |
| CoachNote | :1822 | Auteur de la note (le coach qui écrit) |
| SessionReport | :801 | Coach qui a conduit la session et rédige le rapport |
| StageCoach | :1105 | Table de jonction stage-coach (quel coach enseigne le stage) |
| StageSession | :1087 | Coach assigné à une session de stage |
| EafPreparationReport | :1920 | Coach qui évalue la préparation EAF de l'élève |
| CopySubmission | :2063 | Coach qui soumet/supervise la copie NPC |

#### Dénormalisation recopiée (coachId posé sur le record sans synchro/cascade avec l'assignment)

| Modèle | Ligne schema | Risque |
|--------|:---:|---|
| Session | :431 | `coachId` set lors de la création, pas de vérification assignment |
| SessionBooking | :727 | `coachId` set par `/api/assistante/sessions`, pas de vérification assignment |
| StageBilan | :1143 | `coachId` set lors de la création du bilan, le coach peut ne plus être assigné au stage |
| Bilan | :1361 | `coachId` set par les routes coach, partiellement vérifié (`assertCoachCanAccessStudent` sur certaines routes, pas toutes) |
| StudentReport | :536 | Modèle mort (voir Signal 1) |
| PedagogicalReport | :2204 | Hérité de CopySubmission, pas re-vérifié |
| GeneratedPedagogicalReport | :2358 | Set depuis le context du pipeline, pas de vérification d'assignment |

**Risque concret** : si un CoachStudentAssignment passe à `status: ENDED` (`schema.prisma:1853`), les `coachId` sur les records existants de la colonne droite ne sont PAS mis à jour. Il n'y a pas de cascade ni de trigger de synchronisation. Les records orphelins restent liés à l'ancien coach.

### Routes qui vérifient l'assignment avant d'agir

Vérification via `isCoachRattachedToStudent` ou `assertCoachCanAccessStudent` (`lib/rbac/coach-student-access.ts`) :
- `app/api/coach/students/[studentId]/survival-mode/route.ts:38`
- `app/api/coach/students/[studentId]/documents/route.ts:42,115`
- `app/api/coach/students/[studentId]/generated-reports/route.ts:45,112`
- `app/api/coach/maths-premiere-stage-printemps/.../report/route.ts:33,144`
- `app/api/coach/maths-premiere-stage-printemps/.../regenerate-student/route.ts:33`
- `app/api/coach/students/[studentId]/notes/route.ts` (via `isCoachRattachedToStudent`)

### Routes qui NE vérifient PAS l'assignment

- `app/api/coach/sessions/[sessionId]/report/route.ts` — vérifie auth COACH, pas l'assignment au student
- `app/api/stages/[stageSlug]/bilans/route.ts` — vérifie rôle COACH/ADMIN/ASSISTANTE, pas l'assignment
- `app/api/coach/dashboard/route.ts` — filtre par coachProfile.id, pas par assignments

---

## Machines à états réelles

### Session : `SessionStatus` (`schema.prisma:115-123`)

Enum : `SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW | RESCHEDULED`

Pas de `validateTransition` centralisée. Transitions inline :
- Cancel : `app/api/sessions/cancel/route.ts` (vérifie politique 24h/48h)
- Complete : `app/api/coach/sessions/[sessionId]/report/route.ts`

### Stage Reservation

Double statut (`schema.prisma:1179,1193`) :
- `status String @default("PENDING")` — legacy, valeurs libres
- `richStatus StageReservationStatus?` — enum `PENDING|CONFIRMED|WAITLISTED|CANCELLED|COMPLETED`
- Commentaire schema : `// Rich status mirroring new enum (kept alongside legacy String status for compat)`

Pas de `validateTransition` centralisée.

### Invoice : voir [Signal 4](#signal-4--chaîne-facturation)

Seul cycle avec machine à états formelle (`lib/invoice/transitions.ts`).

### Pipeline pédagogique

Pas une machine à états linéaire — étapes indépendantes :
- Diagnostic/Bilan : `BilanStatus` enum (`PENDING→SCORING→GENERATING→COMPLETED→FAILED`, `schema.prisma:232-238`)
- Diagnostic legacy : `status String` libre, 6 valeurs (`RECEIVED/VALIDATED/SCORED/GENERATING/ANALYZED/FAILED`), `schema.prisma:1019`
- Trajectoire : `TrajectoryStatus` (`ACTIVE→PAUSED→COMPLETED→ABANDONED`, `schema.prisma:225-230`)
- NPC : `CopySubmissionStatus` (10 valeurs, `schema.prisma:148-159`), `AiJobStatus` (8 valeurs, `schema.prisma:177-186`), `PedagogicalReportStatus` (6 valeurs, `schema.prisma:189-196`)

Aucune de ces machines n'a de `validateTransition` centralisée — toutes font des transitions inline dans les routes.

---

## Carte des règles métier → SSOT

| Règle métier | SSOT (fichier) | Accesseur | Consommateurs (count) |
|-------------|------|-----------|---------|
| Tarifs, offres, formules, stages, packs | `data/pricing.canonical.json` | `lib/pricing.ts` | 46 fichiers |
| Règles paiement (acompte 30%, 9 échéances, cap 20%) | `data/pricing.canonical.json` → `rules.payment` | `computeDeposit()`, `computeSchedule()` | facturation, devis |
| Produits & activation (14 codes, SINGLE/EXTEND/STACK) | `lib/entitlement/types.ts` → `PRODUCT_REGISTRY` | `lib/entitlement/engine.ts` | 6+ fichiers |
| Features & gating (10 features) | `lib/access/features.ts` | `resolveAccess()` | `lib/access/guard.ts` |
| RBAC (30+ policies, 5 rôles) | `lib/rbac.ts` | `can()`, `enforcePolicy()` | 17 fichiers |
| Groupes (max, min open) | `data/pricing.canonical.json` → `rules.group_*` | `lib/pricing.ts` → `getRules()` | via pricing (+ duplication `lib/group-rules.ts` → 4 composants) |
| Entité juridique | `lib/legal.ts` | direct import | 37 fichiers |
| CGV | `lib/cgv-policy.ts` | direct import | 13 fichiers |
| Plans opérationnels | `data/pricing.canonical.json` → `operational_*` | `lib/operational-catalog.ts` | 10 fichiers |
| Design tokens | `lib/theme/tokens.ts` | `tailwind.config.mjs` | tous composants |
| Rate-limit presets | `lib/rate-limit/presets.ts` | `checkRateLimit()` | 20+ routes |

### Incohérence : `group-rules.ts` duplique `pricing.canonical.json`

- `data/pricing.canonical.json` (grep `group_max`) : `rules.group_max: 5`, `rules.group_min_open: { lycee: 3, college: 4, online_live: 3, stage: 3, stage_college: 4 }`
- `lib/group-rules.ts:3-7` : `GROUP_RULES = { group_max: 5, group_min_open: { lycee: 3, college: 4 } }`
- Valeurs cohérentes pour les clés communes, mais `group-rules.ts` manque `online_live`, `stage`, `stage_college`
- 4 composants marketing lisent `group-rules.ts` au lieu de `lib/pricing.ts` : `app/equipe/page.tsx`, `app/HomePageClient.tsx`, `components/marketing/acadomia-inspired.tsx`, `components/premium/MethodSection.tsx`

---

## Risques

### R1 — Rate-limit permissif sur `/api/stages/[stageSlug]/inscrire` (MEDIUM)

- **Coordonnées** : `app/api/stages/[stageSlug]/inscrire/route.ts:17` → `guardRateLimitAsync(req, { preset: 'api', keySuffix: ... })`
- **Preset** : `lib/rate-limit/presets.ts:23` → `api: { limit: 60, windowMs: 60_000 }` (60 req/min)
- **Comparaison** : `assessments/submit` utilise `expensive` (10/h). Un formulaire d'inscription devrait utiliser un preset similaire.
- **Protection partielle** : contrainte unique `[email, academyId]` (`schema.prisma:1204`) bloque les doublons par email

### R2 — Collision crédits ACCES_PLATEFORME / ABONNEMENT_ESSENTIEL (HIGH)

- **Étape 1** : parent initie paiement type `subscription`, clé `ACCES_PLATEFORME` → Payment créé avec `metadata.itemKey = 'ACCES_PLATEFORME'` (`app/api/payments/bank-transfer/confirm/route.ts:136`)
- **Étape 2** : admin valide → `resolveProductCode('ACCES_PLATEFORME')` → retourne `'ABONNEMENT_ESSENTIEL'` (`app/api/payments/validate/route.ts:41-44`)
- **Étape 3** : `activateEntitlements` avec product `ABONNEMENT_ESSENTIEL` → `grantsCredits: 4` (`lib/entitlement/types.ts:133`)
- **Étape 4** : crédits octroyés au student (`lib/entitlement/engine.ts:130`)
- **Conflit** : `data/pricing.canonical.json:1339` déclare `ACCES_PLATEFORME.credits: 0`
- **Impact** : client achetant « Accès Plateforme » (annoncé 0 crédits) reçoit 4 crédits via entitlements. Soit le marketing (canonical JSON) est incorrect, soit le mapping (resolveProductCode) est incorrect, soit ACCES_PLATEFORME et ABONNEMENT_ESSENTIEL sont intentionnellement des concepts distincts qui ne devraient pas être mappés l'un vers l'autre.

### R3 — Payment.amount Float vs Invoice.total Int millimes (MEDIUM)

- **Payment** : `amount Float` (`schema.prisma:563`)
- **Invoice** : `total Int` (`schema.prisma:1529`, commentaire `// in millimes`)
- **Vérification partielle** : `assertMillimes()` ne vérifie que `payment.amountPaid` lors de MARK_PAID (`lib/invoice/transitions.ts:133`), pas le montant initial du Payment

### R4 — Double statut StageReservation (MEDIUM)

- **Legacy** : `status String @default("PENDING")` (`schema.prisma:1179`)
- **Enum** : `richStatus StageReservationStatus?` (`schema.prisma:1193`)
- **Commentaire schema** : `// Rich status mirroring new enum (kept alongside legacy String status for compat)` (`:1192`)

### R5 — coachId dénormalisé sans cascade (MEDIUM)

- **7 modèles** de la catégorie « dénormalisation » (voir Signal 5 tableau droite) portent un `coachId` qui n'est pas synchronisé si `CoachStudentAssignment.status` passe à `ENDED`
- **Modèles affectés** : Session (`:431`), SessionBooking (`:727`), StageBilan (`:1143`), Bilan (`:1361`), PedagogicalReport (`:2204`), GeneratedPedagogicalReport (`:2358`)
- **StudentReport (`:536`)** est mort → hors scope

### R6 — Diagnostic status String libre vs BilanStatus enum (LOW)

- **Diagnostic** : `status String @default("RECEIVED")` (`schema.prisma:1019`) — 6 valeurs non contraintes
- **Bilan** : `status BilanStatus` (`schema.prisma:1380`) — enum 5 valeurs (`PENDING/SCORING/GENERATING/COMPLETED/FAILED`)
- La migration Diagnostic→Bilan devra normaliser les statuts

### R7 — DomainScore/SkillScore orphelins de Bilan (LOW)

- `DomainScore.assessmentId → Assessment` (`schema.prisma:1261`)
- `SkillScore.assessmentId → Assessment` (`schema.prisma:1272`)
- Bilan utilise `domainScores Json?` (`schema.prisma:1373`) — pas de table relationnelle
- Si Assessment migre vers Bilan, ces tables doivent être re-parentées ou abandonnées

### R8 — StudentReport mort (LOW)

- 0 mutation production, 0 lecture production (voir Signal 1 preuve)
- Définition schema : `schema.prisma:529-542`

### R9 — Pas de validateTransition centralisée pour sessions/réservations (LOW)

- Invoice : `lib/invoice/transitions.ts` (machine à états formelle avec `TRANSITIONS` map)
- Session : transitions inline dans `app/api/sessions/cancel/route.ts`, `app/api/coach/sessions/[sessionId]/report/route.ts`
- StageReservation : transitions inline
- NPC pipeline : transitions inline dans `lib/npc/` et routes NPC

### R10 — Noms de plans ≠ codes PRODUCT_REGISTRY (MEDIUM)

- `operational_subscription_plans` clés : `ACCES_PLATEFORME`, `HYBRIDE`, `IMMERSION` (`data/pricing.canonical.json:1336,1343,1350`)
- `PRODUCT_REGISTRY` codes : `ABONNEMENT_ESSENTIEL`, `ABONNEMENT_HYBRIDE`, `ABONNEMENT_IMMERSION` (`lib/entitlement/types.ts:127,136,145`)
- Bridge : `resolveProductCode()` dans `app/api/payments/validate/route.ts:36-68` — fonction locale, pas de lien compile-time
- Risque : un nouveau plan ajouté dans un registre mais pas l'autre → entitlements non activés

---

> **FIN DOC-2 v2** — En attente de validation avant DOC-3.
