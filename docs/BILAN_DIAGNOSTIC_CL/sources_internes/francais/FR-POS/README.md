# FR-POS — source interne de conception

```text
PRIVATE_SOURCE_NOT_IN_PUBLIC_REPO=YES
EXPECTED_FILE=Test_positionnement_source_enseignante.pdf
EXPECTED_SHA256=f1b56017e48b9a4793bcd800d4fdf1ce4ff171747960853f23448cebc4173687
EXPECTED_SIZE=345948
EXPECTED_PAGES=7
PROVENANCE=document de conception interne Nexus Réussite, rédigé par une enseignante de français (2026)
```

Le PDF original est un document de travail d'enseignante : il n'est pas publiable et
n'entre pas dans le dépôt public (exclu par `.gitignore`). Il est conservé localement chez
Nexus, dans ce dossier, sous le nom attendu ci-dessus.

Ce que le dépôt public conserve et qui suffit à auditer l'instrument :

- ses métadonnées, ci-dessus et dans `referentiels/textes_sources.json`
  (`textes.fr_pos_adolescents` : empreinte SHA256, taille, nombre de pages, chemin) ;
- la banque publiable `instruments/FR-POS/banque.json`, seule source de l'instrument
  composé, et son assemblage `instruments/FR-POS/assemblages/` ;
- le livret canonique `release/diagnostics-v2/01_LIVRETS_CANDIDAT/00_COMMUN/POSITIONNEMENT_FRANCAIS.pdf`.

Le test `tests/test_tronc_commun_et_positionnement.py::test_fr_pos_source_interne_reproductible`
vérifie l'empreinte exacte du PDF quand il est présent localement et, sinon, la cohérence
des métadonnées attendues entre ce README et le référentiel des textes sources.
