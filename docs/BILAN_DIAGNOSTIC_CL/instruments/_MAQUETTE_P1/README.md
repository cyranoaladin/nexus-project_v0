# _MAQUETTE_P1 — troisième jeu de données fictif, profil P1 (cohorte historique)

**Ces données sont fictives.** Aucune passation n'a eu lieu, aucun élément nominatif n'y figure ;
le candidat est désigné par le code `CL-2026-0003`, réservé aux jeux d'essai.

**Cohorte 2025-2026, conservée pour la non-régression.** Ce jeu n'est plus le P1 opérationnel :
depuis le 2026-09-11, celui-ci est `_MAQUETTE_P1_2026_2027_SPECIFIQUES` — entrée en première en
septembre 2026, épreuves anticipées en juin 2027, session finale 2028. Il reste au dépôt parce
qu'il est le seul jeu dont l'année de passation est 2025-2026 : lui seul oppose le programme de
mathématiques antérieur et sa note transitoire d'automatismes, et lui seul démontre que les
mesures d'un contexte réglementaire donné ne bougent pas quand un autre contexte est créé.

Ce jeu couvre ce qu'aucun autre n'atteignait : la règle de priorité que le § 8.2 réserve au
profil **P1** — « français d'abord si FR-EAF < 55 %, sinon spécialité la plus fragile ». Elle
était déclarée au référentiel et jamais exercée ; la question Q-23 portait donc sur une
couverture manquante, non sur un arbitrage à rendre.

## Profil retenu

**P1 en configuration « les_deux »** : un candidat de première qui prépare les deux épreuves
anticipées de français, avec trois spécialités en version N1. Les valeurs sont choisies pour
exercer trois branches à la fois :

| Branche exercée | Comment |
|---|---|
| Français avant les spécialités | FR-EAF sous le seuil du niveau En consolidation |
| Remise à niveau d'une spécialité | EDS-SVT, taux de prérequis sous 40 % |
| Départage de deux spécialités | EDS-MATH et EDS-PC, même gravité et scores voisins |

| Fichier | Contenu |
|---|---|
| `specification.json` | La commande : attendus vérifiables, cibles exactes par groupe, auto-positionnement, grille coach |
| `qp.json`, `met.json` | Réponses aux deux questionnaires |
| `saisie.csv`, `grilles.csv` | Produits par `scripts/maquette_donnees.py instruments/_MAQUETTE_P1` |
| `bilan_P1_CL-2026-0003.md` | Bilan de sortie, produit par `scripts/bilan.py instruments/_MAQUETTE_P1` |

Ni philosophie ni Grand oral : la matrice du § 3.2 ne les ouvre pas à ce profil.
