# _MAQUETTE_P1_2026_2027_SPECIFIQUES — quatrième jeu fictif, P1 opérationnel

**Ces données sont fictives.** Aucune passation n'a eu lieu, aucun élément nominatif n'y figure ;
le candidat est désigné par le code `CL-2026-0004`, réservé aux jeux d'essai.

## Ce que ce jeu est

Le **P1 opérationnel** du dispositif : un candidat entré en première en septembre 2026, qui
présentera les épreuves anticipées en juin 2027 **par anticipation**, au titre de la **session
finale 2028**. Le jeu `_MAQUETTE_P1` relève de la cohorte précédente et reste au dépôt comme jeu
de non-régression réglementaire.

Trois axes, et ils ne se déduisent pas l'un de l'autre :

| Axe | Valeur | Ce qu'il commande |
|---|---|---|
| `session_baccalaureat_finale` | 2028 | le programme d'œuvres du français — assemblages `*_2028` |
| `annee_scolaire_passation_ea` | 2026-2027 | le programme de mathématiques évalué par MATH-EA |
| `mode_passation_ea` | anticipation | l'article 3 ne s'applique pas : aucun gate d'éligibilité |

## Ce qu'il éprouve, et que rien d'autre n'éprouvait

| Fait | Conséquence exercée |
|---|---|
| **Aucune spécialité mathématiques** (PC, SVT, SES) | le parcours mathématique dérivé est « specifiques » |
| Parcours « specifiques » | l'assemblage passé est **MATH-EA/SPECIFIQUES**, jamais employé par un jeu jusqu'ici |
| Pas d'EDS-MATH | le groupe de planification **MATHEMATIQUES est ouvert par le seul MATH-EA** et reste autonome |
| Session finale 2028 | le français est évalué sur **FR-EAF/standard_2028** — objet d'étude du roman renouvelé |
| Le § 8.2 n'ordonne pas ce groupe | **EC-31** : le motif est corrigé, le rang reste à arbitrer par la direction |

## Ce qu'il ne fait pas

Il ne rejoue pas toutes les règles du § 8.2 — c'est l'objet du jeu P3 — et il ne traverse ni la
philosophie ni le Grand oral, que la matrice du § 3.2 n'ouvre pas à un P1.

| Fichier | Contenu |
|---|---|
| `specification.json` | La commande : neuf attendus vérifiables, parts par compétence, auto-positionnement, grille coach |
| `qp.json`, `met.json` | Réponses aux deux questionnaires |
| `saisie.csv`, `grilles.csv` | Produits par `scripts/maquette_donnees.py instruments/_MAQUETTE_P1_2026_2027_SPECIFIQUES` |
| `bilan_P1_CL-2026-0004.md` | Bilan de sortie, produit par `scripts/bilan.py instruments/_MAQUETTE_P1_2026_2027_SPECIFIQUES` |
