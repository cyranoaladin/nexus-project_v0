# Décision propriétaire — S5 : 3ᵉ salle + week-end, fin maintenue au 28 août

Compagnon de `SCHEDULE-OPTIMIZATION-REPORT.md` (§S5) et `SCHEDULE-S5-IMPLEMENTATION-REPORT.md`.
Ce document consigne la décision propriétaire qui autorise le scénario S5 et la fait correspondre,
point par point, à ce qui a réellement été implémenté et prouvé.

## 1. Décision autorisée par la direction

La direction Nexus Réussite autorise pour le planning de pré-rentrée 2026 :

- Les cours le samedi 22 août 2026 et le dimanche 23 août 2026 (déjà structurellement présents
  dans la fenêtre `weekend-debut-fenetre-2`, 22-26 août, depuis la restructuration fenêtres +
  week-end — cette décision **confirme formellement** leur maintien sous le nouvel arrangement S5,
  elle ne les introduit pas).
- Une troisième salle pédagogique temporaire, désignée `salle-3` dans les données.
- La disponibilité de `salle-3` du 24 au 28 août 2026 pendant le bloc C (14:15–16:15) — utilisation
  sur un autre bloc ou une autre date uniquement si le solveur démontrait qu'elle est indispensable
  (ce n'est pas le cas : voir §2, `salle3BlocksUsed = 1` dans les 3 solutions optimales trouvées).
- Une capacité de salle compatible avec le plafond Premium actuel, soit au moins 5 élèves — usage
  de type salle de cours standard, sans promesse de laboratoire.
- La création de cohortes horaires alternatives lorsqu'elle est indispensable, sous réserve de
  preuve (voir §2).
- Le maintien des quatre blocs actuels A, B, C, D ; aucune séance après 18:30 ; aucun enseignant
  supplémentaire ; aucune extension au-delà du 28 août si une solution conforme existe avec ces
  nouvelles ressources.
- Règle non négociable inchangée : `MAX_STUDENT_IDLE_MINUTES = 60`.

Le scénario S3 (fin au 31 août, +4 cohortes, +40 h) devient un scénario de repli historique : il
n'est pas appliqué, une solution conforme finissant le 28 août ayant été prouvée (§2).

## 2. Preuve exigée avant toute écriture dans la grille canonique — apportée

Conformément à l'instruction « n'écris dans la grille canonique qu'après preuve exhaustive », le
solveur (`solver_s5.py`, `solver_s5_premiere.py`, recherche exhaustive, jamais heuristique) a été
exécuté **avant** toute modification de `data/campaigns/pre-rentree-2026.json`, et son résultat
(`scenario-s5-solver-output.json`, `scenario-s5-premiere-solver-output.json`) a ensuite été
recopié à l'identique (bloc/salle/cohorte) dans la grille canonique — jamais l'inverse.

Résumé de la preuve (détail complet dans `SCHEDULE-OPTIMIZATION-REPORT.md` §S5) :

| Question | Réponse prouvée |
|---|---|
| Minimum de cohortes Terminale supplémentaires pour zéro simultanéité et zéro attente >60 min | **2**, exhaustif sur 0/1/2/3 (candidats testés : 7 920 à 69 120 selon le sous-ensemble) |
| Paires atteignant ce minimum | {NSI, SVT}, {NSI, Physique-Chimie}, {Physique-Chimie, SVT} — 3 solutions à égalité |
| Paire retenue dans la grille canonique | {NSI, SVT} — une des 3 solutions prouvées optimales |
| `salle-3` nécessaire à plus d'un bloc ? | Non — `salle3BlocksUsed = 1` dans les 3 solutions optimales |
| Cohorte Première SVT nécessaire ? | Oui, prouvée nécessaire ET suffisante (sans : 195 min d'attente résiduelle ; avec : 0) |
| Combinaisons requises conformes avec la grille retenue | 13/13 (`COMPACT`, max 60 min, jamais `SIMULTANEOUS`) |

## 3. Ce que cette décision n'autorise pas

Repris explicitement de la mission, aucun n'a été franchi :

- Aucun bloc E, aucune séance après 18:30.
- Aucun enseignant supplémentaire (les cohortes ajoutées restent portées par les rôles enseignants
  existants — `TEACHER_A_MATHS_NSI` pour NSI, `TEACHER_E_SVT` pour SVT — jamais un nouveau rôle).
- `salle-3` n'est pas une salle permanente ni un argument marketing : elle reste une ressource
  temporaire scopée au bloc C, 24-28 août, jamais mentionnée comme un avantage pérenne dans les
  supports familles.
- Aucun double comptage : une matière à 2 cohortes reste 1 matière, 5 séances, 10 h, un seul tarif
  pour la famille — jamais 2 matières ni 20 h (voir tests dédiés, §5).
- Aucun changement tarifaire, aucun changement du plafond commercial (`capacityByOffer`).
- Aucun contenu pédagogique inventé pour Mathématiques complémentaires : l'écart entre le module
  Mathématiques actuel (contenu spécialité EDS) et le programme officiel Mathématiques
  complémentaires est documenté comme écart pédagogique distinct
  (`DEBT-PRE2026-PEDAGOGY-MATHS-COMPLEMENTAIRES`, P2, `residual-debt.fr.json`), jamais maquillé en
  problème de planning.
- Aucun changement des portes de publication (`releaseStatus`, `PUBLIC_READY`) — cette mission ne
  déclare pas la campagne publiable, elle documente et implémente une grille prouvée.

## 4. Portée de la décision

Cette décision porte exclusivement sur la structure du planning (salles, blocs, cohortes, dates).
Elle n'emporte ni approbation commerciale, ni approbation juridique, ni levée du statut REVIEW —
ces décisions restent distinctes (voir `DECISIONS-REQUIRED.md`).

**Décidé par :** direction Nexus Réussite.
**Portée :** planning de pré-rentrée 2026 (S5), grille canonique `data/campaigns/pre-rentree-2026.json`.
**Implémentation :** voir `SCHEDULE-S5-IMPLEMENTATION-REPORT.md`.
