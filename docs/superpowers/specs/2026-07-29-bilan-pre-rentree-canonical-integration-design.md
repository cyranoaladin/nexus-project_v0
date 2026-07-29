# Bilan gratuit ↔ corpus pédagogique — conception de convergence canonique

## Date

2026-07-29

## Contexte

La branche d'intégration réunit :

- le workflow sécurisé des demandes de bilan, de l'authentification parent et
  des liens magiques ;
- le corpus éditorial des 17 modules, 17 CPS et 85 séances de pré-rentrée.

Le premier lot persiste l'état utilisateur dans Prisma. Le second conserve les
définitions pédagogiques éditables sous `content/` et génère exclusivement sous
`.artifacts/`. La convergence doit relier ces deux responsabilités sans copier
le corpus en base, sans lire du YAML depuis une route et sans rendre publiable
un contenu encore soumis à validation humaine.

## Décisions

### Frontière serveur unique

`lib/pre-rentree/pedagogy/` devient l'unique adaptateur applicatif du corpus.
Il charge `modules.json`, `pedagogy/manifest.yaml` et les CPS référencés par le
manifeste, valide leurs relations et restitue des objets métier immuables.

Le chargeur :

- résout uniquement des chemins relatifs autorisés sous le dépôt ;
- valide les structures avant adaptation ;
- recalcule chaque empreinte SHA-256 annoncée par le manifeste ;
- recoupe module, niveau, matière, séances, CPS, nœuds et items ;
- refuse tout identifiant, toute version ou toute empreinte inconnus ;
- sépare la consultation interne de l'affectation et de la publication ;
- refuse par défaut l'affectation ou la publication de
  `HUMAN_VALIDATION_REQUIRED`.

Les routes HTTP et le navigateur n'accèdent jamais directement aux fichiers.

### Sources et état

Les sources de vérité restent :

- `content/pre-rentree-2026/modules.json` pour les modules et séances ;
- `content/pre-rentree-2026/pedagogy/manifest.yaml` pour l'index, les versions,
  les statuts et les empreintes ;
- `positioning/` et `session-kits/` pour les contenus éditables détaillés.

Prisma conserve uniquement l'état métier et la preuve historique de la
définition utilisée : identifiant stable, version et empreinte. Les champs de
provenance existants de `CanonicalAssessmentAttempt` satisfont déjà ce besoin ;
aucune table de corpus ni table spéculative n'est ajoutée dans ce lot.

### Compatibilité de catalogue

Le catalogue historique `lib/bilans/catalog` ne doit plus fabriquer une
seconde définition à partir des diagnostics TypeScript Maths/NSI. Son
résolveur de publication reste testable avec des packs injectés, mais son
catalogue par défaut est adapté depuis `PedagogyCatalog`. Tous les packs du
corpus intégré restent en revue et ne peuvent donc pas être résolus comme
publiés.

### Statuts de publication

`modules.json.publicationStatus = VALIDATED` signifie uniquement que la
structure commerciale du module est validée. Il ne lève pas le verrou
éditorial. Le statut autoritatif pour un usage pédagogique est celui du
manifeste et du CPS, actuellement `HUMAN_VALIDATION_REQUIRED`.

Une transition future vers un statut publiable devra être cohérente dans le
manifeste, le module indexé et le CPS, porter une validation nominative et
produire une nouvelle version/empreinte. Le présent lot ne modifie aucun statut
éditorial.

### Correction manuelle

Le contrat du futur moteur distingue :

`BROUILLON → AFFECTE → COMMENCE → SOUMIS →
EN_ATTENTE_CORRECTION_MANUELLE → CORRIGE → RESULTAT_CALCULE →
BILAN_GENERE → TRANSMIS_OU_PUBLIE`.

Après soumission, toute réponse `reponse_courte` non corrigée impose
`EN_ATTENTE_CORRECTION_MANUELLE`. Elle n'est ni correcte ni fausse. Tant que ce
verrou subsiste, le contrat refuse un score définitif, un calibrage définitif
de groupe et un bilan final. Ce lot fournit ce contrat et ses tests, mais
n'implémente pas le moteur complet ni de nouvelles tables.

### Physique-Chimie Seconde

La résolution se fait strictement par identifiant du catalogue. L'absence de
module `seconde-physique-chimie` dans `modules.json` produit donc une erreur
`UNKNOWN_DEFINITION`. Aucun alias ni fallback ne peut l'inventer.

## Options écartées

- Copier les YAML dans Prisma : crée deux sources éditables et rend les mises à
  jour historiques ambiguës.
- Importer directement les JSON/YAML dans le navigateur : expose le corpus
  interne et contourne les contrôles de publication.
- Continuer à adapter les diagnostics TypeScript historiques : maintient une
  définition concurrente des mêmes tests.
- Ajouter dès maintenant les tables d'affectation, réponse et correction :
  spéculatif tant que le moteur et son workflow ne sont pas cadrés.
- Considérer `modules.json: VALIDATED` comme une autorisation de publication :
  contredit le manifeste et la validation humaine obligatoire.

## Validation attendue

- tests unitaires du chargeur, des relations, des versions et des empreintes ;
- tests de refus des identifiants inconnus et de Physique-Chimie Seconde ;
- tests de refus `HUMAN_VALIDATION_REQUIRED` pour affectation/publication ;
- tests du verrou de correction manuelle ;
- tests du raccordement par défaut de `lib/bilans/catalog` ;
- pipeline pédagogique, tests bilans/sécurité, Prisma, lint, typecheck et build ;
- reproduction des gates depuis un worktree détaché du SHA final.
