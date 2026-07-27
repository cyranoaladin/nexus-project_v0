# Rapport d'optimisation du planning — scénarios S0 à S5

Compagnon de `SCHEDULE-UX-AUDIT.md`. Ce rapport documente les scénarios de refonte du **planning
canonique lui-même** (dates, blocs, salles, cohortes). **S5 est implémenté dans la grille
canonique** (`data/campaigns/pre-rentree-2026.json`) depuis cette mission — voir
`SCHEDULE-S5-THREE-ROOMS-DECISION.md` pour la décision propriétaire qui l'autorise et
`SCHEDULE-S5-IMPLEMENTATION-REPORT.md` pour le détail de l'implémentation. S1 à S4 restent des
scénarios documentés à titre historique (§7bis) : S3 est désormais un repli obsolète, dominé par
S5 sur la date de fin (28 août au lieu de 31) et le coût en heures (+30 h au lieu de +40 h).

Tous les fichiers de données de ce rapport sont dans
`assets/campaigns/pre-rentree-2026/schedule-optimization/` : `baseline.json`, `scenario-s{1,2,3,4,5}.json`,
`s0-s1-solver-output.json`, `scenario-s3-verification.json`, `scenario-s5-verification.json`,
`scenario-s5-solver-output.json`, `scenario-s5-premiere-solver-output.json`, `selection-matrix.csv`,
`teacher-load.csv`, `room-occupancy.csv`, `student-itineraries.csv` (S0-S4) et leurs équivalents
`*-s5.csv` plus `cohort-assignment-s5.csv` (S5), ainsi que les scripts `solver.py`,
`verify_s3_reference.py`, `solver_s5.py`, `solver_s5_premiere.py` (preuve du minimum de cohortes)
et `export_s5.py` (export des CSV/JSON S5 depuis la grille canonique réelle) qui les ont produits
(ré-exécutables, déterministes).

## S0 — planning actuel (baseline)

| Fenêtre | Simultané | Long-idle | Attente totale |
|---|---:|---:|---:|
| fenêtre-1 (17-21 août) | 0 | 2 | 390 min |
| week-end+début fenêtre-2 (22-26 août) | 0 | 0 | 0 min |
| fenêtre-2 (24-28 août, Terminale) | 1 | 4 | 915 min |

## S1 — permutations uniquement (mêmes dates, mêmes matières, une cohorte, mêmes salles/rôles)

Recherche **exhaustive** (`solver.py`), pas heuristique : toutes les affectations
(bloc, salle) respectant la non-simultanéité d'un même enseignant ont été énumérées et notées
lexicographiquement (simultanéités, puis paires longues, puis minutes totales).

| Fenêtre | Candidats testés | Optimum trouvé |
|---|---:|---|
| fenêtre-1 | 9 216 | 0 simultané, **1** long-idle (195 min), au lieu de 2 (390 min) |
| week-end+début fenêtre-2 | 56 | déjà optimal (0, 0, 0) |
| fenêtre-2 (Terminale) | 3 840 | **identique à la baseline** : (1, 4, 915) |

**Conclusions prouvées, pas supposées :**

- **La 3e est améliorable** par pure permutation : en plaçant Mathématiques en bloc A et Français
  en bloc B (au lieu de C), l'attente 3e passe de 195 à 15 minutes, sans toucher aux autres niveaux
  ni aux enseignants. C'est exactement la permutation suggérée à titre d'exemple par la mission
  (§12) — le solveur confirme qu'elle fait bien partie de l'optimum, et qu'aucune permutation ne
  fait mieux que 1 paire longue restante (Première Mathématiques+NSI, 195 min, incompressible sans
  cohorte supplémentaire : avec Français+Maths+NSI sur 3 blocs parmi 4 partagés avec 2 autres
  niveaux sur le même enseignant, ce compromis est mathématiquement le plancher).
- **La Terminale n'est PAS améliorable par permutation seule** : l'optimum S1 trouvé est
  identique à la baseline. Ceci confirme par la preuve (recherche exhaustive sur 3 840 candidats,
  pas seulement l'argument de dénombrement) que 5 matières sur 4 blocs avec une seule cohorte
  chacune imposent nécessairement au moins une simultanéité (argument des tiroirs : 5 objets, 4
  blocs) — exactement la prédiction de la mission, désormais démontrée plutôt qu'affirmée.

## S2 — cohortes alternatives, dates inchangées

**Verdict : INFEASIBLE_WITHOUT_WINDOW_RESTRUCTURING** (voir `scenario-s2.json`).

Ajouter les 3 cohortes Terminale nécessaires (NSI, Physique-Chimie, SVT en double) tient
arithmétiquement dans la fenêtre actuelle 24-28 août (8 entrées pour 8 créneaux = 4 blocs × 2
salles, vérifié). **Mais** la fenêtre « week-end et début fenêtre-2 » (22-26 août, Première
Physique-Chimie) et la fenêtre Terminale (24-28 août) **se chevauchent sur 3 jours (24, 25, 26
août)** et partagent le rôle `TEACHER_D_PHYSIQUE_CHIMIE`. Sur ces 3 jours communs, ce professeur
devrait être simultanément en Première Physique-Chimie (bloc B) et en Terminale Physique-Chimie
cohorte 2 (bloc B également) — **conflit enseignant réel**, découvert par vérification et non par
supposition. Une cohorte alternative ne peut donc pas être ajoutée à dates strictement inchangées
sans déplacer au moins une des deux fenêtres — ce qui est exactement ce que fait S3.

## S3 — restructuration des fenêtres + extension au 31 août (scénario de référence de la mission)

Le scénario donné en exemple par la mission (fenêtres non chevauchantes, fin au 31 août, +4
cohortes) a été **vérifié indépendamment** — jamais accepté comme acquis — via
`verify_s3_reference.py` :

- **0 conflit de salle, 0 conflit d'enseignant** sur les 3 fenêtres reconstituées.
- **12/12 combinaisons de matières testées** (Première fenêtre 1, Première Français vs Maths sur
  fenêtres différentes, et les 10 combinaisons Terminale de la mission) confirmées `COMPACT` ou
  `NO_SHARED_DAY` — **aucune attente supérieure à 60 minutes**, avec le choix de cohorte exact
  donné par la mission pour chaque combinaison.
- **Charges enseignant recalculées et conformes** aux valeurs annoncées : fenêtre 1
  Maths/NSI 8 h, Français 4 h ; fenêtre 2 Français 4 h, PC 2 h, SVT 2 h ; fenêtre 3 Maths/NSI 8 h,
  PC 4 h, SVT 4 h.

**Deux erreurs de transcription ont été trouvées et corrigées dans le script de vérification
lui-même** en cours de route (Première Français laissée par erreur dans la fenêtre 1 au lieu
d'être déplacée en fenêtre 2 ; deux paires Terminale testées avec la mauvaise cohorte) — corrigées
et documentées dans `verify_s3_reference.py`, pas silencieusement ignorées. Une fois ces erreurs de
*ma* transcription corrigées, le scénario de la mission s'est révélé **exact et cohérent** sur
tous les points vérifiés.

**Coût de ce scénario** : fin de campagne 28 → 31 août (+3 jours), +4 cohortes, +40 h
d'enseignement au total, 0 salle ni enseignant supplémentaire. Ce changement de date **change le
planning canonique et requiert une décision propriétaire explicite** avant toute implémentation
(voir §7).

## S4 — fin de campagne maintenue au 28 août

**Verdict : NOT_FULLY_SOLVED_THIS_SESSION** (voir `scenario-s4.json`).

Le blocage identifié en S2 (chevauchement `TEACHER_D_PHYSIQUE_CHIMIE` sur 24-26 août) réapparaît à
l'identique si la date de fin ne peut pas bouger : sans déplacer les fenêtres dans le temps, la
seule façon de lever ce conflit est une salle physique supplémentaire (pour dédoubler un bloc) ou
un second enseignant sur les rôles en tension (`TEACHER_D_PHYSIQUE_CHIMIE`, potentiellement
`TEACHER_A_MATHS_NSI` aux heures de pointe). Une quantification précise de cette ressource
minimale n'a pas été chiffrée dans cette session (le chantier S3 apporte déjà une solution
complète sans ressource nouvelle, seulement un décalage de date) — recommandé comme prochaine
étape si le propriétaire écarte explicitement l'option des 3 jours supplémentaires.

## S5 — 3 salles + week-end, fin maintenue au 28 août (implémenté)

Scénario autorisé par la direction (décision propriétaire — voir
`SCHEDULE-S5-THREE-ROOMS-DECISION.md`) : `salle-3` (Terminale, bloc C uniquement, 24-28 août) plus
les cours samedi 22 et dimanche 23 août déjà présents dans `weekend-debut-fenetre-2`. Recherche
**exhaustive** (`solver_s5.py` pour la Terminale, `solver_s5_premiere.py` pour la Première),
jamais heuristique.

**Terminale — minimum de cohortes prouvé :**

| Cohortes dupliquées | Candidats testés | Conforme (0 simultané, 0 attente >60 min) |
|---|---:|---|
| 0 (baseline S5, sans dédoublement) | 7 920 | Non — 1 simultané, 4 paires longues, 915 min |
| 1 (NSI seule, PC seule, ou SVT seule) | 11 520 – 27 072 selon la matière | Non, dans les 3 cas |
| **2 — {NSI, SVT}, {NSI, PC} ou {PC, SVT}** | 31 104 – 69 120 selon la paire | **Oui, les 3 paires** |
| 3 (NSI + PC + SVT) | 55 296 | Oui (mais non minimal) |

Le minimum prouvé est **2 cohortes supplémentaires** pour la Terminale ; 3 paires atteignent ce
minimum à égalité. La grille canonique retient **{NSI, SVT}** (une des 3 solutions prouvées
optimales, pas un choix arbitraire non vérifié) : NSI et SVT gardent leur cohorte primaire au bloc
C (salles 1 et 3) et ajoutent une cohorte au bloc D (salles 1 et 2) ; Physique-Chimie reste à
cohorte unique, bloc C salle 2. `salle3BlocksUsed = 1` dans les 3 solutions optimales : la 3e salle
n'est jamais nécessaire à plus d'un bloc, conformément à la décision propriétaire.

**Première — SVT :** sans cohorte alternative, le meilleur score atteignable est `(0 simultané, 1
paire longue, 195 min)` — non conforme. Avec 2 cohortes SVT (bloc A et bloc D, fenêtre 1), le score
optimal est `(0, 0, 0)` — entièrement conforme. La duplication de la Première SVT est donc **prouvée
nécessaire et suffisante**, pas une précaution.

**13 combinaisons requises, toutes vérifiées `COMPACT` (max 60 min, jamais `SIMULTANEOUS`)** avec
l'affectation retenue — y compris les 3 combinaisons « Mathématiques complémentaires » qui
réutilisent le créneau `MATHEMATIQUES` de la spécialité (un écart pédagogique distinct est
consigné séparément, voir `DEBT-PRE2026-PEDAGOGY-MATHS-COMPLEMENTAIRES` dans
`residual-debt.fr.json` — jamais maquillé en problème de planning).

**Coût total S5 vs S3 :** fin de campagne maintenue au 28 août (S3 : 31 août, +3 jours), +3
cohortes / +30 h d'enseignement (S3 : +4 cohortes / +40 h), 0 enseignant supplémentaire, 1 salle
temporaire (`salle-3`, bloc C uniquement). **S5 domine S3** sur les deux axes que la direction a
identifiés comme prioritaires (date de fin, volume d'heures supplémentaires) : S3 devient un
scénario de repli historique, non appliqué.

## 7. Décision propriétaire — historique S1/S3/S4 (S5 tranche le sujet)

Cette section documente l'état de la décision **avant** l'autorisation S5 (§ précédente), conservée
pour traçabilité :

- **S1 (3e améliorable, permutation gratuite)** — son bénéfice (3e Mathématiques+Français, 195 →
  15 min) est intégré dans la grille S5 implémentée.
- **S3 (+3 jours, +4 cohortes, +40 h)** — vérifié conforme mais dominé par S5 sur la date de fin et
  le coût ; devient un repli historique, non appliqué.
- **S4 (ressources supplémentaires, 28 août maintenu)** — sans solution chiffrée dans la mission
  précédente ; S5 est la quantification demandée (3ᵉ salle + week-end, 2 cohortes Terminale + 1
  cohorte Première).

## 8. Modèle de données — cohortes (additif, implémenté par S5)

`ScheduledSlot` (schema.ts, `pre_rentree_data.py`) porte désormais `cohortId`/`alternativeGroupId`/
`isPrimary` de façon additive : une entrée sans `cohortId` reste lisible comme cohorte unique (
Mathématiques, Maths expertes, Physique-Chimie, Français, NSI/SVT hors Terminale/Première SVT).
17 cohortes opérationnelles existent pour 14 modules pédagogiques uniques (3 matières à 2
cohortes : Première SVT, Terminale NSI, Terminale SVT) = 85 séances calendrier au total
(17 × 5) — mais toujours 5 séances / 10 h suivies par un élève pour une matière donnée, jamais 10
(voir `assignItinerary()` dans `itinerary.ts` / `assign_itinerary()` dans `itinerary.py`, qui
choisit une seule cohorte par matière et ne les combine jamais). Le statut
`REQUIRES_ALTERNATIVE_COHORT` du moteur d'itinéraire reste réservé/inatteignable : l'affectation
automatique choisit déjà la meilleure cohorte, elle n'a jamais besoin de signaler qu'un changement
serait utile.
