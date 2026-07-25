# Rapport d'optimisation du planning — scénarios S0 à S4

Compagnon de `SCHEDULE-UX-AUDIT.md`. Ce rapport documente les scénarios de refonte du **planning
canonique lui-même** (dates, blocs, salles, cohortes) — aucun n'a été appliqué aux données
canoniques : la mission exige une décision propriétaire explicite avant toute modification de ce
type (voir §7).

Tous les fichiers de données de ce rapport sont dans
`assets/campaigns/pre-rentree-2026/schedule-optimization/` : `baseline.json`, `scenario-s{1,2,3,4}.json`,
`s0-s1-solver-output.json`, `scenario-s3-verification.json`, `selection-matrix.csv`,
`teacher-load.csv`, `room-occupancy.csv`, `student-itineraries.csv`, ainsi que les scripts
`solver.py` et `verify_s3_reference.py` qui les ont produits (ré-exécutables, déterministes).

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

## 7. Décision propriétaire requise

Aucun scénario au-delà de S0/S1 (qui ne change ni dates ni ressources ni cohortes) n'a été
appliqué aux données canoniques. Pour aller plus loin :

- **S1 (3e améliorable, permutation gratuite)** peut être appliqué sans aucun coût nouveau — mais
  reste un changement du planning canonique publié et affiché aux familles, donc soumis à la même
  règle de décision propriétaire que tout changement de grille.
- **S3 (solution complète, +3 jours, +4 cohortes, +40 h)** est vérifiée conforme mais change la
  date de fin de campagne — décision propriétaire obligatoire, non prise dans cette mission.
- **S4 (ressources supplémentaires, 28 août maintenu)** n'a pas de solution chiffrée dans cette
  session.

## 8. Modèle de données — cohortes (additif, pas encore peuplé)

`ScheduledSlot`/`LevelDossierData` dans `pre_rentree_data.py` restent à une seule cohorte par
(niveau, matière), fidèle à la grille canonique actuelle. Les champs `cohortId`,
`alternativeGroupId`, etc. mentionnés par la mission n'ont pas été ajoutés à la grille de
production dans cette session : aucun scénario ci-dessus n'a été autorisé pour implémentation, donc
aucune cohorte alternative n'existe réellement à modéliser. Le statut `REQUIRES_ALTERNATIVE_COHORT`
du moteur d'itinéraire (voir `itinerary.ts`) reste réservé pour le jour où S2/S3 (ou une variante)
sera explicitement autorisé et où des cohortes alternatives existeront réellement dans
`data/campaigns/pre-rentree-2026.json`.
