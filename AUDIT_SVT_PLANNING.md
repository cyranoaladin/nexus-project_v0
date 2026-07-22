# AUDIT SVT — Planning & Intégration offre · Pré-rentrée 2026

- **Branche** : `feat/svt-pre-rentree-2026`
- **Commit au moment de l'audit** : `e137009e8`
- **Source de vérité planning** : `data/campaigns/pre-rentree-2026.json`
- **Nature** : audit en lecture seule. Aucun fichier source modifié. Deux fichiers **créés** : ce rapport + `__tests__/campaigns/pre-rentree-2026-gates-audit.test.ts`.
- **Contexte critique** : le dépôt est modifié en parallèle par d'autres agents (le HEAD a bougé `a2293257b → e137009e8` pendant l'audit). Aucune correction/commit/déploiement effectué. Voir §Contexte concurrent.

---

## ÉTAPE A — Grille planning réelle & gates

### A.1 Grille réelle (semaine × bloc × salle)

Blocs : **A** 08:30–10:30 · **B** 10:45–12:45 · **C** 13:30–15:30 · **D** 15:45–17:45 · **E** 18:00–20:00

**Semaine 1 (17–21 août)**

| Bloc | salle-1 | salle-2 |
|------|---------|---------|
| A 08:30 | 3e · Mathématiques `MATHS_TEACHER_A` | Seconde · Français `FRENCH_TEACHER_A` |
| B 10:45 | Seconde · Mathématiques `MATHS_TEACHER_A` | 3e · Français `FRENCH_TEACHER_A` |
| C 13:30 | Première · Mathématiques `MATHS_TEACHER_B` | Terminale · Philosophie `PHILOSOPHY_TEACHER` |
| D 15:45 | Terminale · Mathématiques `MATHS_TEACHER_B` | Première · Français `FRENCH_TEACHER_B` |
| **E 18:00** | *(libre)* | **Première · SVT `SVT_TEACHER_A`** |

**Semaine 2 (24–28 août)**

| Bloc | salle-1 | salle-2 |
|------|---------|---------|
| A 08:30 | Seconde · NSI `COMPUTER_SCIENCE_TEACHER_A` | Première · Physique-Chimie `PHYSICS_CHEMISTRY_TEACHER_A` |
| B 10:45 | Première · NSI `COMPUTER_SCIENCE_TEACHER_A` | Seconde · Physique-Chimie `PHYSICS_CHEMISTRY_TEACHER_A` |
| C 13:30 | Terminale · NSI `COMPUTER_SCIENCE_TEACHER_B` | *(libre)* |
| D 15:45 | *(libre)* | Terminale · Physique-Chimie `PHYSICS_CHEMISTRY_TEACHER_B` |
| **E 18:00** | *(libre)* | **Terminale · SVT `SVT_TEACHER_B`** |

> **Constat structurant** : la SVT est placée sur le **bloc E (18:00–20:00), un 5e créneau du soir**. Or `content/pre-rentree-2026/publication-decisions.owner.json` ne valide que **4 plages jusqu'à 17:45** (A–D) et ne mentionne ni SVT ni créneau du soir. **La SVT sort de la fenêtre horaire actée par la direction** → décision requise (voir §Décisions).
>
> La contrainte **« Maths et NSI = même enseignant »** est respectée par séparation temporelle : Maths entièrement en Semaine 1, NSI entièrement en Semaine 2 (jamais simultanés ; salle-1 partagée sans collision).

### A.2 Gates recalculés sur données réelles (preuve d'exécution)

Test créé : `__tests__/campaigns/pre-rentree-2026-gates-audit.test.ts`, exécuté via `jest --config jest.unit.config.js`.

```
PASS __tests__/campaigns/pre-rentree-2026-gates-audit.test.ts
  ✓ noRoomConflict : aucune salle occupée deux fois sur le même bloc/semaine
  ✓ noTeacherConflict : aucun rôle enseignant sur deux créneaux du même bloc/semaine
  ✓ noLevelConflict (NOUVEAU) : aucun niveau avec deux matières sur le même bloc/semaine
  ✓ dailyLoadValid : chaque niveau ET chaque enseignant restent <= 6h/jour
  ✓ les booléens operationalGates du manifeste correspondent au calcul réel
  ✓ la SVT est bien planifiée pour Première ET Terminale
Tests: 6 passed, 6 total
```

| Gate | Résultat réel | Manifeste |
|------|---------------|-----------|
| noRoomConflict | ✅ aucune collision salle | `true` (cohérent) |
| noTeacherConflict | ✅ aucun enseignant en double | `true` (cohérent) |
| dailyLoadValid | ✅ ≤ 6h/jour (niveaux et enseignants) | `true` (cohérent) |
| **noLevelConflict** (ajouté) | ✅ aucun niveau avec 2 matières sur un même bloc | *(absent du schéma)* |

> Gates de staffing restés à `false` (normal, non finalisé) : `roomAssignmentsValidated`, `teacherAssignmentsValidated`.

### A.3 Qui enseigne la SVT ?

`teacherRoles` déclare **`SVT_TEACHER_A`** et **`SVT_TEACHER_B`** (`subjects: ['SVT']`, `assigned: false`).

- ✅ La SVT **n'est PAS** rattachée à l'enseignant de Physique-Chimie ni à un intervenant non déclaré → **pas de blocage structurel** au sens redouté.
- ⚠️ Comme **toutes** les matières, ces rôles sont provisoires et **non affectés** (`assigned:false`, `teacherAssignmentsValidated:false`). Qui assure physiquement la SVT reste une **décision de direction** (staffing), non un défaut de code.

### A.4 Charge & blocs libres

| Semaine | Occupation | Blocs libres (bloc/salle) | Charge max/jour enseignant |
|---------|-----------|---------------------------|----------------------------|
| S1 | 9 / 10 | **E/salle-1** | 4h (Maths A/B, Français A) — SVT_A : 2h |
| S2 | 7 / 10 | **C/salle-2, D/salle-1, E/salle-1** | 4h (NSI A, PC A) — SVT_B : 2h |

✅ Aucun dépassement. La SVT ajoute **2h/jour** à un enseignant SVT dédié ; il reste des créneaux libres.

---

## ÉTAPE B — Intégration SVT dans l'offre

### B.1 Tarification — cas 5 matières · **BLOQUANT (bug réel)**

- Packs disponibles : `subjects_count` **1, 2, 3, 4** (`data/pricing.canonical.json`). **Aucun pack 5 matières.**
- En Première/Terminale, **5 matières** sont désormais sélectionnables (Maths, PC, NSI, Français/Philo, **SVT**).
- Dans `components/pre-rentree-2026/StageConfigurator.tsx`, `toggleSubject()` (l.256) ajoute les matières **sans plafond** (contrairement à `toggleLimitedSelection` utilisé, lui, pour les spécialités Terminale).
- `summary` (useMemo, l.231) appelle `buildSelectionSummary()` à **chaque** changement de sélection → `selectPackBySubjectCount(packs, 5, level)` renvoie `null` → `configurator.ts` l.292-293 **lève** `Error: Missing canonical campaign pack for 5 subjects`.

**Comportement réel : sélectionner les 5 matières fait planter le récapitulatif/tarif du configurateur.** Résolution = décision de direction : soit **plafonner la sélection à 4**, soit **créer un pack 5 matières** (position tarifaire).

### B.2 Seuil d'ouverture — ✅ conforme, sans traitement spécial SVT

- `decisionDeadline` = **2026-08-10T18:00:00+01:00** ✓ (« décision 10 août 18h »).
- `capacityByOffer.PREMIUM.minPerCohort` = **3** ✓ (ouverture à 3).
- Aucun code ne traite la SVT différemment pour la capacité/le seuil (règle par nombre de matières, agnostique à la matière). Les groupes SVT suivent automatiquement la même règle.

### B.3 Contenus — programme SVT présent mais validation pédagogique à confirmer

- `content/pre-rentree-2026/modules.json` contient **`premiere-svt`** et **`terminale-svt`**, chacun **5 séances** (comme les 4 autres matières) — champs `prerequisites`/`differentiation`/`quickAssessment` + `topics`/`method`/`deliverable` non vides (validé par les 178 tests campagne).
- ✅ Le programme SVT **n'est pas absent ni un stub structurel**.
- ⚠️ Mais sa **validation par la direction pédagogique** est une décision hors code. Aucune donnée n'atteste cette validation → à acter (voir §Décisions).

### B.4 Textes & SEO

**La page `/stages/pre-rentree-2026` elle-même est data-driven** : le JSON-LD (`app/stages/pre-rentree-2026/page.tsx`, `@type: Course` via `offer.subjectCount`) et la section « Matières disponibles selon le niveau » (`level.subjects.map`) affichent **déjà** la SVT en Première/Terminale. `seo.title`/`seo.description` et `app/sitemap.ts` **n'énumèrent pas** les matières → pas de dette SEO sur le cœur de page.

**Dette dans les contenus/marketing statiques** (énumèrent « Maths, Physique-Chimie, NSI et Français/Philosophie » et/ou « 1 à 4 matières », **sans SVT**) — à corriger **uniquement pour les surfaces Première/Terminale** (les listes 3e/Seconde omettent correctement la SVT) :

| Fichier | Occurrence | Action |
|---------|-----------|--------|
| `content/pre-rentree-2026/communication.fr.json` | « …NSI ou Français » (Première) ; « …NSI ou Philosophie » (Terminale) | Ajouter SVT |
| `content/pre-rentree-2026/jpo-2026/master.fr.json` | « à 4 matières parmi …NSI et Français » ; « …NSI et Philosophie » (2 occurrences) | Ajouter SVT + revoir « 4 matières » ⚑ domaine agent JPO concurrent |
| `content/pre-rentree-2026/full-campaign.fr.json` | slides matières (vérifier volets Première/Terminale) | Revue ciblée |
| `content/pre-rentree-2026/week-one-campaign.fr.json` | listes matières S1 | Revue ciblée |
| `content/pre-rentree-2026/parent-guide.fr.json` | « Maths, Français et Philosophie selon le niveau » | Revue ciblée |
| Manifeste `content.faq` « Quel matériel apporter ? » | énumération sans SVT (alors que `materialsBySubject.SVT` existe) | Aligner le texte FAQ |

> **NON CORRIGÉ** — liste fournie pour arbitrage. Ne pas toucher aux énumérations 3e/Seconde.

---

## ÉTAPE C — Dette de cohérence avec les supports publiés

> ⚠️ Le dossier `./outputs/` **n'existe pas** dans le dépôt. Les PDF réels se trouvent dans
> `assets/campaigns/pre-rentree-2026/parent-documents/pdf/` (14 documents, source `parent-documents.fr.json`),
> `programmes/*.pdf` (4 : Maths & NSI, Première & Terminale), et `assets/campaigns/pre-rentree-2026/full-campaign/calendar/`.
> Merci de confirmer le jeu de « 7 PDF » visé.

| Document (source) | Sections à modifier | Dépendance |
|-------------------|---------------------|-----------|
| **Flyer / Brochure « Stages de pré-rentrée 2026 »** (`brochure-generale.pdf`) | Liste des matières Première/Terminale ; horaires (créneau du soir SVT ?) | Attend décision créneau E + textes B.4 |
| **Planning** (`full-campaign/calendar` + grilles par niveau) | Ajouter ligne SVT Première (S1, bloc E) & Terminale (S2, bloc E) ; vue par salle (salle-2 soir) | Attend **validation grille planning** (créneau E acté) |
| **Tarifs** (`justification-tarifaire.pdf` — « Comprendre le tarif ») | Mention « 1 à 4 matières » ; grille par nombre de matières | Attend **position tarifaire ≥ 4 matières** (B.1) |
| **Dossier d'accueil / Guide parent** (`guide-parent.pdf`) | Cases/listes matières Première/Terminale | Attend textes B.4 |
| **Fiche Première** (`fiche-premiere.pdf`) | Énumération 4 matières → +SVT | Attend textes B.4 + décision cap 4/5 |
| **Fiche Terminale** (`fiche-terminale.pdf`) | Énumération 4 matières → +SVT | Attend textes B.4 + décision cap 4/5 |
| **Comparatif Fondations/Premium** (`comparatif-fondations-premium.pdf`) | « jusqu'à 4 matières » | Attend décision cap 4/5 |
| **Programmes** (`programme_eds_{maths,nsi}_{premiere,terminale}.pdf`) | **Aucun programme SVT n'existe** (ni PC ni Français) | Attend **programme SVT validé** par la direction pédagogique (B.3) |
| Fiches **3e** & **Seconde** | *(aucune — SVT non offerte à ces niveaux)* | — |

---

## ÉTAPE D — Synthèse & DÉCISIONS REQUISES

### Bloquants identifiés

1. **[BUG] Cas 5 matières** — le configurateur plante si un élève de Première/Terminale choisit les 5 matières (`Missing canonical campaign pack for 5 subjects`). Correction technique dépendante d'une décision tarifaire.
2. **[GOUVERNANCE] Créneau du soir SVT (bloc E 18:00–20:00)** — hors des 4 plages actées dans `publication-decisions.owner.json`. À acter avant toute publication.
3. **[GOUVERNANCE] Programme SVT** — présent et structurellement complet, mais **validation direction pédagogique** non attestée.
4. **[STAFFING] Enseignant SVT** — rôles `SVT_TEACHER_A/B` déclarés mais non affectés (comme toutes les matières). Non bloquant structurellement ; affectation = décision direction.

### Fichiers code/SEO à modifier (rappel, non corrigés)
- `components/pre-rentree-2026/StageConfigurator.tsx` (cap sélection) **ou** `data/pricing.canonical.json` (pack 5 matières).
- Contenus B.4 : `communication.fr.json`, `jpo-2026/master.fr.json`, `full-campaign.fr.json`, `week-one-campaign.fr.json`, `parent-guide.fr.json`, FAQ « matériel » du manifeste.
- `data/campaigns/pre-rentree-2026.json` : créneau E / SVT — seulement si la direction acte le soir et met à jour `publication-decisions.owner.json`.

### DÉCISIONS REQUISES (ressort de la direction uniquement)

1. **Affectation enseignant SVT** — qui assure `SVT_TEACHER_A` (Première) et `SVT_TEACHER_B` (Terminale) ? *(aucune mention de rémunération dans les supports publics)*
2. **Validation du programme SVT** Première & Terminale (5 séances chacun) par la direction pédagogique.
3. **Position tarifaire au-delà de 4 matières** — plafonner la sélection à 4, ou créer un pack 5 matières (prix à fixer). Détermine la correction du bug B.1 et les mentions « 1 à 4 matières ».
4. **Créneau du soir (18:00–20:00)** — acter ou non le bloc E pour la SVT, et le reporter dans `publication-decisions.owner.json` (aujourd'hui limité à 17:45).
5. **Date de mise en ligne** et périmètre des supports publiés à régénérer (Étape C).

> **STOP** — aucune correction, aucun commit, aucun déploiement ne sera effectué sans GO explicite de la direction. Rappels tenus : aucune donnée inventée (créneaux/séances/prix issus des sources du dépôt), aucune mention de rémunération enseignant, aucun chiffre invérifiable.
