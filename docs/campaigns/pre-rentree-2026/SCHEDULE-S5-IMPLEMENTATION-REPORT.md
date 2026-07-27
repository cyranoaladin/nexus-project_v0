# Rapport d'implémentation — S5 (3 salles + week-end, fin au 28 août)

Compagnon de `SCHEDULE-S5-THREE-ROOMS-DECISION.md` (la décision propriétaire qui autorise ce
scénario) et `SCHEDULE-OPTIMIZATION-REPORT.md` (§S5, la preuve solveur). Ce rapport documente ce
qui a été concrètement changé pour appliquer la solution prouvée à la grille canonique et à toutes
les surfaces qui en dérivent, dans la branche `feat/pre-rentree-2026-schedule-s4-three-rooms`
(stackée sur PR #77, `feat/pre-rentree-2026-schedule-ux-optimization`).

## 1. Grille canonique

`data/campaigns/pre-rentree-2026.json` : `schedule[]` réécrit pour les 3 fenêtres, `roomRoles`
étendu avec `"salle-3": ["SVT"]`, `academicProfiles.TERMINALE.retainedSpecialties.options` complété
avec `{"id": "SVT", "label": "SVT"}` (absent des options malgré une logique de compatibilité qui la
vérifiait déjà — écart trouvé lors de l'audit obligatoire de la section D de la mission, corrigé
avant toute optimisation, avec un test de régression dédié).

17 cohortes opérationnelles (14 modules pédagogiques uniques + 3 matières à 2 cohortes : Première
SVT, Terminale NSI, Terminale SVT) = 85 séances calendrier (17 × 5), toujours 5 séances / 10 h
suivies par élève et par matière choisie.

## 2. Modèle de données additif (cohortes)

- `lib/campaigns/pre-rentree-2026/schema.ts` : `ScheduleSlot` étendu avec `cohortId`,
  `alternativeGroupId`, `isPrimary` (tous optionnels — une entrée sans `cohortId` reste lisible
  comme cohorte unique, rétrocompatible).
- `tools/pdf-generator/pre_rentree_data.py` : `ScheduledSlot` (dataclass) reçoit les mêmes champs ;
  `_expand_schedule()` les propage.
- `scripts/pre-rentree/publication-derivations.ts` / `publication-snapshot-schema.ts` : le snapshot
  public porte aussi `cohortId` (additif) ; `PUBLIC_ROOM_LABELS` complété avec `salle-3` ; le
  compteur `sessionNumber` est désormais clé par `(niveau, matière, cohortId)` — sans ce correctif,
  une matière à 2 cohortes aurait été numérotée 1 à 10 au lieu de 1 à 5 par cohorte (bug trouvé et
  corrigé avant la régénération du snapshot).

## 3. Moteur d'affectation de cohorte (`assignItinerary` / `assign_itinerary`)

Nouvelle fonction, en plus de `computeItinerary`/`compute_itinerary` (inchangée) :
`lib/campaigns/pre-rentree-2026/itinerary.ts` et `tools/pdf-generator/itinerary.py`. Pour chaque
matière sélectionnée par la famille, énumère toutes les cohortes disponibles et choisit celle qui
minimise, dans l'ordre : simultanéité, attente longue, attente totale, préférence pour la cohorte
primaire — jamais deux cohortes de la même matière dans un même itinéraire (toujours exactement 5
séances par matière retournées, jamais 10). Une vraie erreur de comparaison lexicographique a été
trouvée et corrigée pendant l'implémentation TS : comparer des tuples `[number,number,number,number]`
avec `<` en JavaScript fait une comparaison de **chaînes**, pas numérique — remplacé par un
comparateur explicite élément par élément.

## 4. Surfaces mises à jour pour être cohort-conscientes

| Surface | Avant | Après |
|---|---|---|
| `lib/campaigns/pre-rentree-2026/configurator.ts` (`buildSelectionSummary`) | filtrait le planning brut par `(niveau, matière)` — double-comptait une matière à 2 cohortes | utilise `assignItinerary`, une seule cohorte par matière |
| `components/pre-rentree-2026/StagePlanningSelector.tsx` | `computeItinerary` sur les données brutes | `assignItinerary` — statut, attente et créneaux affichés reflètent la meilleure cohorte |
| `components/pre-rentree-2026/ScheduleSection.tsx` (tableaux planning) | 2 colonnes salle codées en dur, `salle-3` invisible | colonnes calculées dynamiquement par fenêtre à partir des créneaux réels |
| `tools/pdf-generator/generate_level_dossiers.py` (« Peut-on combiner ces matières ? ») | `compute_itinerary` sur les séances datées brutes — aurait fusionné les 2 cohortes NSI/SVT en un faux itinéraire impossible | `assign_itinerary` — reflète la cohorte qu'une famille recevrait réellement |
| WhatsApp (`buildWhatsAppMessage`) | dérivé de `buildSelectionSummary` | corrigé automatiquement par le point ci-dessus (aucun changement direct nécessaire) |

Le message WhatsApp et le résumé de sélection n'affichent jamais deux fois la même matière ni un
volume horaire doublé : le prix et les heures dépendent du nombre de matières choisies par la
famille (`subjectIds.length`), jamais du nombre de cohortes.

## 5. Écart pédagogique consigné, pas maquillé en problème de planning

`classifyProfileSubjectCompatibility()` (`configurator.ts`) route désormais le cas « Mathématiques
complémentaires + Mathématiques » vers `REQUIRES_PEDAGOGICAL_REVIEW` au lieu de
`COMPATIBLE_WITH_DIFFERENTIATION` (aucune différenciation réelle n'existe pour ce profil : le
module actuel cible le programme de spécialité EDS Mathématiques, pas Mathématiques
complémentaires). Consigné comme dette pédagogique distincte :
`DEBT-PRE2026-PEDAGOGY-MATHS-COMPLEMENTAIRES` (P2, OPEN, `residual-debt.fr.json`), jamais résolu en
changeant le planning.

## 6. Tests

Cascade de mises à jour attendue et vérifiée (jamais un assouplissement d'assertion pour forcer un
succès — chaque changement recalculé indépendamment depuis les données réelles) :

- `__tests__/campaigns/pre-rentree-2026-student-idle-time.test.ts` et son miroir Python
  `scripts/pre-rentree/tests/test_student_idle_time.py` : réécrits intégralement pour la grille S5,
  35 tests chacun, valeurs croisées identiques entre TS et Python.
- `pre-rentree-2026.test.ts`, `-staffing.test.ts`, `-schedule-gates.test.ts`,
  `-landing-dto.test.ts`, `-configurator.test.ts`, `-profile-compatibility.test.ts`,
  `-publication-snapshot.test.ts` : assertions de comptage/salle/cohorte recalculées pour la
  réalité 17 cohortes / 85 séances / `salle-3`.
- `__tests__/components/pre-rentree-2026-{sections,planning-selector,configurator}.test.tsx` :
  assertions de rendu (colonnes de salle, dates affichées) recalculées après le correctif dynamique
  de `ScheduleSection.tsx`.
- `scripts/pre-rentree/tests/test_level_dossiers.py` : `assign_itinerary` remplace `compute_itinerary`
  dans le test de non-régression « pas de compatibilité affichée à côté d'une attente longue » ;
  plafond de salles étendu à `salle-3`.
- Nouveau test explicite « ne double jamais le prix, les heures ou le nombre de séances pour une
  matière à deux cohortes » (`pre-rentree-2026-configurator.test.ts`).
- Nouveaux tests d'invariants de cohorte (déterminisme de `assignItinerary`/`assign_itinerary`,
  jamais 2 cohortes combinées, `cohortBySubject` vide pour une matière à cohorte unique, échec
  explicite — jamais silencieux — si une matière n'a aucune cohorte pour un niveau donné).

Suite complète (jest, scope `pre-rentree-2026`) : 46 suites, 359 tests, tous verts après cette
mission. Suite Python (`pytest scripts/pre-rentree/tests`) : voir §7.

## 7. Validation

- `npm run typecheck` : aucune erreur.
- `npx eslint` sur les fichiers touchés : aucun avertissement.
- `npm run pre-rentree:snapshot` : régénéré avec succès après correction de `salle-3` dans
  `publication-derivations.ts` (room label manquant) et `sessions.length` (70 → 85 dans
  `publication-snapshot-schema.ts`).
- `python3 -m pytest scripts/pre-rentree/tests -q` : voir résultat final consigné dans le commit
  correspondant.
