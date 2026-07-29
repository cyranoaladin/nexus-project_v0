# Rapport d'import du corpus pédagogique Pré-rentrée 2026

## Date

29 juillet 2026.

## Verdict

`BLOCKED` dans l'attente des gates finaux au SHA de remise. L'import,
l'inventaire, la classification, le pipeline reproductible et la suite Python
complète sont verts. La première suite TypeScript finale a produit 403 tests
verts sur 404 : le seul échec provient des compteurs obsolètes de six documents
de gouvernance actifs. Après leur correction, le test ciblé est vert. La suite
TypeScript complète, `lint`, `typecheck`, `build` et la vérification depuis un
checkout propre doivent encore être verts avant de déclarer le lot `PASS`.

Ce verdict de remise ne crée aucun conflit de sélection. Les 17 modules
requièrent toujours une validation humaine et ne sont pas autorisés à
l'utilisation en classe ou à la publication.

## Préflight

- racine réelle du dépôt : `/home/alaeddine/Bureau/nexus-project_v0` ;
- branche source occupée : `prepared/pre-rentree-navbar-entry` ;
- branche isolée : `feat/pre-rentree-pedagogy-corpus` ;
- SHA de départ : `c6e055fb82216e46aab00f121f7817aed00e62ca` ;
- worktree isolé :
  `/home/alaeddine/.config/superpowers/worktrees/nexus-project_v0/pre-rentree-pedagogy-corpus` ;
- remotes relevés : `origin` et `canonical` ;
- six modifications suivies et l'import non suivi du worktree d'origine ont
  été préservés.

Le seul `AGENTS.md` applicable hors dépendances, artefacts et dépôts voisins
est celui de la racine ; ses 578 lignes ont été lues. Aucun reset destructif,
écrasement, fusion, push, déploiement ou publication n'a été effectué.

## Snapshot immuable

Le snapshot a été calculé avant toute copie canonique :

```bash
(cd docs/bilans/dossiers_tests_prerentree &&
  find \
    ./Nexus-positionnement \
    ./Nexus-positionnement-2026-maths-francais-v2 \
    ./Nexus-PreRentree-2026-positionnement-17-modules-v3 \
    ./Nexus-PreRentree-2026-85-seances \
    -type f -print0 |
  LC_ALL=C sort -z |
  xargs -0 sha256sum) > /tmp/nexus-pre-rentree-import-sha256.NEFxIF
sha256sum /tmp/nexus-pre-rentree-import-sha256.NEFxIF
```

Résultat :

- 119 répertoires, racine incluse ;
- 534 fichiers ;
- 4 083 588 octets ;
- 534 SHA-256 ;
- zéro fichier vide, caché, ambigu ou lien symbolique ;
- une archive ZIP valide ;
- SHA-256 du manifeste trié :
  `077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005`.

Le même hash a été retrouvé après inventaire et déduplication. Le README racine
ajouté ensuite comme redirection versionnée est une métadonnée explicitement
autorisée et exclue par le CLI : toutes les commandes d'inventaire et de hash
ciblent uniquement les quatre paquets. Les 119 répertoires, 534 fichiers et le
SHA de référence restent inchangés. Aucun écart n'est observé par rapport aux
nombres annoncés.

### Répartition par paquet

| Paquet | Fichiers |
|---|---:|
| `Nexus-positionnement` | 6 |
| `Nexus-positionnement-2026-maths-francais-v2` | 11 |
| `Nexus-PreRentree-2026-positionnement-17-modules-v3` | 95 |
| `Nexus-PreRentree-2026-85-seances` | 422 |
| **Total** | **534** |

### Répartition par type

| Extension | Fichiers |
|---|---:|
| Markdown | 453 |
| YAML | 52 |
| CSV | 19 |
| Python | 7 |
| JSON | 1 |
| texte | 1 |
| ZIP | 1 |
| **Total** | **534** |

## Classification

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

Aucune ligne finale ne porte `PENDING_DEDUPLICATION`.

## Décisions de déduplication

Le corpus contient 27 groupes exacts, soit 29 copies excédentaires internes.
La trentième entrée `DUPLICATE_IDENTICAL` est
`sources/source-modules.json`, copie du catalogue déjà versionné dans
`content/pre-rentree-2026/modules.json`.

Les 17 CPS v3 sont byte-à-byte identiques aux copies livrées dans le paquet des
85 séances. Les cinq CPS mathématiques v1/v2 sont identiques entre elles mais
diffèrent des v3 corrigées. La comparaison v2 vers v3 prouve exactement :

- 9 statuts racine ajoutés ;
- 153 réordonnancements de propositions ;
- 100 ajouts `obstacleVise` ;
- une correction de palier `B/B/C` vers `A/B/C` ;
- zéro autre changement.

Les versions v1/v2 restent historiques. Aucun fond pédagogique divergent n'a
été arbitré silencieusement.

## Conflits

- conflits de sélection non résolus : 0 ;
- fichiers non classés : 0 ;
- module Physique-Chimie Seconde : intentionnellement absent, conformément au
  catalogue canonique ;
- validation pédagogique humaine : requise pour chacun des 17 modules.

Le défaut de chemins des générateur/validateur de séances importés est un
défaut technique, pas un conflit de contenu. Il a été reproduit dans une copie
temporaire, puis résolu par portage vers les chemins canoniques.

## Corpus canonique et sorties

Les contrôles canoniques retrouvent :

- 17 CPS, 141 nœuds, 136 nœuds évalués, 408 items et 33 réponses manuelles ;
- 17 modules, 85 séances et 340 fichiers unitaires ;
- 255 banques A/B/C, 765 exercices, 765 corrigés ;
- 85 exit tickets et 255 questions ;
- quatre séances explicitement marquées comme ressources spécifiques.

Les sorties historiques reconstructibles comptent 69 ressources de
positionnement et 34 compilations de séances, soit 103 fichiers. L'oracle de
positionnement compare 51 Markdown byte-à-byte et 18 CSV ; pour les CSV, le
seul écart autorisé et observé est la normalisation CRLF vers LF. Aucune autre
normalisation n'est admise.

## Arborescence finale

```text
content/pre-rentree-2026/pedagogy/
├── manifest.yaml
├── positioning/
│   ├── cps/                       # 17 YAML
│   ├── REFERENTIEL-CANONIQUE-2026.yaml
│   ├── SPEC-tests-positionnement-pre-stage-2026.md
│   └── curriculum-anchors.yaml
└── session-kits/
    ├── MANIFESTE-SEANCES.csv
    └── modules/                   # 17 modules, 85 séances, 340 unités

scripts/pre-rentree/pedagogy/
├── import, classification et déduplication
├── validateurs et schémas
├── générateurs canoniques
└── vérification de reproductibilité

docs/campaigns/pre-rentree-2026/pedagogy/
├── README.md
├── SOURCE-OF-TRUTH.md
├── CONTENT-STATUS.md
├── IMPORT-REPORT-2026-07-29.md
├── DEDUPLICATION-REPORT.md
├── CONFLICTS.md
└── IMPLEMENTATION-ROADMAP.md

.artifacts/pre-rentree-2026/pedagogy/
├── import/
├── generated/{positioning,session-kits}/
├── review/
└── packages/
```

## Commandes et résultats

| Commande | Résultat |
|---|---|
| `npm run pre-rentree:test:py` sans snapshot | rouge attendu : cinq erreurs de collecte, `publication.snapshot.json` absent |
| `npm run pre-rentree:snapshot` puis `npm run pre-rentree:test:py` | vert de baseline : 160 tests Python |
| `npm run pre-rentree:test:ts` après snapshot | vert de baseline : 404 tests, 53 suites |
| import réel et construction du manifeste | vert : 534 fichiers, matrice complète |
| validation CPS/session kits | vert : compteurs canoniques exacts |
| double génération dans deux sorties propres | vert : sorties byte-identiques |
| oracle historique de positionnement | vert : 51 Markdown exacts, 18 CSV avec LF seul |
| `python -m pytest scripts/pre-rentree/tests/test_pedagogy_hygiene.py -q` | vert : 2 tests |
| `npm run pre-rentree:pedagogy:verify` | vert : 103 fichiers, arbre reproductible `282bd45a97115fcf9b177b4b22430c1bbd9415a79a54d5c56f463564f19e2408` |
| `npm run pre-rentree:pedagogy:import-check` | vert : 119 répertoires, 534 fichiers, hash inchangé |
| `python -m pytest scripts/pre-rentree/tests/test_pedagogy_import.py -q -k 'import_redirect'` | vert : 3 tests, README régulier exclu et autres types refusés |
| `npm run pre-rentree:test:py` au gate final | vert : 257 tests réussis, 2 ignorés en 804.08 s |
| première exécution de `npm run pre-rentree:test:ts` au gate final | rouge : 403/404 tests ; taxonomie active obsolète (`17 cohortes`, `14 programmes`, `70 fiches`) |
| `npm test -- --runInBand __tests__/campaigns/pre-rentree-2026-director-contract.test.ts` après correction | vert : 4/4 tests |

La suite TypeScript complète doit encore être rejouée. `lint`, `typecheck`,
`build` et le checkout propre restent également à relever au SHA final ; un
résultat historique ne doit pas être présenté comme une preuve du commit final.

## Sécurité et données de mineurs

L'importeur refuse fichiers cachés, vides, ambigus, liens symboliques et
archives invalides. L'évaluation des outils historiques se fait en bac à sable
sans réseau, avec environnement vidé, système en lecture seule et limites de
ressources. Les validateurs recherchent les fuites de réponses dans les
supports élève. Aucun nom d'élève, donnée de santé, secret ou charge utile
sensible ne doit entrer dans le corpus ou les logs.

## Fichiers ajoutés ou modifiés

Le lot touche uniquement :

- les sources sous `content/pre-rentree-2026/pedagogy/` ;
- le pipeline et ses tests sous `scripts/pre-rentree/` ;
- `package.json` pour les commandes pédagogiques ;
- la gouvernance et les index sous `docs/`.

Il ne modifie ni prix, ni offres, ni modèle Prisma, ni API, ni interface
applicative, ni fichier sous `public/`. La liste exhaustive est produite par :

```bash
git diff --name-status c6e055fb82216e46aab00f121f7817aed00e62ca..HEAD
```

## Risques restants

- le fond disciplinaire n'est pas encore validé par les rôles requis ;
- les contenus ne sont pas prêts pour la classe ou la publication ;
- l'import historique externe est nécessaire uniquement pour rejouer
  `import-check` et l'oracle, pas pour valider ou reconstruire le canon ;
- les lots applicatifs 2 à 6 restent hors périmètre.

## Rollback

Le rollback consiste à revenir sur les commits du lot 1 par nouveaux commits
Git, sans reset destructif, puis à supprimer les artefacts non suivis sous la
racine dédiée. Le dossier d'import historique reste intact et récupérable.
Aucun rollback ne doit toucher d'autres artefacts, `public/` ou le travail du
worktree d'origine.
