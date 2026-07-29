# Rapport de déduplication du corpus pédagogique Pré-rentrée 2026

## Date

29 juillet 2026.

## Périmètre et décision

L'analyse porte sur les 534 fichiers réguliers des quatre paquets historiques
inventoriés. Elle ne copie, ne déplace et ne réécrit aucun contenu pédagogique.
Les décisions machine-lisibles et l'inventaire final sont générés uniquement
sous `.artifacts/pre-rentree-2026/pedagogy/import/`.

Le manifeste trié de la source vaut, avant et après analyse :
`077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005`.

## Méthode

Le constructeur `scripts/pre-rentree/pedagogy/build_pedagogy_manifest.py` :

1. relit `INVENTAIRE-IMPORT.json`, ou reconstruit l'inventaire avec l'importeur
   si ce fichier est absent ;
2. reconstruit les métadonnées courantes et réconcilie les ensembles exacts de
   fichiers réguliers, répertoires et liens symboliques avec l'inventaire,
   puis vérifie chaque SHA-256 avant toute décision ;
3. regroupe d'abord par rôle logique et identité stable ;
4. compare d'abord les SHA-256 ;
5. en cas de SHA différent, normalise les YAML/JSON après parsing, les CSV par
   en-têtes, clés et lignes lorsque leur ordre n'est pas sémantique, et le texte
   Markdown par Unicode, fins de ligne et espaces terminaux ;
6. refuse la sélection d'un candidat divergent si la validation structurelle,
   la référence QA et le résumé de diff ne sont pas tous présents ;
7. exécute les générateurs et validateurs retenus uniquement depuis deux copies
   temporaires indépendantes, compare chaque sortie au corpus importé et entre
   les deux exécutions par chemin et SHA-256, puis recalcule le SHA global et le
   digest de l’arbre complet de la source ;
8. attribue exactement une des neuf classes finales à chaque ligne.

Les nombres de groupes et copies ne sont pas des constantes métier : ils sont
recalculés depuis les SHA de l'inventaire à chaque exécution.

## Matrice finale

| Classe | Nombre |
|---|---:|
| `CANONICAL_SOURCE` | 378 |
| `GENERATOR` | 2 |
| `VALIDATOR` | 2 |
| `GENERATED_OUTPUT` | 103 |
| `HISTORICAL_VERSION` | 18 |
| `ARCHIVE_PACKAGE` | 1 |
| `DUPLICATE_IDENTICAL` | 30 |
| `CONFLICT_REVIEW_REQUIRED` | 0 |
| `UNCLASSIFIED` | 0 |
| **Total** | **534** |

`PENDING_DEDUPLICATION` n'est présent dans aucune ligne finale. Les 30
`DUPLICATE_IDENTICAL` comprennent 29 copies excédentaires internes au corpus et
`sources/source-modules.json`, copie normalisée du catalogue déjà versionné
dans `content/pre-rentree-2026/modules.json`.

## Groupes exacts recalculés

Le corpus contient 27 groupes de SHA identiques, soit 29 copies excédentaires :
25 groupes de deux fichiers et 2 groupes de trois fichiers.

| Groupe | SHA-256 | Membres | Fichier de référence pour la décision |
|---|---|---:|---|
| `sha256-001` | `6006f42f23c4532368b708d24789e0fd03e50a47225c5f5dfaf7cbb803b87f4e` | 2 | `Nexus-PreRentree-2026-85-seances/README.md` |
| `sha256-002` | `2396a31357e8eb39fa011556e1cc25968428f3f4839d980d0afb4e476fc42340` | 2 | `Nexus-PreRentree-2026-positionnement-17-modules-v3/RAPPORT-QA-COMPLET-17-MODULES-2026.md` |
| `sha256-003` | `5370a60eedc5348685a9085be2e076824e081175d9e962e994781a0626701746` | 3 | `Nexus-PreRentree-2026-positionnement-17-modules-v3/REFERENTIEL-CANONIQUE-2026.yaml` |
| `sha256-004` | `c94849025e4666c387b0f7081f6ed7bf03baf716d02e8b7021c1e02e3087f923` | 2 | `Nexus-PreRentree-2026-positionnement-17-modules-v3/WORKFLOW-OPERATIONNEL.md` |
| `sha256-005` | `d0cbc12eba633b4e710e9b0f0f18fd3339efdb682bc2939802e1abb5ab7ebd4c` | 2 | `francais-entree-premiere.yaml` v3 |
| `sha256-006` | `688c812a29ddc7a0c52931989ad569c92888e5eda2d89a5a27fbec5d05ab004c` | 2 | `francais-entree-quatrieme.yaml` v3 |
| `sha256-007` | `1a400616f139b471a8d9e7daf0e920dc445abc6502a54925eb1642ff7f43b4a5` | 2 | `francais-entree-seconde.yaml` v3 |
| `sha256-008` | `eb23866c49e64f6af81b12c71dced04f8dd5b2894a97cadae352864e20234b49` | 2 | `francais-entree-troisieme.yaml` v3 |
| `sha256-009` | `5046fc98815058cdfffc08a35f2e01a0fb4d8f956830ed520b44de8466eab56b` | 2 | `maths-entree-premiere.yaml` v3 |
| `sha256-010` | `59f6c280f780258ba3382665f6947bf2e6cf4d350b045cc67b4060d7d021ae7e` | 2 | `maths-entree-quatrieme.yaml` v3 |
| `sha256-011` | `a9034380394aefd0260979cf491fc9c390fd5b5cdefc19da7795f4047d50b552` | 2 | `maths-entree-seconde.yaml` v3 |
| `sha256-012` | `db723beb770084dc1622f2644e0d64630d21b376c67895b54c58b8457ebde16c` | 2 | `maths-entree-terminale.yaml` v3 |
| `sha256-013` | `f2c913c0c7c3262d6e896e75cf0216300e79bb144f8d0804e36bd9336e74d754` | 2 | `maths-entree-troisieme.yaml` v3 |
| `sha256-014` | `406c96ed808ea40195c76906b30ee1c7844c6831acd7045cc4b9d2578e2ac151` | 2 | `maths-expertes-entree-terminale.yaml` v3 |
| `sha256-015` | `db4260b374dc6d4b3388737881282df470d7dcd1534c7723b33e4d68d270bf1e` | 2 | `nsi-entree-premiere.yaml` v3 |
| `sha256-016` | `3597c891ea2679a22db58e599c29727a2cad04a3824e40a3ed9efd598a301928` | 2 | `nsi-entree-terminale.yaml` v3 |
| `sha256-017` | `850fada56b41db592ede7bd8ef4ab2ce9dc72eeb172919bade0d0320e34ee1ec` | 2 | `philosophie-entree-terminale.yaml` v3 |
| `sha256-018` | `845bce6b9de5d3752c42226d7320730a81f1913a796a4fd6f229f0d8245d9adf` | 2 | `physique-chimie-entree-premiere.yaml` v3 |
| `sha256-019` | `fd592175f6ff58e221403322f0e03c11a1c98b512278391225578c8848f91d0b` | 2 | `physique-chimie-entree-terminale.yaml` v3 |
| `sha256-020` | `c485a45d6d5abbd29aa6908dcf4c1fb7e95a1d25a76c260ceaba143d71221a1a` | 2 | `svt-entree-premiere.yaml` v3 |
| `sha256-021` | `815cba0064429cb8e67f7a1914170eae0bb95017ae9ca82431bf14bb0cffff82` | 2 | `svt-entree-terminale.yaml` v3 |
| `sha256-022` | `6711f62a299811d7fadedb84ccd1347577e24154d0c2199086f53fa45f5bdc8d` | 3 | `SPEC-tests-positionnement-pre-stage-2026.md` v3 |
| `sha256-023` | `b4445dd8276921a89ce9df24f906cdb2412af1ed6cebe459dbed3a65ecc6cce4` | 2 | `maths-entree-premiere.yaml` v2 |
| `sha256-024` | `c2a964c582e64355c147977a09deeb36fa9b397d978b120532cef039ec4409bb` | 2 | `maths-entree-quatrieme.yaml` v2 |
| `sha256-025` | `4456a012128fe34349168a2be424c1701ee8901de83decd7a1348c10d27a89af` | 2 | `maths-entree-seconde.yaml` v2 |
| `sha256-026` | `b23a4194e4838aacfe801d1f7dee4ea2f96eb67f717c3ce99a8d55e429708177` | 2 | `maths-entree-terminale.yaml` v2 |
| `sha256-027` | `da3af6bef6b71fea57f72b5bded40f3ef0bf1c19dee965b9ffcff9b1bd8243b0` | 2 | `maths-entree-troisieme.yaml` v2 |

Les groupes `sha256-005` à `sha256-021` prouvent que les 17 CPS embarquées
dans le paquet des 85 séances sont byte-à-byte identiques aux CPS v3.
Les groupes `sha256-023` à `sha256-027` prouvent que les cinq mathématiques v1
et v2 sont identiques entre elles ; cette identité ne les rend pas équivalentes
aux versions v3 corrigées.

## Sélection des CPS v3

Les 17 CPS v3 passent la validation structurelle : 141 nœuds décrits, 136
nœuds évalués, 408 items et 33 réponses à correction manuelle. Elles restent
toutes `HUMAN_VALIDATION_REQUIRED`.

Le rapport QA effectivement inventorié,
`RAPPORT-QA-COMPLET-17-MODULES-2026.md`, a pour SHA-256
`2396a31357e8eb39fa011556e1cc25968428f3f4839d980d0afb4e476fc42340`.
Son appartenance à l'inventaire, son SHA et ses assertions attendues sont
vérifiés avant qu'il puisse servir de preuve.

Le diff réel v2 → v3 est recalculé sur cinq modules mathématiques et quatre
modules français. Les seules transformations observées sont :

- ajout du statut racine sur 9 modules ;
- changement d'ordre des propositions sur 153 items ;
- ajout de `obstacleVise` sur 100 distracteurs ;
- correction unique du palier `n10-i1` de `B/B/C` vers `A/B/C`.

Les changements inattendus : 0. Toute autre transformation ferait basculer le
groupe concerné en `CONFLICT_REVIEW_REQUIRED`.

Le diff n'autorise que les neuf modules v2 inventoriés. Si un module divergent
ne possède pas de preuve calculée, le fallback porte explicitement
`computed: false`, au moins un changement inattendu, et impose
`CONFLICT_REVIEW_REQUIRED`.

Les cinq couples historiques mathématiques v1/v2 divergent donc de v3 pour des
raisons calculées et explicites :

| Preuve | v1/v2 | v3 |
|---|---:|---:|
| Distracteurs sans `obstacleVise` | 100 | 0 |
| Paliers du nœud `n10`, entrée en 3e | `B/B/C` | `A/B/C` |
| Positions des 120 bonnes réponses | A : 120 | A/B/C/D : 30 chacune |
| Statut racine | absent sur 5 | `HUMAN_VALIDATION_REQUIRED` sur 5 |

Les quatre CPS français v2 divergent également de v3. La sélection du candidat
v3 repose sur le même triplet de preuves : validation structurelle PASS,
rapport QA explicite et diff structuré. V1/v2 restent historiques ; aucune
divergence n'est convertie silencieusement en doublon.

## Corpus des séances

Les candidats sources sont :

- 340 fichiers unitaires, soit quatre fichiers pour chacune des 85 séances ;
- 17 `README.md` de modules ;
- un `MANIFESTE-SEANCES.csv`.

Les 34 `CAHIER-ELEVE.md` et `GUIDE-ENSEIGNANT.md` compilés sont
`GENERATED_OUTPUT`, comme les 69 ressources sous `ressources-generees/`.
L'archive ZIP est `ARCHIVE_PACKAGE`.

## Scripts

| Script | Dépendances et entrées | Sorties et effets | Décision |
|---|---|---|---|
| `generate_operational_resources.py` | PyYAML, CSV, référentiel et 17 CPS | 69 ressources ; recrée sa destination | `GENERATOR`, utile à porter |
| `generate_session_kits.py` | PyYAML, JSON, ancres, catalogue, 17 CPS et 4 banques spécifiques | 85 kits, 17 index, 34 compilations, manifeste ; remplace sa destination | `GENERATOR` candidat à porter, `REQUIRES_PATH_ADAPTATION` |
| `validate_cps.py` | PyYAML, référentiel et 17 CPS | diagnostic/code retour, aucun effet | `VALIDATOR`, déterministe |
| `validate_session_kits.py` | JSON/CSV, catalogue et corpus de séances | diagnostic/compteurs/code retour, aucun effet | `VALIDATOR` candidat à porter, `REQUIRES_PATH_ADAPTATION` |
| `repair_math_cps.py` | 5 CPS et table de 100 décisions | mutation YAML en place | `HISTORICAL_VERSION`, migration |
| `balance_answer_positions.py` | référentiel et CPS | mutation YAML en place | `HISTORICAL_VERSION`, migration |
| `generate_missing_cps.py` | contenu encodé dans le script | écrit 8 CPS | `HISTORICAL_VERSION`, migration |

### Évaluation fonctionnelle isolée

Aucun générateur n'a été exécuté dans la source importée. Le constructeur
interdit explicitement tout chemin d'exécution situé sous la racine historique.
Il refuse aussi une racine de sortie égale à, située sous, ou résolue par lien
symbolique dans la racine d'import.

Chaque outil historique est lancé obligatoirement avec `/usr/bin/bwrap`,
`--unshare-all`, `--die-with-parent`, `--new-session` et `--clearenv`. Le bac à
sable ne monte en lecture seule que `/usr`, `/lib` et `/lib64`, fournit ses
propres `/proc` et `/dev`, coupe le réseau, remonte la racine en lecture seule
et n'accorde l'écriture qu'à l'espace temporaire `/workspace`. Si Bubblewrap
est absent ou échoue, l'évaluation échoue fermée. Le lanceur impose en plus des
limites par processus abaissées à 20 secondes CPU, 512 Mio d'espace d'adressage
et 1 Mio par fichier, ainsi qu'un délai maximal de 60 secondes. Une supervision
hôte agrégée interrompt le groupe au-delà de 64 Mio dans le workspace,
32 processus, 1 Gio de RSS ou 30 secondes de CPU. Stdout et stderr sont capturés
dans des fichiers anonymes hôte, invisibles et non remplaçables depuis le bac à
sable, avec une lecture bornée après terminaison. Le groupe de processus et ses
descendants sont supprimés au timeout ou au dépassement.

Pour la chaîne des séances, une copie temporaire fidèle du paquet livré
reproduit le défaut des deux scripts :

- état du paquet livré : `FAIL_PATH_LAYOUT` ;
- `generate_session_kits.py` : code retour 1, `FileNotFoundError` ;
- `validate_session_kits.py` : code retour 1, `FileNotFoundError` ;
- les scripts situés sous `outils/` cherchent
  `outils/source-modules.json`, `outils/curriculum-anchors.yaml`,
  `outils/corpus-85-seances/` et `positionnement/`, alors que les données
  livrées se trouvent sous `sources/`, `corpus/` et dans un paquet frère.

Ils ne sont donc pas directement utilisables depuis le layout importé. Leur
statut de portabilité est `REQUIRES_PATH_ADAPTATION`.

Dans deux espaces temporaires séparés, le layout attendu a été reconstitué sans
modifier les scripts : 17 CPS v3 sous `positionnement/`, catalogue et ancres
sous `outils/`. Lors de chacune des deux exécutions, le générateur et le
validateur terminent avec un code retour 0. Les 393 fichiers générés sont
identiques par chemin et SHA-256 aux 393 fichiers du corpus importé, ainsi
qu'entre les deux exécutions : zéro fichier manquant, supplémentaire ou
différent.

Pour la chaîne positionnement, une copie temporaire des 17 CPS, du référentiel,
de `generate_operational_resources.py` et de `validate_cps.py` conserve le
layout attendu. Deux exécutions dans des espaces distincts terminent chacune
avec un code retour 0 ; les 69 sorties sont identiques par chemin et SHA-256 aux
69 ressources importées et entre les deux exécutions.

Le SHA global de la source vaut
`077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005`
avant et après ces exécutions isolées. Le digest de l’arbre complet, qui couvre
aussi répertoires, liens symboliques et types de fichiers, est également
identique avant et après.

Le test d'intégration sur les 534 fichiers reconstruit l'inventaire lorsqu'un
artefact de checkout n'est pas présent. Il exige toutefois que le corpus
historique externe soit fourni par
`PRE_RENTREE_PEDAGOGY_IMPORT_ROOT` : ce contrôle n’est pas un gate CI autonome
sur un checkout dépourvu de cette source. Un test CLI synthétique exerce
séparément les quatre paquets attendus et le refus des racines de sortie
chevauchant l'import.

Le détail des imports, entrées, sorties, effets de bord, reproductibilité et
couverture de chaque script, ainsi que les codes retour et comparaisons, est
conservé dans
`DECISIONS-DEDUPLICATION.json`.

## Sorties

- `INVENTAIRE-IMPORT-FINAL.csv` : 534 lignes et classe finale ;
- `INVENTAIRE-IMPORT-FINAL.json` : inventaire complet, résumé et matrice ;
- `DECISIONS-DEDUPLICATION.json` : groupes, preuves, comparaisons, scripts,
  contrôle du catalogue et blocages.

## Risques et rollback

La sélection n'est qu'une décision de candidature pour la Task 3. Elle
n'accorde ni `CLASSROOM_READY` ni `PUBLICATION_APPROVED`. Le rollback consiste
à supprimer les trois sorties générées et les quatre fichiers de Task 2 ; la
source historique reste inchangée.
