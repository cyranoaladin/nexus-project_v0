# Sources de vérité — corpus pédagogique Pré-rentrée 2026

## Date

30 juillet 2026.

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
| Frontière applicative | `lib/pre-rentree/pedagogy/` | lecture serveur, validation, relations, versions, hashes et droits d'usage |
| Moteur applicatif | `lib/bilans/engine/` | affectations, tentatives, correction, scoring et publication via le catalogue uniquement |
| État utilisateur | Prisma | demandes, authentification, tentatives, réponses, corrections, résultats, historiques et outbox ; jamais le corpus éditable |

Les prix, offres et règles commerciales restent respectivement dans
`data/pricing.canonical.json`, `content/pre-rentree-2026/offers.json` et
`data/campaigns/pre-rentree-2026.json`. Le lot 1 ne les modifie pas.

Les compteurs écrits dans les README sont des constats. Ils ne sont pas une
source indépendante : le manifeste les vérifie et les validateurs les
recalculent depuis `modules.json`, les CPS et les fichiers unitaires.

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

Le statut `VALIDATED` présent dans `modules.json` valide la structure du
catalogue de campagne. Il ne remplace pas le statut éditorial du manifeste et
du CPS. Au 29 juillet 2026, les 17 modules sont
`HUMAN_VALIDATION_REQUIRED` : ils sont accessibles en revue interne, mais
inutilisables pour une affectation réelle ou une publication.

La validation technique n'est jamais une validation disciplinaire.

## Ce qui est stocké en base

Prisma ne reçoit pas les énoncés, corrigés, banques ou YAML en tant que
définitions éditables. Pour chaque état utilisateur dépendant du corpus, il
conserve au minimum :

- l'identifiant stable de la définition ;
- la version du manifeste et de l'édition ;
- l'empreinte SHA-256 de la définition utilisée ;
- les données utilisateur et les événements nécessaires à l'audit.

`CanonicalAssessmentAssignment` scelle la référence, les versions/hashes du
manifeste et du catalogue et l'instant de résolution. Les champs
`assessmentPackId`, `assessmentPackVersion` et `assessmentPackChecksum` de
`CanonicalAssessmentAttempt` portent également cette preuve pour respecter le
contrat historique. Les réponses stockent l'ID stable de l'item et la valeur
utilisateur, jamais l'énoncé ou le corrigé. Les snapshots de score ajoutent la
version et l'empreinte de politique. Une évolution future des sources ne
réinterprète donc pas les tentatives et bilans historiques.

## Procédure de modification

1. Modifier uniquement `modules.json`, un CPS, un fichier unitaire de séance
   ou une autre source répertoriée dans le manifeste.
2. Ne jamais corriger durablement une sortie sous `.artifacts/`.
3. Mettre à jour le manifeste et ses empreintes avec les scripts canoniques.
4. Exécuter les validateurs CPS et kits, puis la reproductibilité.
5. Vérifier les compteurs dérivés, les liens, les duplications et les secrets.
6. Faire relire la modification par les rôles pédagogiques requis.
7. Utiliser les paquets de revue générés et le registre
   `HUMAN-VALIDATION-REGISTER.md` pour enregistrer les identités réelles, la
   date, la décision, les réserves, le hash validé et la chaîne de transitions.
8. Seulement après ces contrôles, préparer une affectation ou une publication
   via l'interface serveur.

Toute modification générée directement, toute copie manuelle dans Prisma ou
TypeScript et toute exposition sous `public/` sont refusées.

## Procédure de validation

La validation comporte deux niveaux non substituables :

- validation technique : schémas, relations, hashes, compteurs, hygiène et
  reproductibilité ;
- validation humaine nominative : responsable pédagogique et enseignant de la
  discipline concernée.

Pour les réponses courtes, une tentative soumise reste
`EN_ATTENTE_CORRECTION_MANUELLE` jusqu'à correction de chaque réponse. Une
réponse en attente n'est pas fausse et bloque score final, groupe définitif et
bilan final.

Le module Physique-Chimie Seconde reste absent. Il ne peut être ajouté qu'à
partir d'une entrée canonique complète dans `modules.json`, cinq séances, un
CPS, les hashes correspondants et les deux validations humaines.

## Contrôle

```bash
npm run pre-rentree:pedagogy:validate
npm run pre-rentree:pedagogy:verify
npm run test -- --runInBand __tests__/lib/pre-rentree/pedagogy
git ls-files '.artifacts/pre-rentree-2026/pedagogy/**'
git diff --name-only c6e055fb82216e46aab00f121f7817aed00e62ca -- public/
```

Les deux dernières commandes doivent rester sans sortie.
