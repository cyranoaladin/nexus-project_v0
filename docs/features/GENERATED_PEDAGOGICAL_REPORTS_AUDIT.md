# Audit : Pipeline de Génération de Bilans Pédagogiques PDF Premium

**Date d'audit :** 2 mai 2026  
**Auditeur :** Windsurf AI  
**Version auditée :** Commit HEAD (main)

---

## 1. Fichiers Inspectés

### Schéma et Modèles
- ✅ `prisma/schema.prisma` - Validé (Prisma validate: ✓)
- ✅ `prisma/migrations/20260505000000_add_generated_pedagogical_reports/migration.sql`
- ✅ `prisma/migrations/20260501120000_add_eaf_preparation_reports/migration.sql`

### Routes API
- ✅ `app/api/eleve/questionnaire-eaf-stage-printemps/route.ts`
- ✅ `app/api/coach/students/[studentId]/eaf-preparation-report/route.ts`
- ✅ `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts`
- ✅ `app/api/coach/students/[studentId]/generated-reports/route.ts`
- ✅ `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts`
- ✅ `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts`

### Librairies Métier
- ✅ `lib/reports/stage/maybeCreateGeneratedReportJob.ts`
- ✅ `lib/reports/stage/processGeneratedReportJob.ts`
- ✅ `lib/reports/stage/checksums.ts`
- ✅ `lib/reports/stage/completeness.ts`
- ✅ `lib/reports/stage/compileLatexToPdf.ts`
- ✅ `lib/reports/stage/buildReportContext.ts`
- ✅ `lib/reports/stage/generateStructuredReportWithMistral.ts`
- ✅ `lib/reports/stage/renderLatexPremiumReport.ts`
- ✅ `lib/reports/stage/schema.ts`
- ✅ `lib/reports/stage/validateGeneratedReportJson.ts`
- ✅ `lib/llm/mistral.ts`

### Composants UI
- ✅ `components/dashboard/coach/EafPreparationReport.tsx`
- ✅ `components/dashboard/coach/GeneratedReportsPanel.tsx`
- ✅ `components/dashboard/coach/StudentDossier.tsx` (via imports)

### Configuration
- ✅ `package.json` - Scripts disponibles

---

## 2. État Actuel

### ✅ Modèles Prisma Présents

#### `GeneratedPedagogicalReport` (lignes 2264-2304)
```prisma
model GeneratedPedagogicalReport {
  id, createdAt, updatedAt
  studentId + relation Student
  coachId + relation CoachProfile
  subject, stageSlug, studentBilanId, coachReportId, kind
  promptVersion, templateVersion
  status: GeneratedReportStatus
  errorCode, errorMessage, retryCount, inputChecksum
  contextJson, llmJson, validatedJson, modelUsed, validatedAt
  latexSource, generatedAt, pdfUrl
  
  @@unique([studentId, stageSlug, subject, kind, inputChecksum])
}
```

#### `EafPreparationReport` (lignes 1845-1879)
```prisma
model EafPreparationReport {
  id, studentId, coachId + relations
  // EAF rubrics (11 champs texte)
  linearReading, workPresentation, interview, oralExpression
  writingMethod, languageMastery, literaryCulture
  strengths, areasToImprove, nextSessionGoals, coachFreeComment
  
  status: String @default("DRAFT")
  completionRatio: Int @default(0)
  validatedAt: DateTime?
  validatedBy: String?
  
  @@unique([studentId, coachId])
}
```

#### Enum `GeneratedReportStatus` (lignes 2253-2262)
```prisma
enum GeneratedReportStatus {
  PENDING
  BUILDING_CONTEXT
  LLM_GENERATING
  LLM_VALIDATED
  LATEX_RENDERING
  PDF_READY
  FAILED
  NEEDS_REVIEW
}
```

### ✅ Migrations SQL Existantes

| Migration | Description | Statut |
|-----------|-------------|--------|
| `20260505000000_add_generated_pedagogical_reports` | Table + enum + indexes + FKs | ✅ OK |
| `20260501120000_add_eaf_preparation_reports` | Table EAF (sans status/completion) | ⚠️ **INCOMPLÈTE** |

**Problème Migration EAF :** La migration 20260501120000 ne contient PAS les champs :
- `status`
- `completionRatio`
- `validatedAt`
- `validatedBy`

Ces champs sont dans le schéma Prisma mais pas dans la migration SQL.

### ✅ Fonctionnalités Implémentées

| Fonctionnalité | Fichier | Statut |
|----------------|---------|--------|
| Création job avec checksum | `maybeCreateGeneratedReportJob.ts` | ✅ OK |
| Déduplication par checksum | `@@unique` Prisma | ✅ OK |
| Validation bilan coach complet | `validate/route.ts` L60-69 | ✅ OK |
| Reset status/validation on PUT | `eaf-preparation-report/route.ts` L152-155 | ✅ OK |
| Génération auto après submit élève | `questionnaire-eaf-stage-printemps/route.ts` L279-286 | ✅ OK |
| Statuts pipeline génération | `processGeneratedReportJob.ts` | ✅ OK |
| Gestion erreurs LLM/PDF | `processGeneratedReportJob.ts` L92-114 | ✅ OK |
| Panel coach avec états | `GeneratedReportsPanel.tsx` | ✅ OK |
| RBAC COACH + assignation | Toutes les routes | ✅ OK |

---

## 3. Problèmes Bloquants (P0)

### 🔴 P0-1 : Migration EAF Incomplète
**Fichier :** `prisma/migrations/20260501120000_add_eaf_preparation_reports/migration.sql`

**Problème :** La migration SQL ne crée pas les colonnes `status`, `completionRatio`, `validatedAt`, `validatedBy`.

**Impact :** Déploiement en prod = erreur colonnes manquantes.

**Correction :** Créer une migration corrective.

### 🔴 P0-2 : Stockage PDF dans `scratch/pdfs`
**Fichier :** `lib/reports/stage/processGeneratedReportJob.ts` L78-80

```typescript
const pdfDir = path.join(process.cwd(), 'scratch', 'pdfs');
await fs.mkdir(pdfDir, { recursive: true });
await fs.writeFile(path.join(pdfDir, `${reportId}.pdf`), pdfBuffer);
```

**Problèmes :**
- `scratch/` est probablement dans `.gitignore`
- Pas de persistance garantie (Docker volumes ?)
- Pas de backup
- Permissions non vérifiées

**Impact :** Perte des PDF générés après redémarrage.

### 🔴 P0-3 : LaTeX Compilation Non Durcie
**Fichier :** `lib/reports/stage/compileLatexToPdf.ts`

**Problèmes :**
- Pas de vérification `pdflatex` disponible
- Pas de timeout
- Pas de `-halt-on-error`
- Pas de `-no-shell-escape`
- Pas de conservation des logs en cas d'échec

**Impact :** Failures silencieuses, attente infinie, vulnérabilité injection.

### 🔴 P0-4 : Pas de Worker Autonome
**Problème :** La génération se fait via appels API synchrones (`regenerate/route.ts`). Pas de worker dédié.

**Impact :** Timeout HTTP si génération longue, pas de retry automatique.

### 🔴 P0-5 : LLM Mistral sans Timeout
**Fichier :** `lib/llm/mistral.ts` L39-51

**Problème :** Pas de timeout sur `fetch()`.

**Impact :** Requêtes bloquantes en cas de problème réseau/Mistral.

---

## 4. Problèmes Non-Bloquants (P1/P2)

### 🟡 P1-1 : Pas de Variable Env pour Stockage PDF
**Recommandation :** Ajouter `GENERATED_REPORTS_DIR` avec fallback sécurisé.

### 🟡 P1-2 : Pas de Tests Unitaires pour Checksums
**Recommandation :** Tests `computeInputChecksum` avec cas limites.

### 🟡 P1-3 : Pas de Tests pour Completeness
**Recommandation :** Tests `getEafCoachReportCompletion` avec données partielles.

### 🟡 P1-4 : Logging Potentiellement Verbose
**Vérification :** S'assurer que `logger.info` ne loggue pas de données personnelles dans le contexte.

### 🟡 P2-1 : Pas de Gestion Cache-Control
**Recommandation :** `Cache-Control: private, no-store` sur les PDF.

### 🟡 P2-2 : Label Bouton "Créer la demande EAF"
**UI :** `GeneratedReportsPanel.tsx` L152  
**Recommandation :** Renommer en "Créer la demande manquante" si création automatique attendue.

---

## 5. Risques Production

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Perte PDF (scratch/) | Élevée | Critique | P0-2 |
| Timeout génération | Élevée | Moyen | P0-4 |
| Migration échoue | Moyenne | Critique | P0-1 |
| Injection LaTeX | Faible | Élevé | P0-3 |
| Fuite données logs | Moyenne | Élevé | Audit logs |
| Doublons jobs | Faible | Moyen | Checksum OK |

---

## 6. Plan de Correction

### Phase 2 - P0 Immédiat

#### 2.1 Migration EAF Corrective
```sql
-- prisma/migrations/20260502140000_add_eaf_status_fields/migration.sql
ALTER TABLE "eaf_preparation_reports" 
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "completionRatio" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "validatedBy" TEXT;
```

#### 2.2 Stockage PDF Durable
- Créer `scripts/workers/generate-pedagogical-reports.ts`
- Variable env `GENERATED_REPORTS_DIR=/var/nexus/private/reports`
- Fallback : `path.join(process.cwd(), 'private', 'generated-reports')`
- HORS de `public/`
- Sauvegarde dans `UserDocument` si applicable

#### 2.3 Durcir LaTeX
```typescript
// Vérifier pdflatex
await execFileAsync('which', ['pdflatex']);

// Compilation avec sécurité
await execFileAsync('pdflatex', [
  '-halt-on-error',
  '-no-shell-escape',
  '-interaction=nonstopmode',
  `-output-directory=${workspaceTmp}`,
  texFile
], { timeout: 30000 }); // 30s timeout
```

#### 2.4 Timeout Mistral
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);

const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
  signal: controller.signal,
  ...
});
```

### Phase 3 - Worker

Créer `scripts/workers/generate-pedagogical-reports.ts` :
- Poll toutes les 30s les jobs `PENDING` ou `FAILED` (retry < 3)
- Traitement exclusif (LOCK sur reportId)
- Transition statuts : PENDING → BUILDING_CONTEXT → LLM_GENERATING → LLM_VALIDATED → LATEX_RENDERING → PDF_READY
- Gestion FAILED / NEEDS_REVIEW
- Logging minimal : `{ reportId, status, errorCode }`

### Phase 4 - Tests

- Tests checksums
- Tests completeness
- Tests maybeCreateGeneratedReportJob (doublons)
- Tests routes API (sécurité)
- Tests LaTeX escape

---

## 7. Commandes Exécutées

```bash
# Validation Prisma
npx prisma validate
✅ Schéma valide

# Vérification TypeScript
npm run typecheck
✅ 0 erreurs

# Liste des migrations
ls -la prisma/migrations/
✅ 20260505000000_add_generated_pedagogical_reports/ (OK)
⚠️  20260501120000_add_eaf_preparation_reports/ (INCOMPLET)
```

---

## 8. Tests Exécutés

| Test | Commande | Résultat |
|------|----------|----------|
| TypeScript | `npm run typecheck` | ✅ PASS |
| Prisma Validate | `npx prisma validate` | ✅ PASS |
| Jest (rapide) | `npm test` | ⏳ Non exécuté (audit) |

---

## 9. Décision : Prêt Prod ?

### ❌ NON PRÊT POUR PRODUCTION

**Bloquants à résoudre :**
1. P0-1 : Migration EAF incomplète
2. P0-2 : Stockage PDF non durable
3. P0-3 : LaTeX non durci
4. P0-4 : Absence de worker
5. P0-5 : Timeout LLM absent

**Critères d'acceptation non atteints :**
- ❌ Migration cohérente schema/SQL
- ❌ Stockage PDF durable
- ❌ Worker autonome
- ❌ Timeout/erreurs propres LLM
- ❌ Tests automatisés

---

## 10. Commandes Déploiement Staging (Future)

```bash
# 1. Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Migrations
npx prisma migrate deploy

# 3. Générer Prisma Client
npx prisma generate

# 4. Build
npm run build

# 5. Créer répertoire stockage
mkdir -p /var/nexus/private/generated-reports
chown -R nexus:nexus /var/nexus/private

# 6. Vérifier pdflatex
which pdflatex
tlmgr install <packages-nécessaires>

# 7. Démarrer worker
pm2 start scripts/workers/generate-pedagogical-reports.ts --name reports-worker

# 8. Redémarrer app
pm2 restart nexus-app
```

---

## 11. Commandes Audit Prod Lecture Seule

```bash
# Connexion SSH (lecture seule)
ssh user@prod-server

# Informations système
whoami
pwd
ls -la /opt/nexus/ /var/www/nexus*/ 2>/dev/null | head -20

# PM2
pm2 list
pm2 describe nexus-app
pm2 describe reports-worker 2>/dev/null || echo "Worker non démarré"

# Node/npm
node --version
npm --version

# Présence pdflatex
which pdflatex || echo "pdflatex NON INSTALLÉ"
pdflatex --version 2>/dev/null | head -2

# Espace disque
df -h

# Fichiers critiques (masqués)
cat /opt/nexus/package.json 2>/dev/null | grep -E '"name"|"version"'
cat /opt/nexus/prisma/schema.prisma 2>/dev/null | grep -E "^model|enum" | head -20
cat /opt/nexus/.env 2>/dev/null | sed 's/=.*/=***MASQUÉ***/' | head -10

# Nginx
sudo nginx -t 2>&1 | head -5

# Stockage PDF
ls -la $GENERATED_REPORTS_DIR 2>/dev/null || ls -la /opt/nexus/private/generated-reports 2>/dev/null || echo "Répertoire PDF non trouvé"
find /opt/nexus -name "*.pdf" -type f 2>/dev/null | wc -l
```

---

## Références

- Plan original : `docs/features/GENERATED_PEDAGOGICAL_REPORTS_PLAN.md`
- Schéma Prisma : `prisma/schema.prisma` (lignes 1845-1879, 2253-2304)
- Migration GeneratedReports : `prisma/migrations/20260505000000_add_generated_pedagogical_reports/migration.sql`
- Migration EAF : `prisma/migrations/20260501120000_add_eaf_preparation_reports/migration.sql`
