# Audit UX du planning — attente élève maximale 60 minutes

**Mission** : auditer puis optimiser le planning des stages de pré-rentrée 2026 pour qu'aucun
élève, pour tout parcours réellement autorisé, n'ait plus de 60 minutes d'attente entre deux
séances qu'il suit le même jour.

## 1. Contexte Git (vérifié, pas supposé)

- `origin` : `git@github.com:cyranoaladin/nexus-project_v0.git`
- `origin/main` : `a0db57a7bc4db25b8d163d92c2ed3e95b65da961` (inchangé)
- PR #75 : `feat/pre-rentree-planning-scheduler`, SHA `202cd06fd3aff7877e8382e0e5305e2f...` (tronqué),
  DRAFT, non fusionnée, `releaseStatus=READY_FOR_OWNER_GO`, CI bloquée sur Dependency Integrity
- PR #76 : `feat/pre-rentree-2026-parent-pdf-redesign`, SHA `43dfb8ff6b2a2d960d1f765ed70ae433f701cd42`,
  DRAFT, non fusionnée, workflow documentaire vert, CI générale rouge (même audit npm)
- Branche de cette mission : `feat/pre-rentree-2026-schedule-ux-optimization`, créée depuis un
  worktree isolé `/home/alaeddine/Bureau/nexus-wt-pre-rentree-schedule-ux`, branchée exactement sur
  la tête distante réelle de la PR #76 (`43dfb8ff6...`, vérifiée via `git ls-remote` avant création).
- Aucun workflow GitHub en cours au moment du démarrage (tous `completed`).
- Aucun merge, déploiement, changement de gate, tag de GO ou modification de dépendances effectué.

## 2. Reproduction indépendante de la baseline

Les temps de bloc (`data/campaigns/pre-rentree-2026.json → blocks`) et la grille
(`→ schedule`) ont été relus intégralement et l'écart entre chaque paire de blocs recalculé par
script (pas recopié) :

| Paire | Écart |
|---|---:|
| A→B | 15 min |
| B→C | 60 min |
| C→D | 15 min |
| A→C | 195 min |
| B→D | 195 min |
| A→D | 330 min |

Un moteur d'itinéraire déterministe (`lib/campaigns/pre-rentree-2026/itinerary.ts` côté TS,
`tools/pdf-generator/itinerary.py` côté Python, algorithmes identiques, testés l'un contre l'autre)
a ensuite recalculé, à partir du planning réel daté (`getPreRentreeSchedule()` /
`PreRentreeData.dated_slots_for_level()`), l'intégralité des cas donnés dans la mission — **tous
confirmés exacts, sans aucun écart** (voir `__tests__/campaigns/pre-rentree-2026-student-idle-time.test.ts`
et `scripts/pre-rentree/tests/test_student_idle_time.py`, 23 assertions chacun, verts) :

- 3e Mathématiques(A) + Français(C) : 195 min → **NON CONFORME**
- Seconde Français(A) + Mathématiques(B) : 15 min → conforme
- Première fenêtre 1 : Français(B)+Maths(C) 60 min conforme ; Maths(C)+NSI(D) 15 min conforme ;
  Français+NSI seuls 195 min **NON CONFORME** ; les 3 ensemble : max 60 min conforme
- Première fenêtre 2 : SVT(A)+PC(B) 15 min conforme
- Terminale : les 10 paires de la baseline (voir mission §5) toutes confirmées à l'identique,
  y compris NSI+SVT SIMULTANEOUS (bloc C partagé)

## 3. Matrice complète des sélections commercialement réalistes (baseline)

`assets/campaigns/pre-rentree-2026/schedule-optimization/selection-matrix.csv` — 66 sélections
non vides jusqu'au plafond commercial réel (2 matières 3e/Seconde, 4 matières Première/Terminale) :

| Statut | Nombre |
|---|---:|
| COMPACT | 27 |
| NO_SHARED_DAY | 20 |
| **LONG_IDLE** | **12** |
| **SIMULTANEOUS** | **7** |

12 sélections commercialement vendables imposent aujourd'hui une attente > 60 minutes ; 7 sont
physiquement impossibles (créneau partagé). Détail : `student-itineraries.csv` (toutes les paires),
`selection-matrix.csv` (toutes les sélections jusqu'à 4 matières).

## 4. Défaut produit confirmé — modèle de compatibilité binaire trompeur

**Confirmé par preuve, pas par supposition.** Avant cette mission :

- Le PDF Terminale affirmait littéralement : *« Les autres combinaisons de matières proposées
  pour ce niveau ne se chevauchent pas dans la grille »* — alors que Mathématiques+Physique-Chimie
  impose 330 minutes d'attente, Mathématiques+NSI et Mathématiques+SVT 195 minutes chacune.
- Le PDF Première affirmait : *« toutes les combinaisons de matières disponibles sont
  compatibles »* — alors que Français+NSI impose 195 minutes d'attente.
- Le sélecteur live (`StagePlanningSelector.tsx`) ne calculait un conflit que pour les créneaux
  strictement simultanés (`areSubjectsIncompatible`) ; une sélection à 330 minutes d'attente
  n'affichait **aucun avertissement** et le CTA restait actif comme pour une sélection compacte.

**Corrigé** (voir §6) : un modèle à 6 statuts (`NO_SHARED_DAY`, `COMPACT`, `LONG_IDLE`,
`SIMULTANEOUS`, `REQUIRES_ALTERNATIVE_COHORT`, `REQUIRES_MANUAL_REVIEW`) remplace le booléen, sur
toutes les surfaces (PDF, sélecteur, tests). `REQUIRES_ALTERNATIVE_COHORT` reste **non atteignable**
aujourd'hui : la grille canonique n'a qu'une seule cohorte par (niveau, matière) — ce statut est
réservé pour quand des cohortes alternatives existeront réellement dans les données (voir §8 du
rapport d'optimisation).

## 5. Défaut confirmé — modèle de profil Première omettant la SVT

**Confirmé par lecture directe du code**, avant correction :

```
const PREMIERE_SPECIALTY_PLAN_IDS = ['AUCUNE_NSI_PC', 'NSI', 'PHYSIQUE_CHIMIE', 'NSI_PHYSIQUE_CHIMIE'];
function premierePlansSubject(plan, subject) {
  if (subject === 'NSI') return plan === 'NSI' || plan === 'NSI_PHYSIQUE_CHIMIE';
  if (subject === 'PHYSIQUE_CHIMIE') return plan === 'PHYSIQUE_CHIMIE' || plan === 'NSI_PHYSIQUE_CHIMIE';
  return true;  // ← SVT (et tout le reste) toujours "true", jamais envoyée en revue
}
```

La SVT est pourtant une matière Première réellement commercialisée (`content/pre-rentree-2026/
offers.json → PREMIERE.subjects` l'inclut). Le même défaut existait en Terminale : la vérification
`retainedSpecialties` ne testait que NSI et Physique-Chimie, jamais SVT, malgré
`TERMINALE_SPECIALTY_IDS` qui l'inclut bien.

**Corrigé** (voir §6) : 4 nouveaux plans Première (`SVT`, `NSI_SVT`, `PHYSIQUE_CHIMIE_SVT`,
`NSI_PHYSIQUE_CHIMIE_SVT`), ajout additif (aucun id existant renommé/supprimé — seul le libellé de
`AUCUNE_NSI_PC` a été précisé pour mentionner la SVT) ; la vérification Terminale inclut désormais SVT.

## 6. Corrections appliquées (cette mission, hors modification du planning canonique)

| Surface | Changement |
|---|---|
| `lib/campaigns/pre-rentree-2026/itinerary.ts` + `.py` | Nouveau moteur d'itinéraire déterministe, statuts riches, testé croisé TS/Python |
| `tools/pdf-generator/generate_level_dossiers.py` | Section « Peut-on combiner ces matières ? » recalculée par paire, plus jamais de généralisation trompeuse |
| `components/pre-rentree-2026/StagePlanningSelector.tsx` | CTA bloqué seulement si `SIMULTANEOUS` (impossible) ; `LONG_IDLE` averti sans bloquer ; badge positif si `COMPACT` |
| `lib/campaigns/pre-rentree-2026/configurator.ts` + `bilan-prefill.ts` | SVT ajoutée au modèle de profil Première/Terminale |
| `data/campaigns/pre-rentree-2026.json` | 4 nouveaux plans de spécialité Première (additif) |

Aucun de ces changements ne touche la grille canonique elle-même (dates, blocs, salles, rôles) —
uniquement la façon dont sa compatibilité est calculée et affichée. Voir
`SCHEDULE-OPTIMIZATION-REPORT.md` pour l'analyse des scénarios de refonte du planning lui-même.
