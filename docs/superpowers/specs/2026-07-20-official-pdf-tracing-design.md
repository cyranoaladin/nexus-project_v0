# Conception — traçage de production des PDF officiels

## Contexte

La route `GET /api/student/resources/official/[slug]` lit un PDF privé après
authentification et contrôle du profil élève. Elle construit actuellement son
chemin avec trois segments dont deux sont dynamiques :

```ts
join(process.cwd(), pdfMetadata.baseDir, pdfMetadata.filename)
```

Le traceur de fichiers de Next.js ne peut pas borner cette expression. Il
interprète donc le répertoire du projet comme racine possible et ajoute presque
tout le dépôt au manifeste de la route. Le manifeste observé contient 2 932
références, dont 1 667 vers des éléments interdits par l'audit de production
(`.git`, `__tests__`, `e2e`, Dockerfiles, etc.). Une route comparable avec un
chemin statique ne trace que 58 fichiers.

## Objectif

Limiter le traçage dynamique aux fichiers placés sous `programmes/`, sans
affaiblir les validateurs de traces ou d'artefact et sans modifier les règles
d'authentification, d'autorisation ou de cache de la route.

Le résultat est accepté lorsque :

- toute métadonnée PDF produit un chemin relatif strictement contenu sous
  `programmes/` ;
- les métadonnées qui tentent de sortir de cette racine sont rejetées ;
- l'appel `readFile` reste alimenté par un chemin dont le préfixe
  `process.cwd()/programmes` est statiquement visible par le traceur ;
- les tests de la route et du résolveur passent ;
- `npm run build` réussit dans l'étape Docker `builder`, audits compris.

## Hors périmètre

- peupler le registre `OFFICIAL_PDFS`, actuellement vide ;
- rendre les PDF directement accessibles dans `public/`, ce qui contournerait
  les contrôles d'accès ;
- migrer les ressources vers S3 ou un autre stockage objet ;
- relâcher les règles de `validate-next-traces.js` ou
  `audit-production-artifact.js`.

## Options évaluées

### 1. Racine statique et chemin relatif validé — retenue

Un helper transforme `baseDir` et `filename` en chemin relatif sous
`programmes/`. La route joint ensuite ce résultat à
`join(process.cwd(), 'programmes', relativePath)`.

Cette solution corrige la cause du glob global, conserve les PDF hors de
`public/` et ajoute une défense contre les traversées de chemin.

### 2. Exclusions `outputFileTracingExcludes`

Cette option retirerait manuellement les répertoires interdits du manifeste.
Elle est rejetée car elle masque le glob excessif, nécessite une liste fragile
et peut omettre une nouvelle catégorie sensible.

### 3. Stockage objet

Cette option éliminerait la lecture locale, mais introduirait un changement
d'architecture, des secrets, un client réseau et une migration de données. Elle
est disproportionnée pour le blocage actuel.

## Architecture retenue

### Résolveur de chemin

Créer `lib/programme/official-pdf-path.ts` avec une fonction pure :

```ts
resolveOfficialPdfRelativePath(metadata: OfficialPdfMetadata): string
```

La fonction :

1. interprète `baseDir` et `filename` comme des segments POSIX issus du registre ;
2. exige que `baseDir` soit `programmes` ou commence par `programmes/` ;
3. retire ce préfixe pour obtenir un chemin relatif à la racine autorisée ;
4. normalise le chemin ;
5. rejette les chemins absolus, vides ou commençant par `..` ;
6. retourne uniquement le chemin relatif interne.

Le helper ne fait aucun accès disque et ne dépend pas de l'environnement.

### Route

La route conserve tous ses contrôles actuels. Après validation de la métadonnée,
elle construit le chemin final directement dans le module de route :

```ts
const filePath = join(
  process.cwd(),
  'programmes',
  resolveOfficialPdfRelativePath(pdfMetadata),
);
```

Le segment statique `programmes` borne l'analyse de `node-file-trace`. Le helper
séparé garde la validation testable sans cacher au traceur le préfixe statique.

## Flux et erreurs

Le flux HTTP reste : authentification → profil → whitelist du slug → métadonnée
→ contrôle niveau/voie → validation du chemin → `stat` → `readFile` → réponse
PDF privée.

Une métadonnée invalide est une erreur de configuration serveur. Elle est
capturée par le bloc externe existant et produit une réponse 500 générique, sans
exposer de chemin local au client. Les logs passent toujours par
`serializeError`.

## Stratégie de tests

Le développement suit TDD :

1. tests unitaires du helper pour un sous-répertoire valide, la racine
   `programmes`, un `baseDir` hors racine et des traversées via le nom de fichier ;
2. exécution en rouge avant création du helper ;
3. implémentation minimale ;
4. tests de la route, TypeScript, lint et scans de sécurité ;
5. suite Jest complète sous Node 22.23.1 ;
6. build Docker `builder`, puis inspection du manifeste pour confirmer que les
   références ne couvrent plus le dépôt complet et que les audits restent
   bloquants.

## Publication

La correction est livrée dans un commit fonctionnel distinct après le commit de
la présente spécification. Elle est poussée sur
`fix/lockfix-node22-deps`, sans création de PR ni déploiement.
