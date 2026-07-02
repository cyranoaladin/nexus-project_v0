# DOC-5 — Architecture cible & plan de migration par lots

> Séquence de lots ordonnée par risque croissant. Chaque lot : déployable indépendamment, réversible, passe le gate canonique complet.
> Notes portées de DOC-4 v4 : (a) écriture Tier DONNÉES doit re-valider les invariants inter-namespaces impactés ; (b) single-flight sur échec de load sert du stale jusqu'à la prochaine fenêtre TTL.
> Date : 2026-06-27

---

## Sommaire

1. [Architecture cible consolidée](#1-architecture-cible-consolidée)
2. [Gate canonique](#2-gate-canonique)
3. [Séquence de lots](#3-séquence-de-lots)
4. [Détail par lot](#4-détail-par-lot)

---

## 1. Architecture cible consolidée

Synthèse des décisions DOC-2/3/4 validées.

### Consolidations de modèles

| Action | Source | Cible | DOC |
|--------|--------|-------|-----|
| Supprimer | `StudentReport` (modèle mort, 0 mutation/lecture prod) | — | DOC-2 Signal 1 |
| Converger | `StageBilan` → `Bilan` (type=STAGE_POST) | Double-écriture puis bascule | DOC-2 Signal 1 |
| Fusionner | `EamProgress` + `NsiPracticeProgress` → `SubjectProgress` | Table unifiée avec discriminateur | DOC-2 Signal 2 |
| Supprimer | `lib/group-rules.ts` (duplication de `pricing.canonical.json`) | 4 composants migrent vers `lib/pricing.ts` | DOC-2 §7 |

### Store BusinessConfig + snapshot

| Composant | Rôle | DOC |
|-----------|------|-----|
| `BusinessConfig` (table Prisma) | Store runtime Tier DONNÉES (namespace+key, Json, version, audit) | DOC-4 §2 |
| `lib/config/snapshot.ts` | Snapshot mémoire sync, single-flight, TTL 60s, mono-instance | DOC-4 §2 |
| `lib/config/schemas.ts` | Validation Zod par namespace avec invariants croisés | DOC-4 §2 |
| Accessors modifiés | `getRules()`, `getProductDefinition()`, etc. restent SYNC via `getOverride() ?? fallback` | DOC-4 §2 |

### Couche de gestion admin/assistante

| Écran | Rôle | DOC |
|-------|------|-----|
| `/admin/config` (4 onglets) | Édition Tier DONNÉES (ADMIN) / consultation (ASSISTANTE) | DOC-4 §3.1 |
| `/admin/entitlements` | CRUD entitlements (ADMIN) / read (ASSISTANTE) | DOC-4 §3.3 |
| `/admin/crons` | Monitoring + trigger crons | DOC-4 §3.4 |
| `/admin/audit` | NpcAuditLog + Invoice.events + BusinessConfig history | DOC-4 §3.5 |
| `/admin/aria` | Stats ARIA read-only | DOC-4 §3.6 |
| Extensions existantes | Documents listing, Stage CRUD assistante, R5 orphans, R4 richStatus | DOC-4 §3.7-3.10 |

### Résolution R2

Le store BusinessConfig rend la source unique de crédits **possible**. La correction effective = décision métier (quelle échelle fait foi) + saisie admin. Mécanisme spécifié dans le lot R2 (lot 5).

---

## 2. Gate canonique

Chaque lot doit passer ce gate COMPLET AVANT merge — pas de subset, pas de « si applicable » :

```
1.  lint              → npx next lint (0 erreurs)
2.  typecheck         → npx tsc --noEmit (0 erreurs)
3.  test:unit         → npx jest --passWithNoTests (0 régressions)
4.  test:e2e          → npx playwright test (0 régressions)
5.  build:gate        → npm run build:gate (build + bundle-weight check)
6.  guards            → grep de vérification : les routes modifiées conservent leurs gardes RBAC
7.  audit:site-map    → vérification du site-map (toutes les routes publiques répondent)
8.  check:docs        → vérification d'archive (aucun doc orphelin)
9.  git diff --check  → pas de whitespace/merge markers résiduels
10. migration         → prisma migrate deploy sur DB de staging (si migration schéma dans le lot)
```

Un lot qui casse le gate ne merge pas. Réversibilité = `git revert` du merge commit. Pour les lots avec migration schéma : `prisma migrate` rollback en complément du revert.

**Note : lots touchant des surfaces charte** (pages marketing, composants premium, HomePageClient) doivent en plus faire tourner les gardes charte + site-map — c'est non négociable. Cela concerne explicitement le Lot 1 (4 composants marketing).

---

## 3. Séquence de lots

Ordonnée par risque croissant et dépendances.

| Lot | Nom | Risque | Fichiers touchés | Dépend de |
|:---:|-----|:---:|:---:|:---:|
| **1** | Dédup group-rules | Très faible | 5 fichiers | — |
| **2** | Supprimer StudentReport | Faible | 1 fichier (schema) + 2 tests | — |
| **3** | BusinessConfig : schema + snapshot + API | Moyen | ~8 fichiers nouveaux + 3 modifiés | — |
| **4** | Accessors runtime (pricing + products) | Moyen | ~5 fichiers modifiés | Lot 3 |
| **5** | Lot R2 : mécanisme + saisie | Moyen | ~3 fichiers | Lot 4 |
| **6** | Écrans de gestion admin (config + entitlements + crons + audit + ARIA) | Moyen | ~15 fichiers nouveaux | Lot 3 |
| **7** | Extensions assistante (stages CRUD + entitlements read + reservations R4) | Faible | ~5 fichiers modifiés | Lot 6 |
| **8** | Guard widening assistante stages | Très faible | 2 fichiers modifiés | Lot 7 |
| **S** | serializeError-cleanup (scripts @/ → relatif) | Très faible | 21 scripts + tsconfig | — |
| **9** | StageBilan → Bilan : double-écriture | Élevé | ~11 fichiers | Lot S |
| **10** | StageBilan → Bilan : bascule + dépréciation | Élevé | ~11 fichiers | Lot 9 |
| **11** | EamProgress + NsiPracticeProgress → SubjectProgress | Élevé | ~6 fichiers + migration data | — |

---

## 4. Détail par lot

### Lot 1 — Dédup group-rules

**Risque** : très faible (4 composants, pas de DB, pas de logique)
**Périmètre** :

| Fichier | Action |
|---------|--------|
| `lib/group-rules.ts` | Supprimer |
| `app/HomePageClient.tsx` | Remplacer `import { GROUP_RULES } from '@/lib/group-rules'` par `import { getRules } from '@/lib/pricing'` ; `GROUP_RULES.group_max` → `getRules().group_max` |
| `app/equipe/page.tsx` | Idem |
| `components/marketing/acadomia-inspired.tsx` | Idem |
| `components/premium/MethodSection.tsx` | Idem |

**Gate** : gate canonique complet. Ce lot touche des surfaces charte (equipe, HomePageClient, composants marketing/premium) → les gardes charte + site-map sont non négociables.
**Réversibilité** : `git revert`. Aucune migration DB.
**Critère de réussite** : `grep -r 'group-rules' app/ components/ lib/` → 0 résultats. `npx next build` succès.

---

### Lot 2 — Supprimer StudentReport

**Risque** : faible (code mort prouvé DOC-2 — mais mort du CODE ne prouve pas le vide de la TABLE)
**Périmètre** :

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | Supprimer le modèle `StudentReport` + les relations `reports StudentReport[]` sur `Student` et `CoachProfile` |
| `__tests__/database/schema.test.ts` | Supprimer le test cascade `CoachProfile → StudentReport.coachId SetNull` |
| `__tests__/setup/test-database.ts` | Supprimer `testPrisma.studentReport.deleteMany()` du cleanup |

#### Pré-drop obligatoire (AVANT la migration)

**Étape 1 — Gate de pré-drop** : vérifier que la table est vide en production.

```sql
-- Exécuter sur la DB de production AVANT de lancer la migration
SELECT count(*) AS row_count FROM student_reports;
-- DOIT retourner 0.
-- Si non-zéro : le lot S'ARRÊTE. Investiguer les lignes héritées
-- (qui les a créées, quand, sont-elles référencées par d'autres tables).
```

**Étape 2 — Dump archivé** : même si la table est vide, archiver la structure + les éventuelles données.

```bash
pg_dump -t student_reports --no-owner --no-privileges "$DATABASE_URL" \
  > docs/architecture/restructuration/archives/student_reports_pre_drop.sql
# Commiter l'archive dans le même lot.
```

**Le DROP n'est autorisé qu'après ces deux étapes.**

#### Migration Prisma

`prisma migrate dev --name drop_student_report`

```sql
-- Migration : drop table student_reports
-- Pré-conditions vérifiées : count = 0, dump archivé
DROP TABLE IF EXISTS "student_reports";
```

**Gate** : gate canonique complet (lint → typecheck → test → e2e → build → site-map → docs → diff-check → migration staging).
**Réversibilité** : migration down (recréer la table depuis l'archive) + `git revert`.
**Critère de réussite** : `grep -r 'studentReport\|StudentReport' app/ lib/` → 0 résultats hors composants NPC (`StudentReportList` = nom de composant React, pas le modèle Prisma). Build succès.

---

### Lot 3 — BusinessConfig : schema + snapshot + API

**Risque** : moyen (nouveau modèle, nouvelle infra, mais aucun accessor modifié = 0 régression fonctionnelle)
**Périmètre** :

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | Ajouter modèle `BusinessConfig` |
| `lib/config/snapshot.ts` | Nouveau — snapshot mémoire (DOC-4 §2) |
| `lib/config/schemas.ts` | Nouveau — schemas Zod par namespace + invariants croisés + `validateProductCredits()`. Note DOC-4 : une écriture Tier DONNÉES re-valide les invariants inter-namespaces impactés (ex. baisser un prix re-checke l'invariant payment). |
| `lib/config/index.ts` | Nouveau — re-exports |
| `app/api/admin/config/route.ts` | Nouveau — GET (read all, requireAnyRole ADMIN+ASSISTANTE), PATCH (write, requireRole ADMIN) |
| `app/api/admin/config/rollback/route.ts` | Nouveau — POST (rollback, requireRole ADMIN) |
| `app/api/admin/config/history/route.ts` | Nouveau — GET (history, requireRole ADMIN) |
| `instrumentation.ts` (ou `lib/prisma.ts`) | Modifier — appeler `loadConfigSnapshot()` au démarrage |

**Migration Prisma** : `prisma migrate dev --name add_business_config`

```sql
CREATE TABLE "business_configs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "previousValue" JSONB,
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_configs_namespace_key_key" ON "business_configs"("namespace", "key");
CREATE INDEX "business_configs_namespace_idx" ON "business_configs"("namespace");
CREATE INDEX "business_configs_updatedAt_idx" ON "business_configs"("updatedAt");
```

Note snapshot : sur échec de `loadConfigSnapshot()`, le single-flight sert le snapshot stale jusqu'à la prochaine fenêtre TTL (60s). Le système reste fonctionnel via les fallbacks statiques `??`.

**Gate** : gate canonique complet + migration staging.
**Réversibilité** : `DROP TABLE business_configs` + `git revert`. Aucun accessor modifié = 0 régression.
**Critère de réussite** : `GET /api/admin/config` retourne `{ entries: [], fallbacks: {...} }`. PATCH écrit + versioning fonctionne. Snapshot se charge au démarrage.

---

### Lot 4 — Accessors runtime (pricing + products)

**Risque** : moyen (touche les accessors lus par 46 fichiers, mais les signatures restent SYNC et le fallback `??` garantit le comportement existant si le store est vide)
**Périmètre** :

| Fichier | Action |
|---------|--------|
| `lib/pricing.ts` | Modifier `getRules()` pour utiliser `getOverride() ?? staticFallback` (DOC-4 §2 snippet) |
| `lib/entitlement/types.ts` | Modifier `getProductDefinition()` pour utiliser `getOverride()` sur `grantsCredits`, `defaultDurationDays`, `features[]`, `label` (DOC-4 §2 snippet) |
| `lib/operational-catalog.ts` | Modifier pour lire les overrides subscription plans |

**Dépend de** : lot 3 (snapshot + API doivent exister)

**Gate** : gate canonique complet. Test spécifique : valider que sans entrée BusinessConfig, le comportement est identique au statique.
**Réversibilité** : `git revert`. Supprime les `getOverride()` calls, retour au statique pur.
**Critère de réussite** : `getRules().group_max` retourne 5 (valeur statique, store vide). Après `PATCH /api/admin/config { namespace: 'pricing.rules', key: 'group_max', value: 3 }`, `getRules().group_max` retourne 3.

---

### Lot 5 — Lot R2 : mécanisme + saisie

**Risque** : moyen (touche les crédits, mais le store est la source unique après lot 4)

**Mécanisme** :
1. L'écran `/admin/config` onglet « Produits & Crédits » affiche, pour chaque produit ABONNEMENT :
   - Crédits canonical (`pricing.canonical.json` statique) — affiché en gris, label « annoncé »
   - Crédits registry (`PRODUCT_REGISTRY` statique) — affiché en gris, label « code actuel »
   - Crédits runtime (`BusinessConfig` override si posé) — champ éditable
   - Delta + alerte si les trois divergent
2. L'admin **pose la valeur qui fait foi** dans le champ runtime. La décision métier (0/4/8 ? ou 4/8/16 ? ou autre ?) appartient au dirigeant, pas au code.
3. Une fois posée, `getProductDefinition(code).grantsCredits` retourne la valeur runtime via `getOverride()`. Le canonical JSON et le registry statique deviennent des fallbacks.

**Périmètre** :

| Fichier | Action |
|---------|--------|
| `app/dashboard/admin/config/page.tsx` | **Créé dans ce lot** — onglet Produits & Crédits avec affichage triple (canonical/registry/runtime). Lots 6 étendra cette page avec les onglets Tarifs/Règles/Historique. |
| `app/api/admin/config/route.ts` | Déjà créé lot 3 — validation `validateProductCredits()` pour les clés `products.*.grantsCredits` |

**Dépend de** : lot 4 (accessors runtime)
**Gate** : gate canonique complet. Test spécifique : le fallback fonctionne quand le store est vide.
**Réversibilité** : supprimer les entrées `BusinessConfig` namespace `products` → retour aux valeurs registry statiques.
**Critère de réussite** : l'admin voit la triple collision actuelle (0→4, 4→8, 8→16), peut poser une valeur, et `activateEntitlements()` utilise cette valeur.

**Note** : tant qu'aucune valeur n'est posée dans le store, le fallback octroie les valeurs `PRODUCT_REGISTRY` actuelles (4/8/16). Le comportement prod ne change pas tant que le dirigeant n'a pas tranché.

**Prérequis reportés du Lot 3** (résolus dans ce lot) :
1. Réversibilité du premier override : rollback vers le fallback canonical (delete de la ligne, pas update avec la valeur gelée). Dépend de la décision R2.
2. Résolution des fallbacks `products.credits` depuis `PRODUCT_REGISTRY` (le Lot 3 ne résout que `pricing.rules` et `pricing.floors` en fallback).
3. Sémantique du rollback multi-crans via `BusinessConfigAudit` (le Lot 3 pose l'audit append-only, le Lot 5 l'exploite).

---

### Lot 6 — Écrans de gestion admin

**Risque** : moyen (pages nouvelles, aucune modification de logique existante)
**Périmètre** :

| Écran | Fichiers nouveaux | API nouvelle |
|-------|------------------|-------------|
| `/admin/config` | `app/dashboard/admin/config/page.tsx` | **Étend la page créée en Lot 5** — ajoute les onglets Tarifs, Règles, Historique à côté de l'onglet Produits & Crédits (Lot 5) |
| `/admin/entitlements` | `app/dashboard/admin/entitlements/page.tsx` | `app/api/admin/entitlements/route.ts` (GET), `app/api/admin/entitlements/[id]/route.ts` (PATCH) |
| `/admin/crons` | `app/dashboard/admin/crons/page.tsx` | `app/api/admin/crons/route.ts` (GET), `app/api/admin/crons/trigger/route.ts` (POST) |
| `/admin/audit` | `app/dashboard/admin/audit/page.tsx` | `app/api/admin/audit/route.ts` (GET) |
| `/admin/aria` | `app/dashboard/admin/aria/page.tsx` | `app/api/admin/aria/stats/route.ts` (GET) |

Toutes les routes nouvelles : `requireRole(ADMIN)` sauf entitlements GET → `requireAnyRole(ADMIN, ASSISTANTE)`.

**Gate** : gate canonique complet.
**Réversibilité** : `git revert` — supprime les pages et routes. Aucun impact sur l'existant.

---

### Lot 7 — Extensions assistante

**Risque** : faible (extensions UI, pas de nouvelle logique critique)
**Périmètre** :

| Extension | Fichiers | Action |
|-----------|---------|--------|
| `/assistante/config` (read-only) | `app/dashboard/assistante/config/page.tsx` | Nouveau — lecture seule via `GET /api/admin/config` (lot 3) |
| `/assistante/entitlements` (read-only) | `app/dashboard/assistante/entitlements/page.tsx` | Nouveau — via `GET /api/admin/entitlements` (lot 6) |
| `/assistante/reservations` (R4) | `app/dashboard/assistante/reservations/page.tsx` | Nouveau — affiche `richStatus` seul |
| R5 orphans dans assignments | `app/dashboard/assistante/assignments/page.tsx` | Modifier — afficher warning orphelins |
| Documents listing | `app/dashboard/admin/documents/page.tsx` | Modifier — ajouter GET listing |

**Gate** : gate canonique complet.
**Réversibilité** : `git revert`.

---

### Lot 8 — Guard widening assistante stages

**Risque** : très faible (2 lignes de code changées)
**Périmètre** :

| Fichier | Changement |
|---------|-----------|
| `app/api/admin/stages/route.ts` | POST : `requireRole(ADMIN)` → `requireAnyRole(ADMIN, ASSISTANTE)` |
| `app/api/admin/stages/[stageId]/route.ts` | PATCH : `requireRole(ADMIN)` → `requireAnyRole(ADMIN, ASSISTANTE)`. DELETE reste `requireRole(ADMIN)`. |

**Dépend de** : lot 7 (la page assistante stages doit exister pour utiliser ces routes)
**Gate** : gate canonique complet. Test spécifique guards : ASSISTANTE peut POST/PATCH, ne peut pas DELETE.
**Réversibilité** : `git revert` — 2 lignes.

---

### Lot 9 — StageBilan → Bilan : double-écriture

**Risque** : élevé (touche 11 fichiers, données en production, pipeline de reporting)

**Stratégie : tables parallèles + double-écriture + vérification**

#### Phase 1 : double-écriture

Chaque route qui crée/met à jour un `StageBilan` crée AUSSI un `Bilan` avec `type=STAGE_POST`.

| Fichier | Changement |
|---------|-----------|
| `app/api/stages/[stageSlug]/bilans/route.ts` | POST : après `prisma.stageBilan.upsert`, aussi `prisma.bilan.upsert` avec mapping des champs |
| Mapping des champs : | |
| | `StageBilan.scoreGlobal` → `Bilan.globalScore` |
| | `StageBilan.domainScores` → `Bilan.domainScores` |
| | `StageBilan.contentEleve` → `Bilan.studentMarkdown` |
| | `StageBilan.contentParent` → `Bilan.parentsMarkdown` |
| | `StageBilan.contentInterne` → `Bilan.nexusMarkdown` |
| | `StageBilan.strengths/areasForGrowth` → `Bilan.sourceData.strengths/areasForGrowth` |
| | `StageBilan.nextSteps` → `Bilan.sourceData.nextSteps` |
| | `StageBilan.pdfUrl` → stocké dans `Bilan.sourceData.pdfUrl` |
| | `StageBilan.isPublished/publishedAt` → `Bilan.isPublished/publishedAt` |
| | `Bilan.legacyStageBilanId` = `StageBilan.id` (bridge FK) |

#### Phase 2 : backfill script idempotent

```typescript
// scripts/backfill-stage-bilans.ts
// Idempotent: skip si Bilan.legacyStageBilanId existe déjà pour ce StageBilan

const stageBilans = await prisma.stageBilan.findMany({ include: { stage: true } });

for (const sb of stageBilans) {
  const existing = await prisma.bilan.findUnique({
    where: { legacyStageBilanId: sb.id },
  });
  if (existing) continue; // idempotent

  await prisma.bilan.create({
    data: {
      type: 'STAGE_POST',
      subject: sb.stage.subject?.[0] ?? 'MATHEMATIQUES',
      legacyStageBilanId: sb.id,
      studentId: sb.studentId,
      stageId: sb.stageId,
      coachId: sb.coachId,
      studentEmail: /* lookup from student */,
      studentName: /* lookup from student */,
      globalScore: sb.scoreGlobal,
      domainScores: sb.domainScores,
      studentMarkdown: sb.contentEleve,
      parentsMarkdown: sb.contentParent,
      nexusMarkdown: sb.contentInterne,
      sourceData: { strengths: sb.strengths, areasForGrowth: sb.areasForGrowth, nextSteps: sb.nextSteps, pdfUrl: sb.pdfUrl },
      isPublished: sb.isPublished,
      publishedAt: sb.publishedAt,
      status: 'COMPLETED',
      sourceVersion: 'stage_bilan_migrated_v1',
    },
  });
}
```

#### Vérification d'intégrité avant bascule

```sql
-- Tous les StageBilans ont un Bilan correspondant ?
SELECT COUNT(*) as orphans
FROM stage_bilans sb
LEFT JOIN bilans b ON b."legacyStageBilanId" = sb.id
WHERE b.id IS NULL;
-- Doit retourner 0
```

**Gate** : gate canonique complet + vérification intégrité sur staging.
**Réversibilité** : supprimer les Bilan avec `sourceVersion = 'stage_bilan_migrated_v1'` + `git revert` la double-écriture.

---

### Lot 10 — StageBilan → Bilan : bascule + dépréciation

**Risque** : élevé (bascule des lectures)
**Dépend de** : lot 9 + vérification intégrité = 0 orphelins

**Périmètre** :

| Fichier | Changement |
|---------|-----------|
| `app/dashboard/parent/stages/page.tsx` | Lire depuis Bilan au lieu de StageBilan |
| `app/dashboard/coach/stages/page.tsx` | Idem |
| `app/dashboard/admin/stages/page.tsx` | Idem |
| `app/api/parent/stages/route.ts` | Query Bilan avec `type=STAGE_POST` au lieu de StageBilan |
| `app/api/student/stages/route.ts` | Idem |
| `lib/reports/stage/buildReportContext.ts` | Lire Bilan au lieu de StageBilan |
| `lib/reports/stage/completeness.ts` | Idem |
| `lib/dashboard/student-payload.ts` | Idem |
| `lib/email.ts` | Idem (si référence StageBilan) |
| `app/api/stages/[stageSlug]/bilans/route.ts` | Supprimer la branche StageBilan (ne garder que la branche Bilan) |

**Le modèle StageBilan reste dans le schéma** (non supprimé). La table `stage_bilans` est conservée en lecture seule. Suppression = lot futur, après confirmation que tous les lecteurs sont migrés.

**Gate** : gate canonique complet. Test e2e spécifique : bilans de stage s'affichent correctement après bascule.
**Réversibilité** : `git revert` — les pages relisent StageBilan. Les données sont toujours dans les deux tables.
**Critère de réussite** : `grep -r 'stageBilan' app/ lib/ --include='*.ts' --include='*.tsx' | grep -v schema | grep -v migrate | grep -v test` → 0 résultats pertinents.

---

### Lot 11 — EamProgress + NsiPracticeProgress → SubjectProgress

**Risque** : élevé (migration de données, changement de modèle)

**Stratégie : table parallèle + backfill + double-écriture + bascule**

#### Phase 1 : nouveau modèle (additif, non-destructif)

```prisma
model SubjectProgress {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  subject   String   // 'EAM', 'NSI', etc.
  data      Json     // Full progress object
  version   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, subject])
  @@index([userId])
  @@map("subject_progress")
}
```

#### Phase 2 : backfill idempotent

```typescript
// scripts/backfill-subject-progress.ts
const eamRows = await prisma.eamProgress.findMany();
for (const row of eamRows) {
  await prisma.subjectProgress.upsert({
    where: { userId_subject: { userId: row.userId, subject: 'EAM' } },
    create: { userId: row.userId, subject: 'EAM', data: { checks: row.checks, quiz: row.quiz }, version: 1 },
    update: {}, // idempotent — ne pas écraser si déjà migré
  });
}

const nsiRows = await prisma.nsiPracticeProgress.findMany();
for (const row of nsiRows) {
  await prisma.subjectProgress.upsert({
    where: { userId_subject: { userId: row.userId, subject: 'NSI' } },
    create: { userId: row.userId, subject: 'NSI', data: row.data, version: row.version },
    update: {},
  });
}
```

#### Phase 3 : double-écriture dans les routes

| Route | Changement |
|-------|-----------|
| `app/api/eam/progress/route.ts` | POST : écrire aussi dans SubjectProgress |
| `app/api/eleve/nsi-pratique-2026/progress/route.ts` | PUT : écrire aussi dans SubjectProgress |
| `app/api/coach/nsi-pratique-2026/students/[id]/progress/route.ts` | Lire depuis SubjectProgress |
| `app/api/coach/nsi-pratique-2026/students/route.ts` | Lire depuis SubjectProgress |
| `app/api/coach/students/eam-summary/route.ts` | Lire depuis SubjectProgress |

#### Phase 4 : vérification + bascule

```sql
-- Vérification : toutes les progressions migrées ?
SELECT 'EAM orphans' as check,
  (SELECT COUNT(*) FROM eam_progress) - (SELECT COUNT(*) FROM subject_progress WHERE subject = 'EAM') as delta
UNION ALL
SELECT 'NSI orphans',
  (SELECT COUNT(*) FROM nsi_practice_progress) - (SELECT COUNT(*) FROM subject_progress WHERE subject = 'NSI');
-- Les deux deltas doivent être 0
```

**Les tables `eam_progress` et `nsi_practice_progress` restent** (non supprimées). Conservation en lecture seule. Suppression = lot futur.

**Gate** : gate canonique complet + vérification intégrité staging.
**Réversibilité** : `git revert` la double-écriture → les routes relisent les anciennes tables. `SubjectProgress` conservé mais ignoré.

---

### Lot S — serializeError-cleanup

**Risque** : très faible (mécanique, aucun changement de logique)
**Périmètre** : 21 scripts sous `scripts/` qui importent `@/lib/utils/serialize-error` — l'alias `@/` ne résout pas hors Next.js (les scripts tournent via `tsx` directement). Invisible au CI car `tsconfig.json` exclut `scripts/`.

| Action | Fichiers |
|--------|----------|
| `@/lib/utils/serialize-error` → `../lib/utils/serialize-error` (import relatif) | 21 scripts |
| Retirer `"scripts"` de `tsconfig.json > exclude` OU créer `tsconfig.scripts.json` + check dans le gate | 1 config |

**Dépend de** : —
**Bloque** : Lots 9-11 (migrations data qui exécutent des scripts de backfill)
**Gate** : gate canonique complet. Les 21 scripts doivent compiler (`tsc --project tsconfig.scripts.json` si tsconfig séparé, ou intégrés au `npx tsc --noEmit` si `"scripts"` retiré de `exclude`).
**Réversibilité** : `git revert`. Aucun impact runtime.

---

## Résumé de la séquence

```
Lot 1  [très faible]  Dédup group-rules (5 fichiers, 0 DB)
  ↓
Lot 2  [faible]       Supprimer StudentReport (schema + tests)
  ↓
Lot 3  [moyen]        BusinessConfig schema + snapshot + API ──────────┐
  ↓                                                                    │
Lot 4  [moyen]        Accessors runtime (pricing + products) ←─────────┘
  ↓
Lot 5  [moyen]        Lot R2 (mécanisme + UI, décision = business) ←── Lot 4
  ↓
Lot 6  [moyen]        Écrans admin (config + entitlements + crons + audit + aria) ←── Lot 3
  ↓
Lot 7  [faible]       Extensions assistante (config read + entitlements + R4 + R5) ←── Lot 6
  ↓
Lot 8  [très faible]  Guard widening assistante stages (2 lignes) ←── Lot 7
  ↓
Lot S  [très faible]  serializeError-cleanup (21 scripts @/ → import relatif + tsconfig scripts/)
  ↓
Lot 9  [élevé]        StageBilan → Bilan : double-écriture + backfill ←── Lot S
  ↓
Lot 10 [élevé]        StageBilan → Bilan : bascule lectures
  ↓
Lot 11 [élevé]        EamProgress + NsiPracticeProgress → SubjectProgress
```

Chaque lot est déployable indépendamment (sauf les dépendances flèches). Les lots 1-2 peuvent être faits en parallèle. Les lots 9-11 sont indépendants entre eux.

**Non-destructivité** : aucun `DROP TABLE` dans les lots 9-11. Les anciennes tables sont conservées en lecture seule. Suppression = lots futurs séparés, après confirmation que tous les lecteurs sont migrés et que les données sont stables.

---

> **FIN DOC-5** — Le SET documentaire (DOC-1 à DOC-5) est complet.
> Prêt pour le premier lot de code.
