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

- toute métadonnée PDF produit un chemin lexicalement contenu sous
  `programmes/` ;
- les métadonnées qui tentent de sortir de cette racine sont rejetées ;
- l'appel `readFile` reste alimenté par un chemin dont le préfixe
  `process.cwd()/programmes` est statiquement visible par le traceur ;
- les tests de la route et du résolveur passent ;
- le builder reçoit explicitement le SHA de release malgré l'exclusion de
  `.git` du contexte Docker ;
- `npm run build` réussit dans l'étape Docker `builder`, audits compris ;
- l'image runner finale contient `/app/release-manifest.json`, marqué vérifié
  et portant exactement le SHA fourni au build.

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

La fonction valide les valeurs brutes avant toute normalisation :

1. `baseDir` et `filename` doivent être non vides et ne contenir ni caractère
   NUL ni antislash ;
2. `baseDir` doit être exactement `programmes` ou commencer par
   `programmes/` ; `programmes-malicious` est donc refusé ;
3. chaque segment POSIX de `baseDir` doit être non vide et différent de `.` et
   `..` ; les séparateurs répétés, les traversées et les chemins absolus sont
   refusés au lieu d'être corrigés silencieusement ;
4. `filename` doit être un basename POSIX strict : il ne peut contenir ni `/`
   ni sous-répertoire, et ne peut être `.` ou `..` ;
5. le préfixe `programmes` est retiré de `baseDir`, puis le sous-répertoire
   validé et `filename` sont joints avec `path.posix.join` ;
6. le résultat retourné est non vide, relatif et ne commence jamais par `..`.

Le helper ne fait aucun accès disque et ne dépend pas de l'environnement.

Cette garantie est volontairement **lexicale**. Les liens symboliques sont
interdits dans l'artefact de production par `audit-production-artifact.js`, qui
parcourt l'arbre standalone et bloque tout symlink. Le changement ne prétend
pas sécuriser un checkout de développement contenant volontairement un symlink
sous `programmes/` ; la combinaison validation lexicale + audit sans symlink est
la garantie de production.

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

### Provenance du build Docker

Le gate `verify-standalone-artifact.mjs` exige `RELEASE_SHA`. Comme `.git` est
volontairement absent du contexte Docker, le `Dockerfile` déclare sans valeur
par défaut `ARG RELEASE_SHA` dans l'étape `builder`. Avant le build, il exige un
hash Git hexadécimal de 40 ou 64 caractères, puis transmet la valeur uniquement
au processus `npm run build`. Les valeurs vides, `unknown`, non hexadécimales ou
de mauvaise longueur échouent avant la compilation.

Le SHA n'est pas conservé comme variable d'environnement du runner. Le gate
l'inscrit dans `/app/release-manifest.json` de l'étape builder, puis le
`Dockerfile` copie ce fichier à la racine de l'image runner. La provenance reste
donc consultable dans l'image finale sans devenir une variable d'environnement.

La commande de vérification fournit
`--build-arg RELEASE_SHA="$(git rev-parse HEAD)"`. `.dockerignore` doit continuer
d'exclure `.git`. Aucun fallback fictif ou valeur `unknown` n'est autorisé.

## Flux et erreurs

Le flux HTTP reste : authentification → profil → whitelist du slug → métadonnée
→ contrôle niveau/voie → validation du chemin → `stat` → `readFile` → réponse
PDF privée.

Une métadonnée invalide est une erreur de configuration serveur. Elle est
capturée par le bloc externe existant et produit une réponse 500 générique, sans
exposer de chemin local au client. Les logs passent toujours par
`serializeError`. Le rejet intervient avant tout appel à `stat` ou `readFile`.

## Stratégie de tests

Le développement suit TDD :

1. créer `__tests__/lib/programme/official-pdf-path.test.ts` avec des cas
   tabulaires pour la racine valide, un sous-répertoire valide,
   `programmes-malicious`, un chemin absolu, des segments `.`/`..`, des
   séparateurs répétés, un antislash, un nom vide et un nom contenant un
   sous-répertoire ;
2. exécution en rouge avant création du helper ;
3. implémentation minimale ;
4. ajouter à `__tests__/api/student.resources.official.route.test.ts` un cas de
   métadonnée invalide qui vérifie le statut 500, le corps générique sans chemin
   local, l'appel à `serializeError` et l'absence d'appel à `stat`/`readFile` ;
5. ajouter à `__tests__/config/deploy-contract.test.ts` un test qui vérifie
   `.git` dans `.dockerignore`, `ARG RELEASE_SHA` sans défaut dans le builder,
   la validation hexadécimale 40/64, l'absence de `ENV RELEASE_SHA` dans le
   runner et la copie de `release-manifest.json` ; observer son échec, puis
   modifier le `Dockerfile` ;
6. exécuter les tests de la route, TypeScript, lint et scans de sécurité ;
7. exécuter la suite Jest complète sous Node 22.23.1 ;
8. construire l'image Docker finale, extraire son `release-manifest.json` et
   vérifier `ARTIFACT_VERIFIED=true` ainsi que le SHA exact, puis inspecter
   précisément
   `.next/server/app/api/student/resources/official/[slug]/route.js.nft.json` :
   le manifeste doit contenir au plus 500 références, zéro référence correspondant
   aux motifs interdits par `validate-next-traces.js`, et au moins un PDF sous
   `programmes/` ; `validate-next-traces.js` et
   `audit-production-artifact.js` doivent tous deux retourner un succès.

## Publication

La correction est livrée dans un commit fonctionnel distinct après le commit de
la présente spécification. Elle est poussée sur
`fix/lockfix-node22-deps`, sans création de PR ni déploiement.
