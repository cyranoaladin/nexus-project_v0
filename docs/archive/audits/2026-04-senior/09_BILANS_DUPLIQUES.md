# AXE 9 — Bilans Dupliqués

**Audit Date:** 2026-04-19  
**Auditeur:** Cascade (AI Assistant)  
**Statut:** 🟥 CRITIQUE — Architecture de bilan fragmentée, consolidation requise

---

## 1. Résumé Exécutif

### Constat Principal
Le produit Nexus possède **6 systèmes de bilan parallèles**, chacun avec ses propres:
- Schémas de données (partiellement incompatibles)
- Générateurs de contenu (LLM/template)
- Stockages (3 tables Prisma distinctes)
- Interfaces utilisateur (non harmonisées)
- Cycles de vie (persistances différentes)

### Verdict
**Il n'existe PAS de schéma bilan canonique unique.** Le concept de "bilan" est implémenté de manière redondante, créant une dette produit et technique significative.

### Impact
- **Complexité maintenance:** 6 générateurs à maintenir
- **Incohérence UX:** Expérience différente selon le point d'entrée
- **Risque sécurité:** Surfaces publiques multiples avec contrôles d'accès hétérogènes
- **Doublon données:** Potentiellement 3 bilans pour un même élève (stage, diagnostic, assessment)

---

## 2. Carte Complète des Bilans (Q1)

| Surface | Route/Page | Endpoint | Générateur | Stockage | Destinataire | Preuve |
|---------|-----------|----------|-----------|----------|---------------|--------|
| **Bilan Gratuit (Lead Gen)** | `/bilan-gratuit` → `/bilan-gratuit/assessment` | `POST /api/bilan-gratuit` | `AssessmentRunner` → `BilanGenerator` (lib/assessments) | `Assessment` table | Parent/Élève (lead) | `app/bilan-gratuit/page.tsx:207` |
| **Bilan Pallier 2 Maths** | `/bilan-pallier2-maths` → `/resultat/[id]` | `POST /api/bilan-pallier2-maths` | `generateBilans()` (lib/bilan-generator.ts) | `Diagnostic` table | Élève/Parent/Nexus | `lib/bilan-generator.ts:251` |
| **Stage Bilan Coach** | `/dashboard/coach/stages/[slug]/bilans` | `POST /api/stages/[stageSlug]/bilans` | Template manuel (pas de LLM) | `StageBilan` table | Élève/Parent | `app/api/stages/[stageSlug]/bilans/route.ts:52` |
| **Maths 1ère BilanView** | `/programme/maths-1ere` (tab bilan) | N/A (local state) | Template local (pas de LLM) | Store Zustand local | Élève/Famille/Nexus | `app/programme/maths-1ere/components/Bilan/BilanView.tsx:27` |
| **Assessment Universal** | `/assessments/[id]/processing` | `POST /api/assessments/submit` | `BilanGenerator.generate()` (lib/assessments) | `Assessment` table | Élève/Parent/Nexus | `lib/assessments/generators/index.ts:58` |
| **Stage Bilan Legacy** | `/stages/fevrier-2026/bilan/[reservationId]` | Legacy (pré-2025) | `BilanClient` (template local) | `StageReservation.scoringResult` | Élève/Parent | `app/stages/fevrier-2026/bilan/[reservationId]/BilanClient.tsx:27` |

---

## 3. Typologie Métier (Q2)

### 3.1 Bilan Diagnostique Pré-Stage (Pallier 2 Maths)
```
Objectif:    Positionner l'élève dans le bon pallier (P1/P2)
Moment:      Avant inscription stage
Audience:    Élève + Parent + Nexus (3 vues)
Source:      Formulaire compétences détaillé + mini-test
Persistance: OUI (Diagnostic table, status lifecycle)
Export:      Markdown généré (studentMarkdown, parentsMarkdown, nexusMarkdown)
Re-édition:  Possible via API retry
```

### 3.2 Bilan de Stage (Coach)
```
Objectif:    Synthèse pédagogique post-stage
Moment:      Fin de stage
Audience:    Élève + Parent (pas de vue Nexus structurée)
Source:      Rédaction manuelle coach
Persistance: OUI (StageBilan table)
Export:      PDF possible (pdfUrl field)
Re-édition:  OUI (upsert par coach)
```

### 3.3 Bilan Assessment Universel (QCM)
```
Objectif:    Diagnostic multi-matières via QCM
Moment:      Post-inscription bilan gratuit
Audience:    Élève + Parent + Nexus
Source:      Réponses QCM + LLM
Persistance: OUI (Assessment table)
Export:      Markdown (studentMarkdown, parentsMarkdown, nexusMarkdown)
Re-édition:  NON (one-shot)
```

### 3.4 Bilan Maths 1ère (In-App)
```
Objectif:    Suivi progression dans l'application
Moment:      Continu (temps réel)
Audience:    Élève + Famille + Nexus (3 tabs)
Source:      Store local (progression exercices)
Persistance: NON (calculé à la volée)
Export:      Impression navigateur uniquement
Re-édition:  N/A (toujours à jour)
```

### 3.5 Bilan Legacy Stage Février 2026
```
Objectif:    Positionnement pré-stage (legacy)
Moment:      Avant stage
Audience:    Élève
Source:      QCM + scoring legacy
Persistance: OUI (StageReservation.scoringResult JSON)
Export:      Impression navigateur
Re-édition:  NON
```

---

## 4. Duplication vs Complémentarité (Q3)

| Surface A | Surface B | Recouvrement | Conflit | Verdict |
|-----------|-----------|--------------|---------|---------|
| **Bilan Pallier 2** | **Assessment Universal** | 85% (tri-destinataire, LLM, scoring) | OUI: deux générateurs LLM différents pour même usage | 🔴 **Duplication réelle** — Doivent fusionner |
| **Bilan Pallier 2** | **Maths 1ère BilanView** | 60% (audience triptyque) | OUI: même destination mais sources différentes | 🟡 **Complémentarité** — Pré-stage vs Continu |
| **Stage Bilan Coach** | **Bilan Pallier 2** | 40% (audience éleve/parent) | NON: un manuel, un LLM | 🟢 **Complémentarité saine** |
| **Stage Bilan Coach** | **Stage Bilan Legacy** | 30% (même nom, concepts différents) | OUI: risque confusion | 🟡 **Dette produit** — Legacy à migrer |
| **Bilan Gratuit** | **Assessment Universal** | 90% (même pipeline) | NON: Bilan Gratuit = wrapper Assessment | 🟢 **Dépendance légitime** |
| **Diagnostic table** | **Assessment table** | 70% (champs similaires: scoringResult, bilans markdown) | OUI: schémas divergents | 🔴 **Duplication technique** |

### Synthèse des Verdicts

| Type | Surfaces concernées |
|------|---------------------|
| 🔴 **Duplication réelle** | Pallier2 ↔ Assessment (fusionner en 2026) |
| 🔴 **Duplication technique** | Diagnostic table ↔ Assessment table (consolider) |
| 🟡 **Complémentarité** | Pallier2 (pré-stage) + BilanView (continu) + StageBilan (post-stage) = parcours cohérent |
| 🟡 **Migration inachevée** | Stage Bilan Legacy → StageBilan Coach |
| 🟢 **Sain** | Assessment (QCM) + Stage Bilan (manuel) = usage distinct |

---

## 5. Contrats de Données (Q4)

### 5.1 Schémas de Stockage

#### Table `Diagnostic` (Pallier 2 Maths)
```prisma
- id, publicShareId, type, definitionKey, definitionVersion
- studentFirstName, studentLastName, studentEmail, studentPhone
- establishment, teacherName, mathAverage, specialtyAverage, bacBlancResult, classRanking
- data: Json (competencies, examPrep, methodology, ambition, freeText)
- status: RECEIVED → VALIDATED → SCORED → GENERATING → ANALYZED/FAILED
- scoring (V1), scoringV2, analysisResult, analysisJson
- studentMarkdown, parentsMarkdown, nexusMarkdown
- errorCode, retryCount
```

#### Table `Assessment` (Universel)
```prisma
- id, publicShareId, subject, grade
- studentEmail, studentName, studentPhone, studentMetadata
- answers: Json, duration, startedAt, completedAt
- scoringResult: Json, globalScore, confidenceIndex, ssn, uai
- analysisJson, studentMarkdown, parentsMarkdown, nexusMarkdown
- status: PENDING → SCORING → GENERATING → COMPLETED/FAILED
- DomainScore[] (normalized), SkillScore[]
- errorCode, retryCount, assessmentVersion, engineVersion
```

#### Table `StageBilan` (Post-stage)
```prisma
- id, stageId, studentId, coachId
- contentEleve, contentParent, contentInterne
- scoreGlobal (0-20), domainScores: Json
- strengths: String[], areasForGrowth: String[], nextSteps
- pdfUrl, isPublished, publishedAt
```

### 5.2 Contrat d'Audience Tri-Destinataire

| Audience | Champs présents | Ton | Format |
|----------|-----------------|-----|--------|
| **Élève** | studentMarkdown | Bienveillant, tutoiement, actionnable | ~400 mots, bullet points |
| **Parent** | parentsMarkdown | Professionnel, vouvoiement, rassurant | ~500 mots, sections structurées |
| **Nexus** | nexusMarkdown, contentInterne | Technique, factuel, tableaux | ~600 mots, données structurées |

### 5.3 Schéma Canonique Existe-t-il ?

**NON.** Aucun schéma unifié n'existe. Chaque système:
- `lib/bilan-generator.ts` → `GeneratedBilans { eleve, parents, nexus }`
- `lib/assessments/generators/index.ts` → `BilanGenerationResult { studentMarkdown, parentsMarkdown, nexusMarkdown }`
- `lib/diagnostics/bilan-renderer.ts` → `renderAllBilans()` retourne même structure mais usage différent
- `StageBilan` → champs inline (`contentEleve`, `contentParent`, `contentInterne`)

**Problème:** 4 implémentations du même concept sans interface commune.

---

## 6. Persistence et Cycle de Vie (Q5)

| Surface | Stockage | Recalcul | Écrasable | Historisé | Exportable | Ownership |
|---------|----------|----------|-----------|-----------|------------|-----------|
| **Pallier 2 Maths** | `Diagnostic` | NON (snapshot LLM) | NON (immutable) | OUI (full row) | OUI (shareId) | Élève via email |
| **Stage Bilan Coach** | `StageBilan` | NON (manuel) | OUI (coach) | OUI (versions) | OUI (PDF) | Coach + Élève |
| **Assessment Universal** | `Assessment` | NON (snapshot LLM) | NON | OUI (full row) | OUI (shareId) | Élève via email |
| **Maths 1ère BilanView** | Zustand Store | OUI (continu) | N/A | NON | NON (print only) | Local device |
| **Stage Legacy** | `StageReservation.scoringResult` | NON | NON | NON | NON | Réservation |

### Risques Identifiés

| Risque | Sévérité | Description |
|--------|----------|-------------|
| **Collision Diagnostic/Assessment** | 🔴 HIGH | Même élève peut avoir les deux → données désynchronisées |
| **StageBilan sans lien Diagnostic** | 🟡 MEDIUM | Pas de FK entre bilan coach et bilan pré-stage |
| **BilanView non persisté** | 🟡 MEDIUM | Perte données si changement de device |
| **Export disparates** | 🟢 LOW | Certains PDF, d'autres Markdown, d'autres print-only |

---

## 7. Risques Sécurité (Q6)

### 7.1 Surfaces Publiques Identifiées

| Endpoint | Type d'accès | Contrôle |
|----------|--------------|----------|
| `GET /api/bilan-pallier2-maths?share={id}` | Public (shareId) | Aucune auth, seulement publicShareId |
| `GET /api/bilan-pallier2-maths?t={token}` | Public (signed token) | Audience-restricted (eleve/parents only) |
| `GET /api/assessments/[id]/result` | Partiellement public | Vérification d'ownership faible ? |
| Stage Bilan Legacy | Public (reservationId) | `app/stages/fevrier-2026/bilan/[reservationId]/page.tsx` |

### 7.2 Vulnérabilités Potentielles

| Vulnérabilité | Localisation | Impact |
|---------------|--------------|--------|
| **IDOR sur shareId** | `/api/bilan-pallier2-maths?share={id}` | Si shareId prévisible, accès aux bilans d'autres élèves |
| **Exposition nexusMarkdown** | API retourne tout sauf si filtré | `app/api/bilan-pallier2-maths/route.ts:299-301` — filtrage correct par token |
| **Stage Legacy sans auth** | `/stages/fevrier-2026/bilan/[reservationId]` | ReservationId est un CUID (non prévisible) → risque faible |

### 7.3 Conclusion Sécurité

La duplication des surfaces **aggrave** les risques:
- 6 points d'entrée à sécuriser vs 1 canonique
- Logique d'audience dispersée (certains check token, d'autres shareId, d'autres session)
- Risque d'oubli lors d'évolution (ex: nouvelle audience = nouvelle faille potentielle)

---

## 8. Décision d'Architecture Cible (Q7)

### 8.1 Verdict Final

> **Le produit DOIT implémenter un modèle de bilan canonique unique.**

### 8.2 Architecture Cible

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BILAN CANONIQUE — Architecture Cible             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Sources    │────▶│   Canonical  │────▶│   Renders    │        │
│  │   de données │     │   Bilan Model│     │   (3 audiences)│       │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │ Diagnostic │     │  Storage:    │     │ Élève/Parent/│        │
│  │ QCM/Form   │     │  Bilan table │     │ Nexus Views  │        │
│  │ (multi-source)│   │  (unified)   │     │              │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│                                                                     │
│  Sous-jacent: LLM unique + Template engine + RAG                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Consolidation Requise

| Action | Surface Source | Surface Cible | Priorité |
|--------|----------------|---------------|----------|
| **Fusionner** | `Diagnostic` table | `Assessment` table | P0 |
| **Fusionner** | `lib/bilan-generator.ts` | `lib/assessments/generators/index.ts` | P0 |
| **Migrer** | Stage Legacy | `StageBilan` (coach) | P1 |
| **Rendre optionnel** | Maths 1ère BilanView | Configurable (local vs cloud) | P2 |
| **Uniformiser** | 6 exports différents | 1 export PDF/Markdown canonique | P2 |

### 8.4 Schéma Canonique Proposé

```typescript
// lib/bilan/types.ts — Schéma Canonique
interface CanonicalBilan {
  id: string;
  publicShareId: string;
  
  // Typologie
  type: 'DIAGNOSTIC_PRE_STAGE' | 'STAGE_POST' | 'ASSESSMENT_QCM' | 'CONTINUOUS';
  subject: 'MATHS' | 'NSI' | 'GENERAL' | 'MULTI';
  
  // Source
  sourceData: Json; // Union type selon source
  
  // Scoring normalisé
  scores: {
    global: number;        // 0-100
    confidence: number;    // 0-100
    readiness?: number;    // 0-100 (si applicable)
    domains: DomainScore[];
  };
  
  // Rendus (toujours 3 audiences)
  renders: {
    student: string;   // Markdown
    parents: string;   // Markdown
    nexus: string;     // Markdown + structured JSON
  };
  
  // Relations
  studentId: string;
  stageId?: string;
  coachId?: string;  // null si auto-généré (LLM)
  
  // Lifecycle
  status: 'PENDING' | 'SCORING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}
```

---

## 9. LOT 8 — Consolidation Bilan Canonique

### 9.1 Scope du LOT 8

**Objectif:** Unifier tous les bilans sous un modèle canonique unique avec stockage consolidé.

**Durée estimée:** 3-4 sprints

### 9.2 Découpage en Sous-Lots

#### LOT 8.1 — Schéma et Migration (Sprint 1)
**Objectif:** Créer la table `Bilan` canonique et migrer les données existantes.

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| 8.1.1 | `prisma/schema.prisma` | Créer table `Bilan` avec schéma canonique |
| 8.1.2 | `prisma/migrations/` | Migration de consolidation Diagnostic → Bilan |
| 8.1.3 | `prisma/migrations/` | Migration de consolidation Assessment → Bilan |
| 8.1.4 | `scripts/migrate-bilans.ts` | Script de migration des données existantes |
| 8.1.5 | `lib/bilan/types.ts` | Définir interfaces canoniques |

#### LOT 8.2 — Générateur Canonique (Sprint 1-2)
**Objectif:** Unifier les 3 générateurs existants en un seul.

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| 8.2.1 | `lib/bilan/generator.ts` | Créer générateur canonique |
| 8.2.2 | `lib/bilan/prompts.ts` | Prompts unifiés par audience |
| 8.2.3 | `lib/bilan/renderer.ts` | Renderer Markdown canonique |
| 8.2.4 | `lib/bilan/scoring.ts` | Scoring normalisé multi-source |
| 8.2.5 | Deprecate | `lib/bilan-generator.ts` (legacy) |
| 8.2.6 | Deprecate | `lib/assessments/generators/index.ts` |
| 8.2.7 | Deprecate | `lib/diagnostics/bilan-renderer.ts` |

#### LOT 8.3 — API Consolidées (Sprint 2)
**Objectif:** Créer endpoints API unifiés.

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| 8.3.1 | `app/api/bilans/route.ts` | CRUD bilans canoniques |
| 8.3.2 | `app/api/bilans/[id]/route.ts` | GET/PUT/DELETE bilan par ID |
| 8.3.3 | `app/api/bilans/[id]/export/route.ts` | Export PDF/MD universel |
| 8.3.4 | `app/api/bilans/generate/route.ts` | Endpoint de génération |
| 8.3.5 | Update | Adapter `bilan-pallier2-maths` → nouveau endpoint |
| 8.3.6 | Update | Adapter `assessments/submit` → nouveau endpoint |
| 8.3.7 | Update | Adapter `stages/[slug]/bilans` → nouveau endpoint |

#### LOT 8.4 — UI Composants Canoniques (Sprint 3)
**Objectif:** Créer composants réutilisables pour tous les bilans.

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| 8.4.1 | `components/bilan/BilanViewer.tsx` | Visualiseur tri-destinataire canonique |
| 8.4.2 | `components/bilan/BilanTabs.tsx` | Tabs Élève/Parent/Nexus réutilisables |
| 8.4.3 | `components/bilan/BilanExport.tsx` | Boutons export PDF/Partage |
| 8.4.4 | `components/bilan/BilanScoreHeader.tsx` | Header avec scores normalisés |
| 8.4.5 | Update | Refactor `BilanView.tsx` (Maths 1ère) → composants canoniques |
| 8.4.6 | Update | Refactor `StageBilanCard.tsx` → composants canoniques |
| 8.4.7 | Update | Refactor `TeacherView.tsx` bilan tab → composants canoniques |

#### LOT 8.5 — Migration Legacy (Sprint 3-4)
**Objectif:** Migrer les systèmes legacy.

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| 8.5.1 | Migration données | `StageReservation.scoringResult` → `Bilan` |
| 8.5.2 | Update | Retirer `BilanClient.tsx` legacy usage |
| 8.5.3 | Deprecate | Nettoyer code legacy stage février 2026 |
| 8.5.4 | Tests | Jest tests pour toutes les migrations |

### 9.3 Prompt Windsurf LOT 8

```
/context LOT 8 — Consolidation Bilan Canonique

/objective Implémenter le schéma de bilan canonique unique et migrer
           tous les systèmes existants (Diagnostic, Assessment, StageBilan).

/requirements
1. Créer table `Bilan` avec schéma canonique (voir 09_BILANS_DUPLIQUES.md)
2. Créer générateur unifié dans `lib/bilan/generator.ts`
3. Créer API `/api/bilans/*` endpoints canoniques
4. Créer composants réutilisables `components/bilan/*`
5. Migrer données Diagnostic + Assessment vers Bilan
6. Adapter bilan-pallier2-maths, assessments/submit, stages/bilans
7. Déprécier progressivement: lib/bilan-generator.ts, lib/diagnostics/bilan-renderer.ts

/constraints
- Maintenir backward-compat pour URLs existantes (redirects)
- Préserver tous les bilans historiques (migration sans perte)
- Garder tri-destinataire (eleve/parents/nexus) partout
- Pas de régression UX (même look & feel)

/testing
- Jest: tests migration données
- E2E: tous les parcours bilan (gratuit, pallier2, stage, maths1ere)
- Vérifier exports PDF/Markdown

/files
- CREATE: lib/bilan/types.ts, lib/bilan/generator.ts, lib/bilan/prompts.ts
- CREATE: app/api/bilans/route.ts, app/api/bilans/[id]/route.ts
- CREATE: components/bilan/BilanViewer.tsx, components/bilan/BilanTabs.tsx
- UPDATE: prisma/schema.prisma
- UPDATE: app/api/bilan-pallier2-maths/route.ts
- UPDATE: app/api/assessments/submit/route.ts
- UPDATE: app/api/stages/[stageSlug]/bilans/route.ts
- DEPRECATE: lib/bilan-generator.ts, lib/diagnostics/bilan-renderer.ts
```

---

## 10. Recommandations Immédiates (Pre-LOT 8)

### Actions à prendre dès maintenant:

1. **Documenter** les URLs de bilans existants dans un runbook Ops
2. **Auditer** les accès aux 6 surfaces bilan (logs analytics)
3. **Sécuriser** si nécessaire: ajouter rate limiting sur `/api/bilan-pallier2-maths`
4. **Communiquer** aux coaches: le bilan coach va évoluer (préparation changement UX)
5. **Préparer** environnement de staging pour test migration données

---

## 11. Références

### Fichiers Clés Audités

| Fichier | Lignes | Description |
|---------|--------|-------------|
| `lib/bilan-generator.ts` | 411 | Générateur LLM pour Pallier 2 Maths |
| `lib/bilan-scoring.ts` | 267 | Scoring V1 (legacy) |
| `lib/diagnostics/bilan-renderer.ts` | 524 | Renderer Markdown V2 |
| `lib/assessments/generators/index.ts` | 338 | Générateur Assessment |
| `lib/assessments/core/types.ts` | 394 | Types Assessment |
| `app/api/bilan-pallier2-maths/route.ts` | 405 | API Pallier 2 |
| `app/api/stages/[stageSlug]/bilans/route.ts` | 115 | API Stage Bilan Coach |
| `app/api/assessments/submit/route.ts` | 244 | API Assessment Submit |
| `app/bilan-gratuit/page.tsx` | 663 | Page inscription lead |
| `app/bilan-pallier2-maths/page.tsx` | 811 | Formulaire diagnostic |
| `components/stages/StageBilanCard.tsx` | 128 | Card bilan stage |
| `components/dashboard/BilanGratuitBanner.tsx` | 74 | Banner incitation |
| `app/programme/maths-1ere/components/Bilan/BilanView.tsx` | 444 | Bilan in-app |
| `prisma/schema.prisma` | 1464 | Modèles Diagnostic, Assessment, StageBilan |

---

*Rapport généré le 2026-04-19 — AXE 9 Bilans Dupliqués*
