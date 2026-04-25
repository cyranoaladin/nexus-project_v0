# Audit prod — Patch de déploiement — 25/04/2026

> Auteur : Shark (Alaeddine Ben Rhouma)
> Date audit initial : 25/04/2026 14h54
> Date vérification psql : 25/04/2026 17h00
> DB : nexus_prod (user: nexus_admin)

---

## 1. État `_prisma_migrations` en prod au 25/04 17h

| Migration | Statut | Appliquée le |
|-----------|--------|-------------|
| `20260201201612_add_cron_execution_tracking` | ok | 2026-04-19 01:00 |
| `20260222_add_bilan_gratuit_tracking` | ok | 2026-04-19 01:00 |
| `20260501000000_add_maths_progress` | ok | 2026-04-23 20:58 |
| `20260425094000_add_student_track_level_specialties` | ok | 2026-04-25 09:44 |
| `20260425113000_add_maths_progress_track` | ok | 2026-04-25 09:44 |
| `20260502000000_ensure_maths_progress_track_column` | ok | 2026-04-25 10:21 |

**Conclusion** : aucune entrée fantôme. L'audit initial du 25/04 14h54 signalait
`20250420190000_add_maths_progress` en double — ce diagnostic était basé sur un état
transitoire (entre 09:44 et 10:21). La migration corrective
`20260502000000_ensure_maths_progress_track_column` avait déjà remis tout en ordre
avant que l'audit soit lancé.

Voir : `scripts/db/reconcile-maths-progress-history.sql` (témoin — aucune action requise).

---

## 2. Structure table `maths_progress` en prod

30 colonnes confirmées, dont les colonnes critiques :

| Colonne | Type | Contrainte |
|---------|------|-----------|
| `track` | `AcademicTrack` | NOT NULL DEFAULT 'EDS_GENERALE' |
| `level` | `MathsLevel` | NOT NULL |
| `userId` | `text` | NOT NULL, FK → users(id) ON DELETE RESTRICT |
| `completedChapters` | array | — |
| `masteredChapters` | array | — |
| `totalXp` | int | — |
| `streak` | int | — |

Index unique : `(userId, level, track)` ✅

---

## 3. Structure table `students` en prod

| Colonne | Type | Statut |
|---------|------|--------|
| `gradeLevel` | USER-DEFINED | NOT NULL ✅ |
| `academicTrack` | USER-DEFINED | NOT NULL ✅ |
| `specialties` | ARRAY | NOT NULL ✅ |
| `stmgPathway` | USER-DEFINED | NULLABLE ✅ |
| `updatedTrackAt` | timestamp | NULLABLE ✅ |
| `survivalMode` | boolean | **ABSENT** 🟡 — sera ajouté par la migration PR |

---

## 4. Classification du `deploy-patch.patch` (251 lignes, 5 hunks)

Le patch local récupéré en Phase 1 contenait des ajustements appliqués manuellement
en prod avant que les migrations soient formalisées. Après vérification du schéma prod
au 25/04 17h, classification hunk par hunk :

| Hunk | Description | Statut |
|------|-------------|--------|
| 1 | Ajout colonne `track` sur `maths_progress` | **Absorbé** — migration `20260425113000` + `20260502000000` couvrent |
| 2 | Ajout colonne `gradeLevel` / `academicTrack` sur `students` | **Absorbé** — migration `20260425094000` présente en prod |
| 3 | Ajout colonne `specialties` ARRAY sur `students` | **Absorbé** — idem migration `20260425094000` |
| 4 | Index `(userId, level, track)` sur `maths_progress` | **Absorbé** — confirmé par `\d maths_progress` en prod |
| 5 | Ajout `stmgPathway` / `updatedTrackAt` sur `students` | **Absorbé** — confirmé présent en prod |

**Résultat : tous les hunks sont absorbés.** Le `deploy-patch.patch` n'a plus besoin
d'être porté manuellement — les migrations formelles couvrent l'intégralité des
changements. Le fichier patch peut être supprimé de l'environnement de production
lors du prochain déploiement (`rm -f deploy-patch.patch`).

---

## 5. Ce qui sera ajouté par la PR en cours

La seule migration apportée par `feat/dashboards-premiere-finalization` :

```sql
-- 20260504000000_add_survival_mode
CREATE TABLE survival_progress (...);
ALTER TABLE students ADD COLUMN "survivalMode" boolean NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN "survivalModeReason" text;
```

**Rétro-compatible** : aucune table modifiée destructivement, aucun DEFAULT
coercitif sur des données existantes.

Voir : `docs/ROLLBACK_PLAN_2026-04-25.md` pour la procédure complète.
