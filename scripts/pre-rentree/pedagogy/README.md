# Inventaire pédagogique Pré-rentrée 2026

Ce dossier contient l’importeur en lecture seule du corpus pédagogique historique.
Il inventorie l’entrée fournie explicitement, sans copier ni modifier son contenu,
et écrit uniquement les rapports demandés sous une racine de sortie distincte.

## Commande

```bash
python scripts/pre-rentree/pedagogy/import_pedagogy_corpus.py \
  --import-root "$PRE_RENTREE_PEDAGOGY_IMPORT_ROOT" \
  --output-root .artifacts/pre-rentree-2026/pedagogy/import
```

Les deux options sont obligatoires. L’importeur refuse une sortie égale à la
racine d’import ou située sous celle-ci. Aucun chemin machine n’est inscrit dans
les rapports.

Le CLI valide strictement la racine avant toute écriture : elle doit contenir
exactement les quatre paquets historiques déclarés dans `classification.py`,
chacun sous forme de répertoire réel avec au moins un fichier régulier. Toute
entrée top-level supplémentaire et tout caractère de contrôle dans un nom sont
refusés. L’API Python `build_inventory` reste générique afin de permettre
l’inspection de mini-corpus et le signalement programmatique des anomalies.

## Sorties

- `INVENTAIRE-IMPORT.csv` : une ligne déterministe par fichier régulier ;
- `INVENTAIRE-IMPORT.json` : fichiers, répertoires racine incluse, liens
  symboliques et compteurs de contrôle ;
- `MANIFEST-SHA256.txt` : une empreinte SHA-256 par fichier régulier.

Chaque fichier porte son chemin relatif, sa taille, son extension, son type
MIME déterministe, son SHA-256, son paquet historique de premier niveau, son
rôle logique, sa destination proposée et sa classification provisoire. Les
fichiers vides, entrées cachées, liens symboliques, noms ambigus et archives ZIP
invalides sont signalés. Chaque ZIP est ouvert et contrôlé intégralement avant
l’écriture des rapports. La cible d’un lien symbolique absolu est expurgée afin
de ne jamais inscrire un chemin machine dans l’inventaire.

Chaque ligne de répertoire indique également si le répertoire est vide, et le
résumé expose `empty_directory_count`. Les trois sorties sont écrites depuis des
fichiers temporaires créés de façon exclusive par le système, puis remplacées
atomiquement ; un lien symbolique prépositionné n’est jamais ouvert en écriture.

## Classification

Les neuf classes finales sont déclarées dans `classification.py` :
`CANONICAL_SOURCE`, `GENERATOR`, `VALIDATOR`, `GENERATED_OUTPUT`,
`HISTORICAL_VERSION`, `ARCHIVE_PACKAGE`, `DUPLICATE_IDENTICAL`,
`CONFLICT_REVIEW_REQUIRED` et `UNCLASSIFIED`.

L’inventaire initial emploie `PENDING_DEDUPLICATION` lorsque la sélection d’une
source exige encore la comparaison de la Task 2. Ce statut interne n’est pas une
classe finale.

Les quatre paquets historiques reconnus sont :

- `Nexus-PreRentree-2026-85-seances` ;
- `Nexus-PreRentree-2026-positionnement-17-modules-v3` ;
- `Nexus-positionnement` ;
- `Nexus-positionnement-2026-maths-francais-v2`.

L’inventaire n’autorise ni publication ni promotion automatique d’une source au
statut canonique.

## Génération canonique

Les générateurs `generate_positioning_resources.py` et
`generate_session_kits.py` lisent exclusivement
`content/pre-rentree-2026/pedagogy/`. L’import historique n’est utilisé que
comme oracle optionnel par les tests lorsque
`PRE_RENTREE_PEDAGOGY_IMPORT_ROOT` est fourni.

Les 69 sorties de positionnement conservent la sémantique du générateur
historique retenu : les 51 fichiers Markdown sont byte-identiques. Les 18 CSV
(17 cartes de groupe et le manifeste) sont identiques après l’unique
normalisation technique autorisée, le remplacement des fins de ligne
historiques CRLF par LF pour une génération déterministe sur toutes les
plateformes. Aucune autre normalisation de contenu n’est appliquée.

Les écritures utilisent des descripteurs de répertoire et `O_NOFOLLOW`.
Chaque composant est ouvert ou créé séparément, puis revérifié avant le
remplacement atomique du fichier attendu. Un lien symbolique ou une entrée
résiduelle fait échouer le pipeline sans nettoyage récursif et sans écriture
dans sa cible.
