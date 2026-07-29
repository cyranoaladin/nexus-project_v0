# Pré-rentrée 2026 Pedagogy Corpus Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'import pédagogique Pré-rentrée 2026 en un corpus canonique, traçable, validable et reproductible, sans modifier silencieusement le fond pédagogique ni publier de document.

**Architecture:** Le dossier importé reste une entrée historique immuable. Un importeur déterministe produit l'inventaire et la classification sous `.artifacts/`; seules les sources retenues sont versionnées sous `content/`, les outils sous `scripts/`, et les décisions sous `docs/`. Les validateurs rapprochent le corpus de `modules.json`, refusent les sources manquantes ou non classées et génèrent exclusivement sous `.artifacts/pre-rentree-2026/pedagogy/`.

**Tech Stack:** Python 3.12, PyYAML, JSON Schema, CSV/Markdown, pytest, npm scripts, Git.

**État au 29 juillet 2026 :** plan approuvé et exécuté sur
`feat/pre-rentree-pedagogy-corpus`. Les cases ci-dessous conservent la
formulation du plan de travail ; les preuves d'exécution et le statut de remise
font foi dans
`docs/campaigns/pre-rentree-2026/pedagogy/IMPORT-REPORT-2026-07-29.md`.

---

## Chunk 0: Préflight déjà exécuté

### Task 0: Consigner l'isolement et le snapshot source

**Files:**
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/IMPORT-REPORT-2026-07-29.md`

- [x] **Step 1: Résoudre la racine et lire les instructions**

Racine confirmée : `/home/alaeddine/Bureau/nexus-project_v0`. Seul `AGENTS.md` à la racine est applicable hors dépendances, artefacts et dépôts voisins ; 578 lignes lues.

- [x] **Step 2: Relever l'état Git initial**

Branche initiale `prepared/pre-rentree-navbar-entry`, HEAD `c6e055fb82216e46aab00f121f7817aed00e62ca`, six fichiers suivis modifiés, import non suivi, remotes `origin` et `canonical` relevés.

- [x] **Step 3: Créer le worktree isolé**

Branche `feat/pre-rentree-pedagogy-corpus`, worktree `/home/alaeddine/.config/superpowers/worktrees/nexus-project_v0/pre-rentree-pedagogy-corpus`, créé au SHA initial sans déplacer le corpus.

- [x] **Step 4: Établir le snapshot avant mutation**

Commande exécutée dans la source originale :

`(cd docs/bilans/dossiers_tests_prerentree && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > "$(mktemp /tmp/nexus-pre-rentree-import-sha256.XXXXXX)"`

Résultat : 119 répertoires racine incluse, 534 fichiers, manifeste temporaire `/tmp/nexus-pre-rentree-import-sha256.NEFxIF`, SHA-256 `077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005`, aucun fichier vide/caché/lien symbolique, ZIP testé avec `unzip -t`.

## Chunk 1: Inventaire, classification et décisions de source

### Task 1: Pipeline d'inventaire immuable

**Files:**
- Create: `scripts/pre-rentree/pedagogy/import_pedagogy_corpus.py`
- Create: `scripts/pre-rentree/pedagogy/classification.py`
- Create: `scripts/pre-rentree/tests/test_pedagogy_import.py`
- Create: `scripts/pre-rentree/pedagogy/README.md`
- Modify: `scripts/pre-rentree/requirements.lock`
- Modify: `scripts/pre-rentree/tests/test_python_requirements.py`
- Generate only: `.artifacts/pre-rentree-2026/pedagogy/import/INVENTAIRE-IMPORT.csv`
- Generate only: `.artifacts/pre-rentree-2026/pedagogy/import/INVENTAIRE-IMPORT.json`
- Generate only: `.artifacts/pre-rentree-2026/pedagogy/import/MANIFEST-SHA256.txt`

- [ ] **Step 1: Écrire les tests d'inventaire**

Tester un corpus miniature : ordre stable, chemin relatif, taille, extension, MIME, SHA-256, paquet d'origine, classification provisoire, rôle logique, destination proposée, détection des fichiers vides/liens symboliques/archives, noms ambigus, fichiers cachés et intégrité de chaque ZIP.

- [ ] **Step 2: Vérifier l'échec RED**

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_import.py -q`

Expected: FAIL, modules d'import/classification absents.

- [ ] **Step 3: Implémenter l'importeur minimal et la classification**

L'entrée est fournie par `--import-root`; aucun chemin absolu n'est encodé. L'inventaire initial peut porter un statut provisoire `PENDING_DEDUPLICATION` distinct des neuf classes finales. Les règles nomment explicitement les quatre paquets historiques et qualifient chaque type connu sans inspecter ni modifier le contenu pédagogique. Ajouter `PyYAML==6.0.1` au lock et au test de dépendances.

- [ ] **Step 4: Vérifier GREEN et l'inventaire réel**

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_import.py -q`

Run: `python scripts/pre-rentree/pedagogy/import_pedagogy_corpus.py --import-root /home/alaeddine/Bureau/nexus-project_v0/docs/bilans/dossiers_tests_prerentree --output-root .artifacts/pre-rentree-2026/pedagogy/import`

Expected: 119 répertoires, 534 fichiers, 534 hashes, zéro omission, zéro fichier vide/caché/lien symbolique, chaque ZIP valide, aucune mutation de la source.

- [ ] **Step 5: Recalculer le manifeste de la source**

Rejouer la commande consignée en Chunk 0 et comparer le SHA-256 du manifeste trié au snapshot initial `077bce2a8737acb07134902f5815321f2dcb97fca435a6d14035db1d39357005`.

### Task 2: Déduplication et conflits

**Files:**
- Create: `scripts/pre-rentree/pedagogy/build_pedagogy_manifest.py`
- Create: `scripts/pre-rentree/tests/test_pedagogy_manifest.py`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/DEDUPLICATION-REPORT.md`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/CONFLICTS.md`

- [ ] **Step 1: Écrire les tests de regroupement**

Tester les groupes par rôle logique, les doublons byte-à-byte, les divergences YAML normalisées, les versions historiques et l'impossibilité de sélectionner silencieusement un conflit.

- [ ] **Step 2: Vérifier l'échec RED**

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_manifest.py -q`

Expected: FAIL, constructeur de manifeste absent.

- [ ] **Step 3: Implémenter les comparaisons déterministes**

Comparer SHA-256 d'abord, puis YAML/JSON parsés, CSV normalisés et texte Markdown. Pour les scripts, comparer dépendances, entrées, sorties, effets de bord, reproductibilité et tests associés. Produire des décisions machine lisibles pour les candidats v1/v2/v3, la copie CPS du paquet 85 séances, les scripts et les sorties générées.

- [ ] **Step 4: Vérifier GREEN**

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_manifest.py -q`

Expected: PASS, tous les groupes divergents sont explicitement décidés ou inscrits comme `CONFLICT_REVIEW_REQUIRED`.

- [ ] **Step 5: Finaliser les neuf classes**

Réécrire les 534 lignes d'inventaire avec exactement une des neuf classes. Refuser tout `PENDING_DEDUPLICATION` ou `UNCLASSIFIED`. Vérifier que la somme de la matrice de classes vaut exactement 534.

- [ ] **Step 6: Rédiger les décisions prouvées**

Documenter les groupes identiques, les versions historiques, les conflits pédagogiques non arbitrables et la règle qui retient v3 comme candidat CPS uniquement lorsque la structure et les validateurs le prouvent.

## Chunk 2: Sources canoniques et validateurs

### Task 3: Canonicaliser les CPS et les kits de séance

**Files:**
- Create: `content/pre-rentree-2026/pedagogy/README.md`
- Create: `content/pre-rentree-2026/pedagogy/manifest.yaml`
- Create: `content/pre-rentree-2026/pedagogy/positioning/SPEC-tests-positionnement-pre-stage-2026.md`
- Create: `content/pre-rentree-2026/pedagogy/positioning/REFERENTIEL-CANONIQUE-2026.yaml`
- Create: `content/pre-rentree-2026/pedagogy/positioning/curriculum-anchors.yaml`
- Create: `content/pre-rentree-2026/pedagogy/positioning/cps/*.yaml`
- Create: `content/pre-rentree-2026/pedagogy/session-kits/MANIFESTE-SEANCES.csv`
- Create: `content/pre-rentree-2026/pedagogy/session-kits/modules/<module-id>/README.md`
- Create: `content/pre-rentree-2026/pedagogy/session-kits/modules/<module-id>/s0N-<slug>/{banques-eleve,corrige-commente,verification-eleve,verification-correction}.md`
- Create: `scripts/pre-rentree/pedagogy/schemas/cps.schema.json`
- Create: `scripts/pre-rentree/pedagogy/schemas/pedagogy-manifest.schema.json`
- Create: `scripts/pre-rentree/pedagogy/schemas/session-kit.schema.json`
- Create: `scripts/pre-rentree/pedagogy/validate_cps.py`
- Create: `scripts/pre-rentree/pedagogy/validate_session_kits.py`
- Create: `scripts/pre-rentree/tests/test_positioning_cps.py`
- Create: `scripts/pre-rentree/tests/test_session_kits.py`

- [ ] **Step 1: Écrire les tests contractuels**

Tester 17 identifiants alignés sur `modules.json`, 17 CPS, exactement 141 nœuds/136 évalués/408 items/33 réponses manuelles, paliers A/B/C (dont correction du B/B/C historique), distribution des bonnes réponses non uniformément A, `obstacleVise`, rattachements réels, quatre séances sans nœud d'accueil explicitement traitées, état manuel exclu du scoring automatique, 17 modules, 85 séances, quatre fichiers unitaires par séance, 255 banques, 765 exercices, 765 corrigés, 85 exit tickets, 255 questions, doublons exacts de consignes nuls ou listés explicitement, et absence de module Physique-Chimie Seconde.

- [ ] **Step 2: Vérifier l'échec RED**

Run: `python -m pytest scripts/pre-rentree/tests/test_positioning_cps.py scripts/pre-rentree/tests/test_session_kits.py -q`

Expected: FAIL, sources canoniques absentes.

- [ ] **Step 3: Copier uniquement les sources retenues**

Copier byte-à-byte seulement les candidats dont Task 2 porte une décision prouvée sans conflit ouvert : jusqu'à 17 CPS v3, spécification/référentiel/ancres, manifeste CSV des séances, 17 README modules et 340 fichiers unitaires. Si un groupe requis reste `CONFLICT_REVIEW_REQUIRED`, ne sélectionner aucune version pour ce groupe, documenter le blocage et poursuivre les groupes indépendants. Exclure cahiers/guides compilés, tests/corrections/pilotage/cartes générés et ZIP.

- [ ] **Step 4: Adapter les validateurs aux chemins canoniques**

Les validateurs reçoivent `--repo-root`, n'utilisent jamais l'import historique et échouent sur statut excessif, source manquante, rattachement invalide, solution exposée côté élève ou compte divergent.

- [ ] **Step 5: Construire le manifeste canonique**

Tester puis référencer `version`, `campaignId`, `moduleCatalog`, compteurs, racine des sorties, validation humaine et rôles requis. Référencer chaque module, niveau, matière, CPS, cinq séances, hashes sources, sorties attendues et statut `HUMAN_VALIDATION_REQUIRED`; laisser validateur humain et date de validation absents/nulls faute de preuve. Refuser toute attribution automatique de `CLASSROOM_READY` et tout `PUBLICATION_APPROVED` sans statut antérieur prouvé.

- [ ] **Step 6: Vérifier GREEN**

Run: `python -m pytest scripts/pre-rentree/tests/test_positioning_cps.py scripts/pre-rentree/tests/test_session_kits.py -q`

Expected: PASS avec les compteurs exacts du Step 1 et zéro conflit requis non matérialisé.

## Chunk 3: Génération reproductible et commandes

### Task 4: Adapter les générateurs et scripts npm

**Files:**
- Create: `scripts/pre-rentree/pedagogy/generate_positioning_resources.py`
- Create: `scripts/pre-rentree/pedagogy/generate_session_kits.py`
- Create: `scripts/pre-rentree/tests/test_pedagogy_generators.py`
- Create: `scripts/pre-rentree/tests/test_pedagogy_hygiene.py`
- Modify: `package.json`
- Modify: `scripts/pre-rentree/tests/test_command_interface.py`

- [ ] **Step 1: Écrire les tests fonctionnels des générateurs**

Tester les compteurs des tests/corrections/pilotages/cartes/cahiers/guides, l'absence de réponses dans les sorties élève, l'échec sur source ou conflit manquant, l'indépendance au dossier historique, et la séparation `generated/`, `review/` et `packages/`.

- [ ] **Step 2: Vérifier l'échec RED des générateurs**

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_generators.py -q`

Expected: FAIL, générateurs canoniques absents.

- [ ] **Step 3: Étendre le test d'interface de commandes**

Exiger les scripts npm `pre-rentree:pedagogy:import-check`, `:validate`, `:build`, `:verify`, leurs chemins canoniques et leur racine de sortie `.artifacts/pre-rentree-2026/pedagogy/`.

- [ ] **Step 4: Vérifier l'échec RED des commandes**

Run: `python -m pytest scripts/pre-rentree/tests/test_command_interface.py -q`

Expected: FAIL, commandes pédagogiques absentes.

- [ ] **Step 5: Porter les générateurs utiles**

Lire uniquement `content/pre-rentree-2026/pedagogy/`; écrire tests élèves, corrections, pilotage, cartes et cahiers/guides sous `.artifacts/pre-rentree-2026/pedagogy/generated/`, les dossiers de revue sous `review/` et les paquets sous `packages/`; bannir `rmtree` de l'import et les timestamps variables.

- [ ] **Step 6: Ajouter les commandes npm**

`import-check` lit `${PRE_RENTREE_PEDAGOGY_IMPORT_ROOT:?…}` sans valeur absolue encodée et valide l'import fourni ; `validate` vérifie les sources ; `build` génère les sorties ; `verify` enchaîne validation/build/reproductibilité sans dépendre de l'import. Ne raccorder à `pre-rentree:ci` qu'après deux générations byte-identiques.

- [ ] **Step 7: Vérifier GREEN**

Run: `python -m pytest scripts/pre-rentree/tests/test_command_interface.py -q`

Run: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_generators.py -q`

Run: `npm run pre-rentree:pedagogy:validate`

- [ ] **Step 8: Prouver la reproductibilité depuis deux sorties propres**

Dans le worktree, générer dans deux répertoires temporaires distincts avec :

`python scripts/pre-rentree/pedagogy/generate_positioning_resources.py --repo-root . --output-root "$OUT_A/generated/positioning"`

`python scripts/pre-rentree/pedagogy/generate_session_kits.py --repo-root . --output-root "$OUT_A/generated/session-kits"`

Rejouer les deux commandes avec `$OUT_B`, produire `find "$OUT_X" -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum` après normalisation du préfixe et comparer par `diff -u`.

Puis vérifier :

Run: `git ls-files '.artifacts/pre-rentree-2026/pedagogy/**'`

Run: `git diff --name-only c6e055fb82216e46aab00f121f7817aed00e62ca -- public/`

Run: `git ls-files --others --exclude-standard -- public/`

Expected: manifestes identiques dans le worktree et le checkout propre, aucune sortie suivie par Git, aucun diff ni fichier non suivi sous `public/`.

## Chunk 4: Gouvernance et remise

### Task 5: Documentation, index et contrôles finaux

**Files:**
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/README.md`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/SOURCE-OF-TRUTH.md`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/CONTENT-STATUS.md`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/IMPORT-REPORT-2026-07-29.md`
- Create: `docs/campaigns/pre-rentree-2026/pedagogy/IMPLEMENTATION-ROADMAP.md`
- Create: `docs/bilans/dossiers_tests_prerentree/README.md`
- Modify: `docs/campaigns/pre-rentree-2026/README.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/superpowers/plans/2026-07-29-pre-rentree-pedagogy-corpus.md`

- [ ] **Step 1: Rédiger les six documents de gouvernance**

Inclure préflight, inventaire et écarts, matrice de classification totalisant 534, décisions de déduplication, conflits, statuts par module, commandes, limites du lot 1, rollback et lots suivants. La remise contient explicitement : verdict `PASS` seulement si zéro conflit requis et tous les gates verts, sinon `BLOCKED`; conflits non résolus; arborescence finale; liste exhaustive des fichiers; tableau tests verts/rouges avec causes; risques restants.

- [ ] **Step 2: Corriger uniquement les compteurs prouvés**

Mettre `PEDAGOGICAL_MODULES=17`, `PEDAGOGICAL_SESSION_TEMPLATES=85`, corriger les phrases incohérentes et indexer le nouveau corpus. Ne modifier ni prix, ni offres, ni logique applicative.

- [ ] **Step 3: Ajouter la redirection historique**

Le README du dossier d'import précise que l'import n'est pas canonique, pointe vers `content/`, `scripts/`, `docs/` et `.artifacts/`, et interdit son usage en production.

- [ ] **Step 4: Exécuter les contrôles ciblés**

Écrire d'abord `scripts/pre-rentree/tests/test_pedagogy_hygiene.py` pour les liens Markdown internes, syntaxe des blocs Python, UTF-8/LF, noms de fichiers stables, recherche de secrets/PII et doublons de consignes/liste blanche. Le lancer avant implémentation et constater RED sur les contrôles absents, adapter les validateurs, puis relancer GREEN.

Run RED/GREEN: `python -m pytest scripts/pre-rentree/tests/test_pedagogy_hygiene.py -q`

Run: `npm run pre-rentree:pedagogy:verify`

Run: `npm run pre-rentree:test:py`

Run: `npm run pre-rentree:test:ts`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run build`

Expected: toutes les commandes vertes, ou échec préexistant reproduit et documenté précisément.

- [ ] **Step 5: Vérifier l'hygiène Git et l'import immuable**

Run: `git status --short`

Run: `git diff --check`

Run: `git diff --cached --stat`

Recalculer les 534 hashes dans le worktree source original et retrouver le manifeste initial.

- [ ] **Step 6: Commit explicite du lot 1**

Stager seulement les chemins listés avec `git add <path>`, jamais `git add -A`. Vérifier le diff indexé, puis committer avec `feat(pre-rentree): canonicalize pedagogy corpus`.

- [ ] **Step 7: Relever le SHA final**

Run: `git rev-parse HEAD`

Run: `git status --short --branch`

Run: `git diff --stat c6e055fb82216e46aab00f121f7817aed00e62ca..HEAD`

Run: `git diff --name-status c6e055fb82216e46aab00f121f7817aed00e62ca..HEAD`

- [ ] **Step 8: Vérifier le commit depuis un checkout propre**

Créer un worktree Git temporaire détaché au SHA final avec `git worktree add --detach "$VERIFY_WT" HEAD`, installer les dépendances, exécuter `npm run pre-rentree:pedagogy:verify`, puis retirer ce worktree avec `git worktree remove "$VERIFY_WT"`. Ce contrôle prouve qu'aucune donnée de l'import historique non suivie n'est nécessaire.

Expected: un commit local propre sur `feat/pre-rentree-pedagogy-corpus`, périmètre explicitement listé, vérifié depuis le checkout propre, sans fusion, push, déploiement ni publication.
