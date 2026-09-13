# _MAQUETTE_P2 — second jeu de données fictif, configuration « oral »

**Ces données sont fictives.** Aucune passation n'a eu lieu, aucun élément nominatif n'y figure ;
le candidat est désigné par le code `CL-2026-0002`, réservé aux jeux d'essai.

Ce jeu ne cherche pas à exercer chaque règle du § 8.2 — c'est l'objet du jeu P3 de
`instruments/_MAQUETTE/`. Il répond à la demande d'un **bilan court sur une configuration
« oral »** : vérifier que le document se titre et se structure correctement quand la partie
française ne porte que l'oral.

## Profil retenu

**P2 en configuration « oral »** : un candidat de Terminale qui a validé la première partie du
baccalauréat mais doit repasser l'épreuve orale anticipée de français. C'est le cas qui montre
que la configuration française est orthogonale au profil (Q-19) : le profil P2 n'ouvre pas
FR-EAF, la configuration l'ouvre.

| Fichier | Contenu |
|---|---|
| `specification.json` | La commande : attendus vérifiables, cibles par compétence, auto-positionnement, grilles coach |
| `qp.json`, `met.json` | Réponses aux deux questionnaires |
| `saisie.csv`, `grilles.csv` | Produits par `scripts/maquette_donnees.py instruments/_MAQUETTE_P2` |
| `bilan_P2_CL-2026-0002.md` | Bilan de sortie, produit par `scripts/bilan.py instruments/_MAQUETTE_P2` |

## Ce que ce jeu a fait apparaître

- **Deux périmètres de français.** FR-MAI est sélectionné par le profil P2, FR-EAF/oral par la
  configuration : ce candidat passe les deux et le plan lui propose 2 h de chacun. Point porté à
  l'arbitrage (Q-22 du `README_ETAT.md`).
- **Le titre du périmètre FR-EAF annonçait « écrit et oral »** à un candidat qui ne repasse que
  l'oral. Le référentiel porte désormais un intitulé par version ; le bilan prend celui de la
  version passée.
