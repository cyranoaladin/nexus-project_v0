# Architecture de Pilotage — Nexus Réussite

> Document technique décrivant le système de pilotage intelligent de la progression.

---

## Vue d'ensemble

Le système de pilotage repose sur 3 moteurs complémentaires :

| Moteur | Rôle | Temporalité |
|--------|------|-------------|
| **Next Step Engine** | Action immédiate recommandée | Réactif (temps réel) |
| **Nexus Index™** | Score composite de progression | Analytique (30j glissants) |
| **Trajectoire Engine** | Plan stratégique avec jalons | Proactif (3–12 mois) |

---

## 1. Nexus Index™

### Fichiers
- `lib/nexus-index.ts` — Moteur de calcul (pur, testable)
- `app/api/student/nexus-index/route.ts` — API endpoint
- `components/dashboard/NexusIndexCard.tsx` — Composant UI
- `__tests__/lib/nexus-index.test.ts` — 37 tests unitaires

### 4 Piliers (pondération)

| Pilier | Poids | Source de données |
|--------|-------|-------------------|
| **Assiduité** | 30% | SessionBooking (COMPLETED vs CANCELLED/NO_SHOW) |
| **Progression** | 30% | SessionReport.performanceRating (1–5, récents ×2) |
| **Engagement** | 20% | Sessions + ARIA conversations + feedback + diagnostics |
| **Régularité** | 20% | Fréquence des sessions + pénalité gaps >14j |

### Score global
- Chaque pilier : 0–100
- Score global = Σ(pilier × poids) → 0–100
- Niveaux : `excellent` (≥80), `bon` (≥60), `en_progression` (≥40), `a_renforcer` (≥20), `debutant` (<20)

### Tendance
- Compare les 30 derniers jours vs les 30 jours précédents
- Signal = 60% taux de complétion + 40% notes moyennes
- Seuil ±5% → `up` / `down` / `stable`

### Architecture
```
computeNexusIndex(userId)
  └─ fetchIndexData(userId)     ← DB queries (parallèles)
  └─ computeFromData(data)      ← Pure function (testable)
       ├─ computeAssiduite()
       ├─ computeProgression()
       ├─ computeEngagement()
       ├─ computeRegularite()
       └─ computeTrend()
```

---

## 2. Next Step Engine

### Fichiers
- `lib/next-step-engine.ts` — Moteur de recommandation
- `app/api/me/next-step/route.ts` — API endpoint (role-agnostic)
- `components/dashboard/NextStepCard.tsx` — Composant UI premium
- `__tests__/lib/next-step-engine.test.ts` — 27 tests unitaires

### Logique par rôle

| Rôle | Étapes possibles |
|------|-----------------|
| PARENT | ADD_CHILD → SUBSCRIBE → BUY_CREDITS → BOOK_SESSION |
| ELEVE | ACTIVATE_ACCOUNT → BOOK_SESSION |
| COACH | COMPLETE_PROFILE → SUBMIT_REPORT → TODAY_SESSIONS → SET_AVAILABILITY |
| ASSISTANTE | REVIEW_REQUESTS → PENDING_PAYMENTS → UNASSIGNED_SESSIONS |
| ADMIN | PLATFORM_OVERVIEW |

### Priorités visuelles
- `critical` — Bordure rouge, icône AlertTriangle
- `high` — Bordure ambre, icône Zap
- `medium` — Bordure bleue, icône Info
- `low` — Bordure neutre, icône ChevronRight

---

## 3. Trajectoire Engine

### Fichiers
- `prisma/schema.prisma` — Modèle `Trajectory` + enum `TrajectoryStatus`
- `lib/trajectory.ts` — Service CRUD + enrichissement
- `components/dashboard/TrajectoireCard.tsx` — Placeholder UI
- `__tests__/lib/trajectory.test.ts` — 7 tests unitaires

### Modèle de données
```prisma
model Trajectory {
  id          String           @id @default(cuid())
  studentId   String
  title       String
  description String?
  targetScore Int?             // Nexus Index cible (0–100)
  horizon     String           // "3_MONTHS" | "6_MONTHS" | "12_MONTHS"
  startDate   DateTime
  endDate     DateTime
  status      TrajectoryStatus // ACTIVE | PAUSED | COMPLETED | ABANDONED
  milestones  Json             // Array<Milestone>
  createdBy   String?
}
```

### Milestone
```typescript
interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedAt: string | null;
}
```

### Statut : Phase 1 (backend only)
- CRUD opérationnel
- Pas d'UI complète (placeholder "Bientôt")
- Phase 2 prévue : auto-génération depuis Nexus Index, suivi des jalons

---

## 4. Dashboard Pilotage

### Fichiers
- `components/dashboard/DashboardPilotage.tsx` — Layout 3 zones
- `components/dashboard/NexusIndexCard.tsx` — Vision globale
- `components/dashboard/NextStepCard.tsx` — Prochaine action
- `components/dashboard/EvolutionCard.tsx` — Indicateurs clés
- `components/dashboard/TrajectoireCard.tsx` — Trajectoire (placeholder)

### Layout 3 zones

```
┌─────────────────────────────────────────────────┐
│  Zone 2: Prochaine action (NextStepCard)        │
├──────────────┬──────────────────────────────────┤
│  Zone 1:     │  Zone 3: Indicateurs clés        │
│  Vision      │  ┌─────────────────────────────┐ │
│  globale     │  │ EvolutionCard               │ │
│              │  └─────────────────────────────┘ │
│ NexusIndex   │                                  │
│ Trajectoire  │  [Contenu spécifique au rôle]    │
└──────────────┴──────────────────────────────────┘
```

### Principes UX
- **Sobriété** — Pas de gamification, pas d'effets visuels inutiles
- **Clarté** — Chaque bloc a un objectif unique et lisible
- **Premium lite** — Design épuré, typographie soignée, couleurs du design system
- **Responsive** — 1 colonne mobile, 3 colonnes desktop

---

## 5. API Endpoints

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/api/student/nexus-index` | GET | ELEVE, PARENT, ADMIN, ASSISTANTE | Nexus Index du student |
| `/api/me/next-step` | GET | Tous rôles | Prochaine action recommandée |

---

## 6. Tests

| Suite | Tests | Couverture |
|-------|-------|-----------|
| nexus-index.test.ts | 37 | Tous piliers, trend, edge cases, niveaux |
| trajectory.test.ts | 7 | parseMilestones, coercition, valeurs par défaut |
| next-step-engine.test.ts | 27 | Tous rôles, priorités, cas limites |
| **Total nouveau** | **44** | |
| **Total global** | **2280** | 154 suites, 0 failures |
