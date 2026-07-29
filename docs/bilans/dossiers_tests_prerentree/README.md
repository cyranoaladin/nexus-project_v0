# Import historique — corpus Pré-rentrée 2026

Ce répertoire désigne l'emplacement de l'import historique reçu. Son contenu
n'est pas canonique et ne doit jamais être lu par l'application en production,
modifié par les générateurs ou publié directement.

Dans le worktree d'implémentation, seul ce README racine est une métadonnée
versionnée explicitement autorisée. Le CLI le reconnaît uniquement s'il s'agit
d'un fichier régulier sans lien symbolique, puis l'exclut de l'inventaire, des
hashes et de la classification. Les quatre paquets historiques restent dans
leur emplacement d'origine, inchangés.

## Nouvelles sources de vérité

- sources pédagogiques :
  [`content/pre-rentree-2026/pedagogy/`](../../../content/pre-rentree-2026/pedagogy/) ;
- outils :
  [`scripts/pre-rentree/pedagogy/`](../../../scripts/pre-rentree/pedagogy/) ;
- gouvernance :
  [`docs/campaigns/pre-rentree-2026/pedagogy/`](../../campaigns/pre-rentree-2026/pedagogy/) ;
- sorties internes : `.artifacts/pre-rentree-2026/pedagogy/`.

## Immutabilité

Le snapshot de référence comporte 119 répertoires, 534 fichiers et
4 083 588 octets. Le SHA-256 du manifeste trié est :

```text
077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005
```

Ces nombres couvrent exclusivement les quatre paquets historiques. Le README
racine de redirection n'ajoute ni fichier, ni hash, ni répertoire au snapshot
pédagogique ; les valeurs `119 / 534` et l'empreinte restent donc inchangées.

Ne pas renommer, corriger, supprimer ou générer un fichier dans l'import. Toute
évolution pédagogique doit être portée dans la source canonique, avec revue et
traçabilité.

## Rejouer le contrôle d'import

Depuis un checkout contenant le pipeline canonique :

```bash
PRE_RENTREE_PEDAGOGY_IMPORT_ROOT=/chemin/absolu/vers/dossiers_tests_prerentree \
  npm run pre-rentree:pedagogy:import-check
```

La variable est obligatoire afin de ne jamais encoder un chemin local dans le
dépôt. Le CLI valide la présence exacte des quatre paquets, autorise puis exclut
le seul `README.md` racine, et inventorie uniquement les arbres :

- `Nexus-positionnement/` ;
- `Nexus-positionnement-2026-maths-francais-v2/` ;
- `Nexus-PreRentree-2026-positionnement-17-modules-v3/` ;
- `Nexus-PreRentree-2026-85-seances/`.

Les inventaires sont écrits uniquement sous
`.artifacts/pre-rentree-2026/pedagogy/import/`.
