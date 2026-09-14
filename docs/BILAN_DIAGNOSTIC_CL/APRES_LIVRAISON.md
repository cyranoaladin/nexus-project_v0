# À faire après la livraison

Un point livré, un point ouvert ; aucun ne doit entrer dans la release candidate sans son propre commit.

## `mode_evaluations_ponctuelles` — livré

Le point est fermé : la variable est lue par `maquette_donnees._instruments_du_profil`, qui
choisit `1RE` (P1), `TLE` ou `ETENDUE` (P2 selon le mode annuel ou de fin de cycle) et
`ETENDUE` (P3) pour TC-HG, TC-EMC et TC-ES ; les faits candidats (`faits_candidat`) portent
le mode et le refusent hors domaine ; `tests/test_espace_candidats.py` vérifie la version
du tronc commun pour chaque situation valide.

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
