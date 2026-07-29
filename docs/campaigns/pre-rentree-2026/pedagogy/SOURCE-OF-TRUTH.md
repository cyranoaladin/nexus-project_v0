# Sources de vérité — corpus pédagogique Pré-rentrée 2026

## Date

29 juillet 2026.

## Carte canonique

| Rôle | Source de vérité | Règle |
|---|---|---|
| Catalogue des modules et séances | `content/pre-rentree-2026/modules.json` | 17 identifiants exacts ; aucun module Physique-Chimie Seconde |
| Manifeste pédagogique | `content/pre-rentree-2026/pedagogy/manifest.yaml` | rattachements, hashes, sorties attendues et statut humain |
| CPS de positionnement | `content/pre-rentree-2026/pedagogy/positioning/cps/` | 17 CPS retenues à partir du candidat v3 prouvé |
| Référentiel, spécification et ancres | `content/pre-rentree-2026/pedagogy/positioning/` | sources éditables versionnées |
| Kits de séance | `content/pre-rentree-2026/pedagogy/session-kits/` | 17 index, 85 séances et 340 fichiers unitaires |
| Outils | `scripts/pre-rentree/pedagogy/` | import, validation, génération et reproductibilité |
| Gouvernance | `docs/campaigns/pre-rentree-2026/pedagogy/` | provenance, décisions, conflits et statuts |
| Sorties internes | `.artifacts/pre-rentree-2026/pedagogy/` | reconstructibles, non suivies par Git |

Les prix, offres et règles commerciales restent respectivement dans
`data/pricing.canonical.json`, `content/pre-rentree-2026/offers.json` et
`data/campaigns/pre-rentree-2026.json`. Le lot 1 ne les modifie pas.

## Source historique

`docs/bilans/dossiers_tests_prerentree/` est un dépôt d'import externe,
historique et immuable. Il n'est ni une source d'exécution en production, ni
une destination de génération. Son snapshot comporte 534 fichiers et a pour
empreinte de manifeste trié :

```text
077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005
```

L'inventaire et les décisions machine-lisibles sont reconstruits sous
`.artifacts/pre-rentree-2026/pedagogy/import/`. Aucun chemin absolu de la
machine n'est encodé dans les scripts.

## Décision de canonicalisation

Les 17 CPS du paquet v3 sont retenues parce que trois preuves convergent :
validation structurelle, rapport QA inventorié et diff recalculé. Le diff
v2 vers v3 comporte exactement 9 statuts ajoutés, 153 réordonnancements de
propositions, 100 ajouts `obstacleVise`, une correction de palier et zéro autre
changement. Les copies des 17 CPS dans le paquet des 85 séances sont
byte-à-byte identiques.

Les 17 README de module, le manifeste des séances et les 340 fichiers unitaires
sont retenus comme sources éditables. Les 34 cahiers/guides compilés et les
69 ressources de positionnement reçues sont des sorties générées, soit 103
sorties reconstructibles, et ne sont pas copiés dans `content/`.

## Publication

La racine `.artifacts/` n'est jamais publiable directement. Aucun document
pédagogique n'est copié sous `public/` dans ce lot. Une publication future
exigera au minimum `CLASSROOM_READY`, puis `PUBLICATION_APPROVED`, accordés par
des humains autorisés et traçables.

## Contrôle

```bash
npm run pre-rentree:pedagogy:validate
npm run pre-rentree:pedagogy:verify
git ls-files '.artifacts/pre-rentree-2026/pedagogy/**'
git diff --name-only c6e055fb82216e46aab00f121f7817aed00e62ca -- public/
```

Les deux dernières commandes doivent rester sans sortie.
