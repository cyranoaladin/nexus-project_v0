# À faire après la livraison

Deux points, et aucun ne doit entrer dans la release candidate.

## Brancher `mode_evaluations_ponctuelles` dans la sélection

Le candidat individuel choisit, à son inscription en première, de présenter ses
évaluations ponctuelles **en fin de chaque année** ou **à la fin du cycle terminal**. Ce
choix est définitif, et il commande la version des instruments adossés au contrôle continu :
`1RE` puis `TLE` pour la modalité annuelle, `ETENDUE` pour la fin de cycle.

Le dépôt lie aujourd'hui `TC-ES/1RE` au profil P1, `TLE` à P2 et `ETENDUE` à P3. C'est le
cas le plus fréquent, et c'est faux en général : un candidat de première peut avoir choisi
l'une ou l'autre modalité.

La variable et sa règle sont portées par `referentiels/modalites_epreuves.json` →
`evaluations_ponctuelles.modalites_de_passation`. Ce qui reste à faire :

1. ajouter `mode_evaluations_ponctuelles` aux variables du questionnaire de parcours ;
2. lire cette variable dans `maquette_donnees._instruments_du_profil` pour choisir la
   version de `TC-ES`, au lieu de la déduire du profil ;
3. rejouer l'instantané de non-régression — les jeux de référence devront déclarer leur
   modalité, et les mesures ne doivent pas bouger pour ceux dont la modalité correspond à
   ce que le profil impliquait.

Ce n'est pas un correctif de mise en page : cela touche la dérivation des instruments, donc
ce que chaque candidat reçoit. Le faire la veille d'une diffusion serait imprudent.

## Déplacer les jeux de test hors de `instruments/`

`instruments/` contient aujourd'hui, à côté des seize instruments métier :

- `_FIXTURE/` — instrument fictif sur lequel les contrôles s'éprouvent ;
- `_MAQUETTE/`, `_MAQUETTE_P1/`, `_MAQUETTE_P2/`,
  `_MAQUETTE_P1_2026_2027_SPECIFIQUES/` — jeux de données fictifs du moteur de bilan.

Ce ne sont pas des instruments. Leur place serait `tests/fixtures/` et `tests/maquettes/`.

**Pourquoi ce n'est pas fait maintenant.** Les chemins sont écrits dans une quinzaine de
scripts et de tests — `scripts/mesures.py` (`JEUX`), `scripts/maquette_bilan.py`,
`scripts/bilan.py`, `scripts/preuve_registre.py`, `scripts/etat_depot.py`,
`scripts/diffusabilite.py` (`dossiers()` filtre les dossiers préfixés d'un souligné), et
les tests qui s'y adossent. Les déplacer la veille d'une diffusion, c'est risquer de
casser la chaîne qui produit les sujets pour un gain qui n'est pas visible du destinataire.

**Comment le faire.** Un commit séparé, après diffusion :

1. déplacer les dossiers ;
2. remplacer le filtre par préfixe de `diffusabilite.dossiers()` par une lecture du
   catalogue — c'est la correction de fond : le dispositif est la liste du catalogue, pas
   « tout ce qui ne commence pas par un souligné » ;
3. rejouer la suite complète et l'instantané de non-régression, qui doit rester identique.

Aucun contenu disciplinaire n'est touché par ce déplacement.
