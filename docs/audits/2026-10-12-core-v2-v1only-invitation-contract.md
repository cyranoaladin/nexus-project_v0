# Contrat d'invitation et d'autorisation Core v2 sous `V1_ONLY`

## Date

2026-10-12

## Contexte

Préparation du go-live Core v2 sous `CORE_V2_AUTH_MODE=V1_ONLY`. Dans ce mode,
Core v1 est la **seule** autorité sur les mots de passe, les hachages bcrypt, les
activations, les réinitialisations, les sessions et les révocations. Core v2 ne
doit jamais recevoir, stocker ni hacher un mot de passe.

L'accès effectif exige les **trois** facteurs, indépendants :

> V1 authentifié **et actif** · adhésion Core **ACTIVE** · capacité Core **accordée**

Décisions produit appliquées : aucune propagation automatique Core → V1 ni
V1 → Core ; l'action d'interface est renommée pour nommer ce qui est réellement
suspendu (l'**accès Core v2**) ; le premier ADMIN Core est rattaché à un ADMIN V1
existant par une commande hors ligne, jamais par un endpoint HTTP.

Périmètre : 37 commits, 69 fichiers, +6 616 / −253 lignes.

## Problèmes observés

### Autorisation et ordre

- `assertAccountEmailHandoffRuntimeConfiguration()` était la première
  instruction du handler d'invitation, donc exécutée **avant** toute
  vérification de capacité. Sous `V1_ONLY` elle lève, ce qui produisait un
  **503 pour tous les rôles** — y compris un acteur authentifié, actif mais non
  autorisé, qui doit recevoir 403. Un 503 masquait une décision d'autorisation.
- Un rôle non invitable était refusé **après** le court-circuit `ACTIVE` : un
  ADMIN V1 actif renvoyait `ACTIVE_LINKED`, et la saga amenait donc un acteur
  Core ADMIN à `ACTIVE` — atteignable avec `ACCOUNT_INVITE`, que porte
  ASSISTANTE. Troisième occurrence du même motif : un court-circuit placé avant
  un refus de politique annule ce refus.
- Le même refus n'existait que sur le chemin d'émission, alors que le worker
  passe aussi par `inspect` dans trois états avant de provisionner Core.
- `credentials-authorize.ts` n'imposait pas `disabledAt` sur le chemin e-mail.
- Un oracle d'existence subsistait sur la lecture d'un bilan publié.

### Données privées

- La branche **idempotente** de l'envoi de document renvoyait la ligne Prisma
  brute, donc `storageKey` — le chemin disque privé du dépôt d'un mineur. La
  branche 201, trente lignes plus loin, projetait huit champs. Le test existant
  générait toujours un `clientMutationId` neuf : la branche fautive n'était
  jamais exercée.
- La garde de frontière HTTP bornait sa récursion et **retournait** au-delà :
  une clé privée enfouie plus profond sortait sans être vue.

### Amorçage du premier ADMIN

- L'empreinte du manifeste ne couvrait **pas** les champs imbriqués :
  `JSON.stringify(x, tableau)` applique sa liste blanche récursivement, donc
  `expectedV1State` se sérialisait en `{}`. Mesuré — un état V1 entièrement
  falsifié produisait la même empreinte.
- `finalSha` était parsé, empreinté, documenté comme liant, et comparé à rien.
- L'état V1 déclaré n'était jamais confronté à l'état lu.
- Le rollback faisait un `deleteMany` : un identifiant de reçu erroné supprimait
  zéro ligne, l'acteur était quand même supprimé, et la commande annonçait un
  succès en laissant une trace contradictoire.
- L'en-tête promettait une exclusivité fausse : `sync-staff-actors --execute`
  crée aussi un ADMIN Core, sans manifeste.

### Intégrité des outils de vérification

- Cinq tests ajoutés par cette mission **ne pouvaient pas échouer** : une route
  jamais importée, une garde qui s'évaluait sur une chaîne vide après un
  renommage, un `slice(0, 25)` long de 25 par construction, une assertion qui
  testait une propriété de JavaScript, et une restauration d'environnement qui
  écrivait la chaîne `"undefined"`.
- Deux jobs CI échouaient pour une cause unique : le programme TypeScript
  dépassait le tas par défaut des runners (`JavaScript heap out of memory`), et
  l'instrumentation ajoutée pour diagnostiquer l'opacité du job aggravait le
  problème en désactivant le cache incrémental.
- Un test lié à bcrypt tournait sur le défaut Jest de 5 s alors qu'il enchaîne
  quatre opérations à coût 12 plus deux rejeux de cohorte.

## Décisions prises

1. **Ordre d'autorisation** — la capacité est vérifiée avant toute consultation
   d'infrastructure ; les services la réaffirment en défense en profondeur ;
   l'ordre est prouvé par un test qui pilote réellement les routes.
2. **Refus symétrique** — un rôle non invitable est refusé aux **deux** points
   d'entrée de la saga, avec le même code.
3. **Projection positive** — une seule liste de champs publics gouverne les deux
   branches de réponse, appliquée à la fois en `select` et à la frontière : deux
   protections indépendantes.
4. **Garde qui refuse** — la borne de profondeur lève au lieu de retourner.
5. **Manifeste réellement liant** — sérialisation canonique à toute profondeur,
   et chaque liaison annoncée (release, base, tête de migrations, état V1,
   capacité, expiration) est comparée à l'environnement. L'absence d'identité de
   release refuse.
6. **Rollback qui compense** — le reçu doit exister et porter la bonne action ;
   un événement de compensation est écrit, pour ne pas supprimer la seule trace
   de ce qui est annulé.
7. **Migration 0027 en deux temps** — `NOT VALID` puis `VALIDATE`, comme 0025 et
   0026, pour ne pas tenir `ACCESS EXCLUSIVE` pendant le balayage. La rigueur
   reste au contrôle préalable, qui refuse par un nom d'erreur explicite avant
   toute écriture.
8. **Tas TypeScript posé une seule fois**, dans le script `typecheck`, dont tous
   les appelants héritent. Le seuil reste à zéro erreur.
9. **Budgets de test explicites au point d'appel**, motivés par une mesure, selon
   la convention déjà en vigueur dans le fichier concerné. Ni retry, ni skip.

## Fichiers modifiés

28 fichiers de tests, 23 sous `lib/`, 6 sous `app/`, 3 scripts, 2 migrations,
1 workflow CI, 1 composant. Principaux :

- `lib/core-v2/accounts/bootstrap-v1-admin.ts`, `scripts/core-v2/bootstrap-v1-admin.ts`
- `lib/core-v2/accounts/v1-authority.ts`, `lib/core-v2/accounts/v1-provisioning.ts`
- `lib/core-v2/http/private-path-guard.ts`, `lib/core-v2/http/respond.ts`
- `lib/core-v2/services/diagnostics.ts`, `lib/core-v2/services/diagnostic-bilan.ts`
- `lib/auth/credentials-authorize.ts`, `lib/auth/v1-account-invitation.ts`
- `lib/bilans/staff/parent-contact-service.ts`
- `app/api/diagnostics/candidat-libre/[diagnosticId]/documents/route.ts`
- `core-v2/prisma/migrations/0027_core_v2_job_outbox_aria_closed_key_set/`
- `components/dashboard/core-v2/AccountActions.tsx`
- `.github/workflows/ci.yml`, `package.json`, `jest.unit.config.js`

## Tests exécutés

| Lane | Résultat |
|---|---|
| `jest.core-v2.config.js` | 94 suites, 1 046 tests — verts |
| `jest.core-v2-authjs.config.js` | 1 suite, 4 tests — verts |
| `jest.unit.config.js` | 1 429 suites, 16 325 tests — verts |
| `npm run typecheck` | 0 erreur |
| `npm run lint` | 0 erreur |
| `scripts/testing/check-ci-test-lane-coverage.mjs` | aucun fichier orphelin sur 1 865 |

Preuves sur base PostgreSQL réelle, 27 migrations appliquées : contrainte
`core_v2_job_outbox_payload_check` **validée** (`convalidated = t`), charge
hostile portant une clé supplémentaire **refusée**, charge légitime acceptée.

Phase Zero reconstruite sur le SHA candidat, arbre propre : **82 contrôles,
0 échec** ; 27 migrations et 27 checksums ; second passage no-op prouvé
(`No pending migrations`) ; dérive migrations ≡ schéma nulle.

Scans : `npm audit --omit=dev` → **0 vulnérabilité, toutes sévérités** (avec les
dépendances de développement : 19 modérées, 0 HIGH/CRITICAL, racine unique dans
la chaîne Jest). gitleaks et TruffleHog → **aucun secret réel** ; toutes les
détections qualifiées une par une (empreintes SHA-256, propriétés `key:`,
vecteur de test JWT à dérivation publique documentée, DSN d'exemple,
`node_modules`).

Contrôles positifs exécutés sur les corrections de sécurité : chaque test
nouvellement écrit a été vérifié **en retirant la correction**, et il échoue bien
dans ce cas.

## Résultats

Le contrat `V1_ONLY` est tenu sur les chemins mesurés : aucune écriture, lecture
recopiée ni hachage de credential depuis Core v2 ; `assertCoreMayHoldCredentials()`
est la première instruction des six fonctions de credential de Core v2 ; toutes
les écritures de credential V1 restent dans `lib/auth/**`.

Une revue indépendante a été conduite sur le HEAD final, avec pour consigne
explicite de chercher les tests vacants. Ses constats confirmés ont tous été
traités, et ses constats plausibles vérifiés un par un avant décision.

## Risques restants

1. **Images conteneur — en attente d'arbitrage.** Les 7 images gouvernées
   `REQUIRED_CI` portent des CVE OS corrigibles à leur digest épinglé (jusqu'à
   53 HIGH et 13 CRITICAL). Rafraîchir l'épinglage ne suffit pas : sur
   `pgvector:pg16`, le digest courant amont n'efface que 3 HIGH sur 44 et aucun
   CRITICAL. **Aucune de ces images ne porte le trafic de production** (release
   servie par PM2 sur l'hôte) : la mesure concerne l'infrastructure de build et
   de test. Trois voies proposées à l'owner, recommandation = acter la mesure
   pour l'infrastructure de test en la consignant dans le manifeste de
   gouvernance, le seuil restant appliqué au code et aux dépendances de
   production.
2. **Ordre de go-live non contraint.** `sync-staff-actors --execute` crée un
   ADMIN Core sans manifeste. Si cette commande passe avant l'amorçage, ce
   dernier refuse (`BOOTSTRAP_CLOSED`). L'ordre appartient à la procédure ;
   aucun mécanisme ne l'impose.
3. **Acteur amorcé sans e-mail ni noms.** `email` est nullable côté Core v2 ;
   la synchronisation comble ensuite l'écart, mais une interface staff lisant
   l'e-mail de l'acteur verra `null` d'ici là.
4. **Oracle temporel assumé.** Le refus d'un compte désactivé court-circuite
   avant `bcrypt.compare`, donc le temps de réponse distingue « compte
   désactivé » de « mot de passe faux ». C'est pinné comme intentionnel, et de
   même forme que le contrôle `mergedIntoUserId` préexistant.

## Rollback

- **Code** : la branche est additive sur les migrations (`0026`, `0027` — jamais
  de down-migration) ; revenir au SHA `main` précédent suffit pour le code.
- **Amorçage** : `bootstrap-v1-admin --manifest=<chemin> --rollback=<receiptId>`
  retire l'acteur amorcé et son reçu, refuse si l'acteur a déjà agi, et écrit un
  événement de compensation.
- **Activation** : les scripts d'activation et de rollback sont préparés
  séparément et sortent en `exit 99` tant qu'ils ne sont pas explicitement
  autorisés.
- **Base Core** : jamais supprimée ; aucune modification directe de
  `_prisma_migrations`.
