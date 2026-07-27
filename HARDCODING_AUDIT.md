# Audit hardcoding — périmètre Pré-rentrée 2026

Chasse systématique aux valeurs métier écrites en dur (dates, tarifs, seuil d'ouverture,
blocs horaires, salles, rôles enseignants, listes matières/niveaux) sur le périmètre :
`lib/campaigns/pre-rentree-2026/`, `components/pre-rentree-2026/`, `scripts/pre-rentree/`,
`tools/pdf-generator/`, `app/stages/pre-rentree-2026/`, `app/pre-rentree/`.

Pour chaque occurrence : `occurrence → fichier → source canonique → action`.

---

## 1. Dates

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| `startDate: z.literal('2026-08-17')`, `endDate: z.literal('2026-08-28')` | `lib/campaigns/pre-rentree-2026/schema.ts:182-183` | — | **Justifié** : c'est la définition du schéma Zod qui *valide* que `data/campaigns/pre-rentree-2026.json` contient bien ces dates (fail-closed si la donnée dévie). Ce n'est pas une duplication de la donnée, c'est son verrou. |
| « Dès le 17 août » (×4, textes marketing) | `render_week_one_kit.py`, `render_full_campaign.py` | `campaign.startDate` | **Justifié, libellé d'affichage.** Texte marketing court dérivé implicitement de la date de début ; changer la date casserait visuellement ces textes de toute façon (ils devraient être régénérés). Non corrigé : risque de sur-ingénierie pour un gain marginal sur du texte promotionnel figé par campagne. |
| « 17–28 août 2026 » (×4, en-têtes PDF) | `tools/pdf-generator/generate_all_pdfs.py` | `campaign.startDate`/`endDate` | **Justifié**, même raisonnement : en-têtes visuels d'un PDF figé par campagne, jamais réutilisé d'une édition à l'autre sans régénération complète du document. |
| « pas de cours les 22 et 23 août » | `generate_all_pdfs.py::make_dossier_accueil_body` | `data/campaigns/pre-rentree-2026.json → schedule` | 🔴 **BUG RÉEL, CORRIGÉ.** Faux : SVT et Physique-Chimie Première ont des séances le 22 et le 23 août (fenêtre `weekend-debut-fenetre-2`). Contredisait le même fichier ailleurs (`make_planning_body`, texte correct). Corrigé pour reprendre le texte exact et vérifié : « y compris le week-end du 22-23 août (SVT et Physique-Chimie Première uniquement) ». Commit `bde4de960`. |

## 2. Tarifs

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| Recherche exhaustive de `480, 900, 1350, 1800, 350, 400, 105, 120, 144, 270, 405, 540` dans le code TS/TSX/Python (hors tests, hors définitions `PRE_RENTREE_*`) | — | `data/pricing.canonical.json` | **Zéro occurrence.** Aucun montant codé en dur ; toutes les valeurs proviennent de `PRE_RENTREE_FOUNDATIONS`/`PRE_RENTREE_PACKS` (Python) ou de `getRules()`/`getCommercialPublicOffers()` (TS). |
| `"140"` (grille périmée « 3-5/140 ») | `content/pre-rentree-2026/publication-decisions.owner.json:264` | — | **Justifié.** Seule occurrence : dans le texte qui **interdit explicitement** cette grille périmée (`decisions.pricingGrid.supersedes`). Aucune fuite. |

## 3. Seuil d'ouverture (3)

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| `PRE_RENTREE_MIN_COHORT_OPENING = 3` et ses 3 usages (`schema.ts`, `publication-snapshot-schema.ts` ×2) | `lib/campaigns/pre-rentree-2026/schema.ts:11` | — | **OK** : constante unique, importée partout où le seuil apparaît côté TS. Aucun `3` littéral dupliqué trouvé pour `minPerCohort`/`groupMin`/`group_min_open` en dehors. |
| `group_min_open: 3` (×6, dans `pricing.canonical.json`) | `data/pricing.canonical.json` | — | **OK**, c'est la source canonique elle-même. |

## 4. Effectifs « 3 à 6 » / « 3 à 5 » (groupe min/max)

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| 5 occurrences littérales « 3 à 6 élèves »/« 3 à 5 élèves » (couverture, planning, tarifs, dossier accueil, flyer) | `tools/pdf-generator/generate_all_pdfs.py` (lignes ~337, 616, 783, 804, 977-980) | `pricing.canonical.json → pre_rentree_foundations[].group_min_open/group_max`, `pre_rentree_packs[].group_min_open/group_max` | 🟠 **CORRIGÉ.** Remplacées par `FOUNDATIONS_GROUP_MIN/MAX` et `PREMIUM_GROUP_MIN/MAX`, dérivées via un helper `_uniform_group_bounds()` qui **échoue explicitement** (assert) si les offres d'un même tier divergent un jour — au lieu de laisser un texte figé dériver silencieusement d'un futur changement de grille. Commit `bde4de960`. |

## 5. Blocs horaires (09:00, 11:15, 13:30, 15:45)

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| Recherche exhaustive d'horaires codés en dur dans le code de rendu | `components/pre-rentree-2026/`, `lib/campaigns/pre-rentree-2026/`, `tools/pdf-generator/generate_all_pdfs.py` | `campaign.blocks[].startTime/endTime` | **Zéro occurrence.** Tous les horaires transitent par `_BLOCK_TIMES = {b["id"]: (b["startTime"], b["endTime"]) for b in CAMPAIGN["blocks"]}` (Python) ou par les DTO `LandingScheduleSlot`/`LandingScheduleWindow` (TS), jamais recopiés en dur. |

## 6. Salles et rôles enseignants

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| `'salle-1'` / `'salle-2'` comme identifiants | `components/pre-rentree-2026/ScheduleSection.tsx`, `lib/campaigns/pre-rentree-2026/getters.ts` | `campaign.roomRoles` | **Justifié.** Ce sont des identifiants physiques fixes (2 salles au centre Nexus), pas une donnée métier qui varie — comparable à un nom de composant. |
| `{ label: 'Salle 1', details: 'Mathématiques, NSI et Maths expertes' }` / `{ label: 'Salle 2', details: 'Français, Physique-Chimie et SVT' }` — texte écrit à la main juste après une assertion qui vérifie ces mêmes matières dans `campaign.roomRoles` | `lib/campaigns/pre-rentree-2026/getters.ts:202-203` | `campaign.roomRoles['salle-1']`/`['salle-2']` + `campaign.subjects[].label` | 🔴 **BUG RÉEL, CORRIGÉ.** Le texte à la main avait dérivé du libellé canonique : « Maths expertes » (abrégé) au lieu de « Mathématiques expertes » (libellé officiel utilisé partout ailleurs dans l'app). Désormais dérivé dynamiquement de `roomRoles` + labels canoniques ; ne peut plus diverger de l'assertion voisine. Commit `95ac58163`. |
| Identifiants de rôles enseignants (`TEACHER_A_MATHS_NSI`, etc.) hors schéma | — | `data/campaigns/pre-rentree-2026.json → teacherRoles` | **Zéro occurrence** en dehors de `schema.ts`/`content-schema.ts` (cohérent avec la garde-fou d'anonymat : aucun rôle n'est jamais référencé par nom dans le rendu). |

## 7. Listes de matières/niveaux dans le front

| Occurrence | Fichier | Source canonique | Action |
|---|---|---|---|
| `LEVEL_RANGE: Record<EntryLevelCode, 'FONDATIONS' \| 'PREMIUM'>` | `components/pre-rentree-2026/StagePlanningSelector.tsx` | `content/pre-rentree-2026/offers.json → levels[].range` | **Toléré, non corrigé.** Duplique techniquement `offer.range`, mais c'est une constante structurelle (4 niveaux → 2 tiers, invariant depuis la conception de l'offre) utilisée uniquement pour indexer `capacityByOffer`. Le remplacer nécessiterait de faire remonter `range` par niveau dans le DTO `levels` — refactor non trivial pour un gain de robustesse marginal (protégé indirectement par `full-coherence.test.ts` § tarifs/salles). Signalé pour une prochaine itération si `offers.json` gagne un niveau/tier. |
| `HOURS_PER_SUBJECT = 10` | `components/pre-rentree-2026/StagePlanningSelector.tsx` | `pricing.canonical.json → hours_per_subject` (via `pack.totalHours`) | 🔴 **BUG POTENTIEL, CORRIGÉ.** Dupliquait un fait métier (10 h/matière) en constante locale au lieu de lire `pack.totalHours`, déjà résolu et disponible. Toute évolution de `hours_per_subject` serait restée invisible dans le sélecteur. Commit `95ac58163`. |
| Enums Zod fermés (`z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'SVT', 'MATHS_EXPERTES'])`, répétés dans `schema.ts`, `content-schema.ts`, `commercial-contract.ts`) et tableaux d'ordre d'affichage (`subjectOrder` dans `getters.ts`, `SUBJECT_IDS` dans `bilan-prefill.ts`) | plusieurs fichiers | — | **Toléré, documenté comme dette mineure.** Duplication du référentiel fermé des 6 matières, inhérente à la façon dont Zod construit ses schémas (pas d'import direct d'un tuple runtime dans plusieurs `z.enum()` sans réécriture non triviale des schémas). Protégé en pratique par le garde-fou permanent anti-régression (`__tests__/components/pre-rentree-2026-planning-selector.test.tsx`) qui échouerait si une matière apparaissait hors de la liste fermée dans une des surfaces. Pas d'action : le risque réel de divergence silencieuse est déjà couvert par un test, contrairement aux 3 cas corrigés ci-dessus qui n'avaient aucun filet. |

---

## Résumé

| Catégorie | Occurrences trouvées | Bugs réels corrigés | Justifiées / tolérées |
|---|---:|---:|---:|
| Dates | 6 | 1 (texte contradictoire) | 5 |
| Tarifs | 2 | 0 | 2 |
| Seuil d'ouverture | — | 0 | déjà centralisé |
| Effectifs (3 à 6 / 3 à 5) | 5 | 5 (dérivées) | 0 |
| Blocs horaires | 0 | — | déjà centralisé |
| Salles / rôles | 2 | 1 (texte dérivé + libellé corrigé) | 1 |
| Listes matières/niveaux front | 3 | 1 (HOURS_PER_SUBJECT) | 2 |

**3 bugs réels de hardcoding corrigés** (commits `bde4de960`, `95ac58163`) : texte de dates contradictoire, 5 valeurs d'effectif dérivées avec garde-fou anti-dérive, texte de salle corrigé (au passage : correction d'un libellé « Maths expertes » → « Mathématiques expertes »), volume horaire du sélecteur dérivé du pack canonique. Le reste est soit déjà centralisé, soit une duplication mineure jugée non prioritaire et documentée plutôt que silencieusement ignorée.
