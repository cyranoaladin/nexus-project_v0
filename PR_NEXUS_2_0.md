# PR: feat(nexus-2.0): Learning Graph v2 — SSN, DomainScores, Cohort, RBAC, Dataset 50Q

## Résumé

Implémentation complète des 6 points bloquants Nexus 2.0 :
1. **Dataset 50Q versionné** (`maths_terminale_spe_v1`) + `loadByVersion()`
2. **DomainScore persistence** (incl. score=0) via raw SQL + migration
3. **SSN computation** (z-score normalization) + cohort stats
4. **Result API enrichie** (SSN, domainScores, skillScores, percentile, cohort context)
5. **Admin RBAC** (directeur/stats + recompute-ssn) avec audit logs
6. **Migration Learning Graph v2** (4 nouvelles tables + 5 colonnes assessments)

### Note architecturale

**COMPLETED** = assessment prêt, `globalScore` final, SSN calculé.
Le status passe à `COMPLETED` après le BilanGenerator async. Le scoring et la persistence
DomainScore/SSN sont synchrones et garantis avant la réponse 201.

---

## Preuve A — Git Status + Diff Stat

```
$ git status --short
 M app/api/assessments/[id]/result/route.ts
 M app/api/assessments/submit/route.ts
 M app/assessments/[id]/result/page.tsx
 M lib/assessments/questions/loader.ts
 M lib/assessments/questions/maths/terminale/analyse.ts
 M lib/assessments/questions/maths/terminale/geometrie.ts
 M lib/assessments/questions/maths/terminale/log-exp.ts
 M lib/assessments/questions/maths/terminale/probabilites.ts
 M package-lock.json
 M package.json
 M prisma/schema.prisma
 M tsconfig.tsbuildinfo
?? app/admin/directeur/
?? app/api/admin/directeur/
?? app/api/admin/recompute-ssn/
?? app/api/assessments/[id]/export/
?? app/api/assessments/predict/
?? components/assessments/ResultRadar.tsx
?? components/assessments/SSNCard.tsx
?? components/assessments/SimulationPanel.tsx
?? components/assessments/SkillHeatmap.tsx
?? components/dashboard/MetricCard.tsx
?? lib/core/
?? lib/data/assessments/
?? lib/pdf/
?? prisma/migrations/20260217_learning_graph_v2/

$ git diff --stat
 12 files changed, 1442 insertions(+), 161 deletions(-)
```

## Preuve B — TypeCheck + Lint

```
$ npx tsc --noEmit
# 0 erreurs dans le code source (app/, lib/, components/)
# 3 erreurs pré-existantes dans __tests__/components/navigation-item.test.tsx (icon: LucideIcon → string)

$ npx next lint
# 0 erreurs
# Warnings pré-existants uniquement (unused vars dans fichiers non touchés)
```

## Preuve C — Prisma Validate + Generate + Build

```
$ head -10 prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀

$ npx prisma generate
✔ Generated Prisma Client (v6.19.2)

$ npx next build
✓ Build complet — toutes les pages compilées
```

### Tables cibles (@@map dans schema.prisma)

| Table | Ligne |
|---|---|
| `students` | l.179 |
| `assessments` | l.948 |
| `domain_scores` | l.966 |
| `skill_scores` | l.982 |
| `progression_history` | l.995 |
| `projection_history` | l.1012 |

## Preuve D — Migration Sandbox Docker (BLOQUANT PROD)

### Protocole reproduit

```bash
# 1. Créer sandbox PostgreSQL isolée
docker run -d --name nexus-sandbox-db \
  -e POSTGRES_USER=nexus_sandbox \
  -e POSTGRES_PASSWORD=sandbox123 \
  -e POSTGRES_DB=nexus_sandbox \
  -p 5499:5432 postgres:15-alpine

# 2. prisma migrate deploy (exactement comme en prod)
DATABASE_URL="postgresql://nexus_sandbox:sandbox123@127.0.0.1:5499/nexus_sandbox" \
  npx prisma migrate deploy
```

### Sortie

```
Datasource "db": PostgreSQL database "nexus_sandbox", schema "public" at "127.0.0.1:5499"
11 migrations found in prisma/migrations

Applying migration `20260201114538_init_postgres_prod`
Applying migration `20260201201047_add_payment_idempotency`
Applying migration `20260201201415_add_session_overlap_prevention`
Applying migration `20260201201534_add_credit_transaction_idempotency`
Applying migration `20260201201612_add_cron_execution_tracking`
Applying migration `20260202182051_add_referential_integrity_and_indexes`
Applying migration `20260202210244_add_session_reports`
Applying migration `20260214_fix_cascade_constraints`
Applying migration `20260214_init_assessment_module`
Applying migration `20260216_add_entitlement_engine`
Applying migration `20260217_learning_graph_v2`

All migrations have been successfully applied.
```

### Vérification tables + colonnes + FK + indexes

```sql
-- 6 tables cibles confirmées
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
AND table_name IN ('assessments','domain_scores','skill_scores','progression_history','projection_history','students');
 assessments | domain_scores | progression_history | projection_history | skill_scores | students

-- 5 colonnes ajoutées sur assessments
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'assessments' AND column_name IN ('studentId','ssn','uai','assessmentVersion','engineVersion');
 assessmentVersion | text
 engineVersion     | text
 ssn               | double precision
 studentId         | text
 uai               | double precision

-- 5 FK constraints
 assessments_studentId_fkey         | assessments       → students
 domain_scores_assessmentId_fkey    | domain_scores     → assessments
 skill_scores_assessmentId_fkey     | skill_scores      → assessments
 progression_history_studentId_fkey | progression_history → students
 projection_history_studentId_fkey  | projection_history  → students

-- 12 indexes
 assessments_createdAt_idx | assessments_ssn_idx | assessments_status_idx
 assessments_studentEmail_idx | assessments_studentId_idx | assessments_subject_grade_idx
 domain_scores_assessmentId_idx | domain_scores_domain_idx
 progression_history_studentId_date_idx | projection_history_studentId_createdAt_idx
 skill_scores_assessmentId_idx | skill_scores_skillTag_idx
```

## Preuve E — RBAC (Sandbox DB valide)

### Tests négatifs (sans session) → 403

```
$ curl -s http://127.0.0.1:3000/api/admin/directeur/stats
HTTP 403 — {"success":false,"error":"Accès non autorisé. Rôle ADMIN requis."}

$ curl -s -X POST http://127.0.0.1:3000/api/admin/recompute-ssn -d '{"type":"MATHS"}'
HTTP 403 — {"success":false,"error":"Accès non autorisé. Rôle ADMIN requis."}
```

### Tests positifs (session ADMIN réelle via NextAuth credentials) → 200

```
# Login admin@nexus-reussite.com (seeded user, password: admin123)
$ curl -X POST .../api/auth/callback/credentials → HTTP 200, redirect /dashboard/admin

$ curl -b session_cookie http://127.0.0.1:3000/api/admin/directeur/stats
HTTP 200 — {
  "success": true,
  "kpis": {
    "totalAssessments": 0, "completedAssessments": 0,
    "averageSSN": null, "activeStudents": 1, ...
  },
  "distribution": { "excellence": 0, "tres_solide": 0, "stable": 0, "fragile": 0, "prioritaire": 0 },
  ...
}

$ curl -b session_cookie -X POST .../api/admin/recompute-ssn -d '{"type":"MATHS"}'
HTTP 200 — {
  "success": true, "type": "MATHS", "updated": 0,
  "cohort": { "mean": 50, "std": 15, "sampleSize": 0 },
  "audit": { "currentMean": 50, "currentStd": 15 }
}
```

## Preuve F — Workflow Assessment Réel (Sandbox DB)

### 1. Submit (payload réel, 13 réponses)

```
$ curl -X POST http://127.0.0.1:3000/api/assessments/submit \
  -d '{"subject":"MATHS","grade":"TERMINALE","studentData":{"email":"test@nexus.com","name":"Test"},"answers":{...}}'
HTTP 201 — {"success":true,"assessmentId":"cmlr47iz80000qs8drnri27b8","redirectUrl":"/assessments/.../processing"}
```

Server logs:
```
[Assessment Submit] MATHS TERMINALE - test-workflow@nexus.com
[Assessment Submit] Loaded 50Q, version=maths_terminale_spe_v1
[Assessment Submit] Score: 45/100, Confidence: 100/100
[Assessment Submit] Created assessment cmlr47iz80000qs8drnri27b8
[Assessment Submit] DomainScores persisted for cmlr47iz80000qs8drnri27b8
```

### 2. domain_scores peuplée (incl. score=0 prouvé)

```sql
-- Assessment avec réponses mixtes (score > 0)
SELECT domain, score FROM domain_scores WHERE "assessmentId" = 'cmlr47iz80000qs8drnri27b8';
 analyse      | 33
 geometrie    | 50
 probabilites | 50
 combinatoire | 67

-- Assessment avec toutes réponses fausses (score = 0 persisté !)
SELECT domain, score FROM domain_scores WHERE "assessmentId" = 'cmlr48y720002qs8dbvkcwms3';
 combinatoire | 0
 analyse      | 0
 geometrie    | 0
 probabilites | 0
```

### 3. Result API → 200

```
$ curl http://127.0.0.1:3000/api/assessments/cmlr47iz80000qs8drnri27b8/result
HTTP 200 — {
  "id": "cmlr47iz80000qs8drnri27b8",
  "status": "COMPLETED",
  "globalScore": 45,
  "ssn": 49.8,
  "domainScores": [
    {"domain": "combinatoire", "score": 67},
    {"domain": "geometrie", "score": 50},
    {"domain": "probabilites", "score": 50},
    {"domain": "analyse", "score": 33}
  ],
  "cohortMean": 45, "cohortStd": 15, "cohortN": 1, "isLowSample": true
}
```

### 4. Versioning + SSN confirmés en DB

```sql
SELECT "globalScore", "assessmentVersion", "engineVersion", ssn FROM assessments;
 45 | maths_terminale_spe_v1 | scoring_v2 | 49.8
  0 | maths_terminale_spe_v1 | scoring_v2 | 22.6
```

## Condition 5 — try/catch Monitoring

- **Compteur** : `lib/core/raw-sql-monitor.ts` — `incrementRawSqlFailure()` / `getRawSqlFailureCount()`
- **Sentry** : `try { require('@sentry/nextjs').captureException(err) } catch {}` dans chaque bloc
- **TODO tickets** :
  - `NEX-42` : Remove assessmentVersion try/catch after migrate deploy
  - `NEX-43` : Remove domain_scores try/catch after migrate deploy
- **Règle** : En prod → `console.error` + Sentry + compteur. En dev → `console.warn`.

---

## Fichiers créés (nouveaux)

| Fichier | Rôle |
|---|---|
| `lib/core/assessment-status.ts` | Helper `isCompletedAssessmentStatus()` + `COMPLETED_STATUSES` |
| `lib/core/raw-sql-monitor.ts` | Compteur failures raw SQL (monitoring) |
| `lib/core/statistics/cohort.ts` | `computeCohortStats()` avec cache + audit |
| `lib/core/statistics/normalize.ts` | `normalizeScore()`, `classifySSN()`, `computePercentile()` |
| `lib/core/ssn/computeSSN.ts` | Pipeline SSN end-to-end |
| `lib/core/ml/predictSSN.ts` | Prédiction ML (régression linéaire) |
| `lib/core/uai/computeUAI.ts` | Unified Academic Index |
| `lib/data/assessments/maths_terminale_spe_v1.ts` | Manifest dataset 50Q |
| `components/assessments/ResultRadar.tsx` | Radar chart domaines |
| `components/assessments/SSNCard.tsx` | Carte SSN avec classification |
| `components/assessments/SimulationPanel.tsx` | Panneau simulation what-if |
| `components/assessments/SkillHeatmap.tsx` | Heatmap compétences |
| `components/dashboard/MetricCard.tsx` | Carte KPI réutilisable |
| `app/admin/directeur/page.tsx` | Dashboard directeur |
| `app/api/admin/directeur/stats/route.ts` | API stats directeur (RBAC ADMIN) |
| `app/api/admin/recompute-ssn/route.ts` | API recompute SSN batch (RBAC ADMIN) |
| `app/api/assessments/[id]/export/route.ts` | Export PDF assessment |
| `app/api/assessments/predict/route.ts` | API prédiction SSN |
| `lib/pdf/assessment-template.tsx` | Template PDF react-pdf |
| `prisma/migrations/20260217_learning_graph_v2/migration.sql` | Migration SQL idempotente |

## Déploiement prod — Protocole (bloqué tant que lead ne valide pas)

```bash
# 1. Backup DB
docker exec nexus-postgres-prod pg_dump -U nexus_admin nexus_prod > backup_pre_v2.sql

# 2. Pull + Install
cd /opt/nexus && git pull origin main && npm ci

# 3. Migration
npx prisma migrate deploy
npx prisma generate

# 4. Build + Restart
docker compose build nexus-next-app
docker compose up -d nexus-next-app

# 5. Smoke tests
curl https://nexusreussite.academy/api/admin/directeur/stats  # → 403
curl -b admin_session https://nexusreussite.academy/api/admin/directeur/stats  # → 200

# 6. Recompute SSN (si assessments existants)
curl -b admin_session -X POST https://nexusreussite.academy/api/admin/recompute-ssn -d '{"type":"MATHS"}'
```
