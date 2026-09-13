# Migration vers le dépôt public `nexus-project_v0`

Le projet BILAN_DIAGNOSTIC_CL vivait dans un dépôt Git local privé
(`~/Téléchargements/BILAN_DIAGNOSTIC_CL`, branche `diagnostic/instruments`). Il est importé
à plat dans `docs/BILAN_DIAGNOSTIC_CL/` du dépôt public, sans sous-module ni subtree.
L'historique local reste consultable dans la copie mise en quarantaine hors du dépôt.

```text
OLD_REPOSITORY=~/Téléchargements/BILAN_DIAGNOSTIC_CL
OLD_BRANCH=diagnostic/instruments
OLD_NESTED_HEAD=9b7a3d0cd89e2733872ef4aec4fb71ebc61c8b78
OLD_TRACKED_FILES=321
NEW_WORKDIR=docs/BILAN_DIAGNOSTIC_CL
PUBLIC_REPOSITORY=https://github.com/cyranoaladin/nexus-project_v0
PUBLIC_BRANCH=feat/diagnostics-v2-audit
```

## Derniers couples source / release connus dans l'ancien dépôt

Chaque livraison suivait deux commits : A (sources, tests, documentation) puis B
(`release/diagnostics-v2/` seule, `MANIFESTE_V2.source_git_head` = A).

| Source A | Release B | Objet |
|---|---|---|
| `22bb539` | `e2df4ed` | HG Terminale autonome, Grand oral 42 min, personnalisation, exports déterministes |
| `3debd58` | `61cfd60` | dossier d'entrée nominatif rappelant la situation connue |
| `00b2864` | `114e075` | règle de calculatrice dérivée par livret, bordereau famille sommé |
| `005ccd6` | `c454ac4` | blocs de code composés ligne à ligne |
| `0d69547` | `9b7a3d0` | PHI-T-REP-04 : attribution à Plaute, reprise par Hobbes |

La même gouvernance se poursuit dans le dépôt public : un commit source, puis un commit
de release limité à `docs/BILAN_DIAGNOSTIC_CL/release/diagnostics-v2/`.

## Ce qui change à l'import

- **Données personnelles.** Aucune identité réelle n'entre dans Git : les exemples de
  tests et de documentation utilisent la fixture `Camille TEST` / `CL-TEST-0001`.
  `exports_candidats/` (packs nominatifs dérivés) reste ignoré.
- **Source interne FR-POS.** Le PDF de conception de l'enseignante est exclu du dépôt
  public ; ses métadonnées (SHA256, taille, pages) sont publiées dans
  `sources_internes/francais/FR-POS/README.md` et vérifiées par le test de reproductibilité,
  qui contrôle l'empreinte exacte quand le fichier est présent localement.
- **Rendus reconstructibles.** `instruments/*/build/` n'est pas versionné : ces rendus sont
  déterministes et `scripts/rendus_instruments.py` (appelé par `tests/conftest.py`) les
  reconstruit dans un clone propre avant les tests. `MANIFESTE_DEPOT.json` en porte les
  empreintes. `build/controle-diffusion/` est un banc jetable écrit par
  `scripts/distribution.py`.
- **Tableaux CSV.** Le dépôt parent ignore `*.csv` ; le `.gitignore` du projet les réinclut,
  ce sont des index versionnés.
- **Provenance.** Le test de provenance ramène les chemins du diff Git au sous-dossier du
  projet (`git rev-parse --show-prefix`).

La classification fichier par fichier de l'ancien dépôt est dans
`MIGRATION_FILE_CLASSIFICATION.json` ; les inventaires d'audit sont produits par
`scripts/audit_inventory.py`.
