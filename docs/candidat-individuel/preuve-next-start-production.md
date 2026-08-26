# Preuve `next start` — build de production réel (mission "vers un produit complet" §2)

**Constat de départ, corrigé par cette vérification** : le commit `e940fc931` affirmait que l'échec de
l'appel API observé était « une spécificité de `next dev`, jamais en production » sans l'avoir démontré sur
un build de production réel. C'est **faux à moitié** — vérifié ici avec reproduction positive, pas supposé.
La vérité, découverte par cette procédure :

1. Le flag `pricing.candidatIndividuelPipeline.state` **ne se propage pas automatiquement** au démarrage
   dans certains contextes — un vrai constat, indépendant de `next dev`/`next start`.
2. Sa cause racine réelle n'était **pas** l'isolation de modules par route en mode dev (l'explication donnée
   dans `e940fc931` était incorrecte) — c'était un **bug réel et sévère dans `/api/admin/config`**, reproduit
   à l'identique sur le build de production : **corrigé dans ce commit**.
3. Une fois ce bug corrigé, l'intégralité du parcours fonctionne, de bout en bout, sur le build de
   production réel — démontré ci-dessous avec requêtes, codes HTTP, réponses et état DB réels.
4. Une seconde limite réelle, sans rapport avec la précédente, a été découverte pendant cette vérification :
   le rôle ADMIN ne peut pas **naviguer** vers les pages `/dashboard/assistante/*` (redirection middleware
   globale vers `/dashboard/admin`) — documentée séparément ci-dessous, non corrigée (comportement
   architectural délibéré et préexistant, pas une régression de ce lot).

## Environnement de vérification

Build de production réel (`npm run build`, artefact standalone), exécuté via `node .next/standalone/
server.js` avec `NODE_ENV=production` — pas `next dev`. Infrastructure réelle, pas simulée :

- PostgreSQL jetable réel (le même conteneur `nexus-postgres-test` utilisé par tous les tests DB de cette
  session), migrations déjà appliquées.
- **Redis réel** (`redis:7-alpine`, conteneur dédié) — `RATE_LIMIT_BACKEND=redis`, le mode que la production
  exige réellement (le mode `memory` est explicitement refusé par le code en `NODE_ENV=production`,
  confirmé par `RATE_LIMIT_PRODUCTION_MEMORY_REFUSED`).
- **SMTP réel** (`mailpit`, un attrape-mails jetable) — nécessaire car le worker de purge d'emails
  (`EMAIL_OUTBOX_WORKER_ENABLED`) est requis en production par un garde-fou de démarrage indépendant.
- Utilisateur ADMIN/ASSISTANTE jetable créé directement en base (disposable), jamais via le seed de
  production (`prisma/seed.ts` refuse correctement ce nom de base — vérifié, pas contourné).
- Session réelle : connexion via le vrai formulaire `/auth/signin`, cookie JWT réel émis par NextAuth (pas
  de contournement d'authentification).

Tous les artefacts jetables (scripts, route de debug temporaire, conteneurs Redis/Mailpit) ont été supprimés
après vérification — confirmé par `git status` propre avant le commit.

## Bug réel trouvé et corrigé : `/api/admin/config` (PATCH) et son rollback

**Symptôme** : chaque `PATCH /api/admin/config` — sur N'IMPORTE QUEL namespace, pas seulement le pipeline
candidat-individuel — échouait avec une erreur 500, silencieusement (corps de réponse vide côté client).

**Cause racine, confirmée par le log serveur réel** :
```
Invalid `prisma.$queryRawUnsafe()` invocation:
Raw query failed. Code: `N/A`. Message: `Failed to deserialize column of type 'void'. ...`
code: 'P2010', clientVersion: '6.19.3'
```
`SELECT pg_advisory_xact_lock($1)` retourne `void` en PostgreSQL — `$queryRawUnsafe` tente de désérialiser
une ligne de résultat, ce que Prisma Client 6.19.3 ne sait pas faire pour une colonne `void`. **Ce n'est pas
un problème de configuration** : reproduit à l'identique en mode `next dev` (déjà observé lors du commit
précédent) **et** sur le vrai build de production (`next start`), contre le même Postgres réel — la
différence dev/prod n'explique rien ici.

**Portée réelle** : deux points d'appel identiques, tous deux corrigés :
- `app/api/admin/config/route.ts` (PATCH)
- `app/api/admin/config/rollback/route.ts` (POST)

**Correctif** : `$executeRawUnsafe` au lieu de `$queryRawUnsafe`. Le verrou (`pg_advisory_xact_lock`) reste
acquis de façon identique (l'appel bloque toujours jusqu'à obtention du verrou, dans la même transaction) —
`$executeRawUnsafe` ne tente simplement jamais de désérialiser une ligne de résultat, qui n'a jamais été
utile ici. Aucun changement de comportement fonctionnel, seulement la suppression d'une désérialisation
inutile et cassée.

**Sévérité réelle** : ce bug bloquait **l'intégralité du système d'administration de configuration**, pas
seulement le pipeline candidat-individuel — toute tentative d'activer/modifier un namespace via l'API admin
échouait. Un test manquait pour ce chemin précis (les tests unitaires existants mockaient
`$queryRawUnsafe` directement, donc ne pouvaient jamais détecter une incompatibilité avec le Postgres/Prisma
réel).

## Démonstration positive complète, sur le build de production réel

Chaque étape ci-dessous a été exécutée contre le serveur `node .next/standalone/server.js` en
`NODE_ENV=production`, avec requête, code HTTP et réponse réels.

| # | Étape | Résultat réel |
|---|---|---|
| 1 | Chargement non authentifié de la prévisualisation | Redirigé vers `/auth/signin` (HTTP 200 sur la page de connexion, `callbackUrl` correctement préservé) |
| 2 | Connexion réelle (formulaire, Redis réel) | Session établie, `finalUrl` sur le dashboard du rôle |
| 3 | Lecture du flag avant activation | `POST /simulate` → **403** (`pricing.candidatIndividuelPipeline.state` pas encore `ACTIVE_INTERNAL`) |
| 4 | **Activation via `PATCH /api/admin/config`** (chemin réel, pas un contournement DB) | **200** — `{"entry":{"...","value":"ACTIVE_INTERNAL",...}}` — la preuve directe que le correctif du verrou fonctionne |
| 5 | Prévisualisation après activation (rôle ASSISTANTE) | Page réelle chargée, "Étape 1 sur 17", session 2027 affichée — capture d'écran `step-assistante-wizard.png` |
| 6 | `POST /profils` — création `ProfilCandidat` | **201** — ligne réelle créée, `createdByUserId` renseigné |
| 7 | `GET /profils/:id` — reprise | **200** — même id retourné |
| 8 | `POST /simulate` — moteur réel | **200** — `status: "READY"`, 3 scénarios (ESSENTIEL/RECOMMANDE/COMPLET) |
| 9 | `POST /profils/:id/quote` — création du brouillon | **201** — `Quote` réelle créée, `status: "ESTIMATION"`, `regulatoryMaturity: "LEGACY_ESTIMATE_UNVERIFIED"`, **aucune fuite de `snapshotRegles` dans la réponse** (vérifié par recherche littérale dans le corps JSON) |
| 10 | Tentative d'envoi — doit être bloquée | Vérifié directement en base sur la ligne réelle créée à l'étape 9 : `regulatoryMaturity = LEGACY_ESTIMATE_UNVERIFIED` ≠ `CARTE_VALIDATED_DEFINITIVE` → `assertQuoteCanBeSent` lève `QuoteNotEmittableError` par construction (le garde-fou existant, testé exhaustivement par ailleurs, `__tests__/database/candidat-individuel-quote-creation.test.ts`) |
| 11 | Génération PDF / lien signé | **Non applicable — limite honnête, pas testée par omission.** Voir section dédiée ci-dessous. |

## Ce qui n'existe pas encore — nommé, pas caché

**Aucune route de génération PDF ni de lien signé n'existe pour un `Quote` créé par le nouveau pipeline
carte-aware.** Le flux PDF/lien signé existant (`app/devis/[token]/page.tsx`, `lib/quotes/pdf-adapter.ts`)
est câblé sur le moteur legacy (`SituationInput`/`RecommendationResult`) — il n'a jamais été étendu pour
consommer un `Quote` créé via `POST .../profils/:id/quote`. Construire ce pont est un chantier réel, non
fait par ce lot — mission §7/§13, pas encore attaqué. Ne pas confondre avec « bloqué par le garde-fou » :
ici, la route elle-même n'existe pas, ce n'est pas qu'elle refuse.

## Second constat réel, distinct : navigation ADMIN vers `/dashboard/assistante/*`

Découvert pendant cette vérification (capture `step5-flag-on.png`) : avec un utilisateur **ADMIN**, naviguer
vers `/dashboard/assistante/candidat-individuel/wizard-preview` redirige vers `/dashboard/admin` **avant**
que la page elle-même ne s'exécute — `middleware.ts` impose qu'un rôle `ADMIN` ne peut naviguer que sous
`/dashboard/admin`, quel que soit ce que la page cible autoriserait elle-même :

```ts
const rolePrefixMap = { ADMIN: '/dashboard/admin', ASSISTANTE: '/dashboard/assistante', ... };
if (pathname.startsWith('/dashboard') && !pathname.startsWith(expectedPrefix)) {
  return NextResponse.redirect(new URL(expectedPrefix, req.nextUrl));
}
```

**Conséquence honnête** : la mention « ADMIN/ASSISTANTE » dans les commits précédents décrivant l'accès à
cette surface est vraie au niveau **API** (`requireAnyRole([ADMIN, ASSISTANTE])`, vérifié en conditions
réelles : un ADMIN authentifié a bien pu appeler `/api/assistante/candidat-individuel/*` avec succès) mais
**trompeuse au niveau navigation PAGE** : un ADMIN ne peut jamais atteindre la page par un clic normal, seul
un ASSISTANTE le peut. Ce n'est pas une régression de ce lot — la même règle s'applique déjà à
`/dashboard/assistante/devis` (le workspace devis existant) et semble être une décision architecturale
délibérée et globale (« un tableau de bord par rôle »), non modifiée ici. Non corrigé : changer cette règle
globale serait hors périmètre de la mission candidat-individuel et affecterait toutes les pages du site.
Documenté pour que ce ne soit plus une découverte surprise plus tard.

## Vérification locale (hors production manuelle)

- npx tsc --noEmit : clean.
- npx eslint sur les fichiers touchés : 0 erreur (les avertissements `any`/`require()` restants sont
  pré-existants, confirmés par diff).
- Suite complète : 879 suites, 9760/9760 passing.
- `__tests__/api/admin.config.route.test.ts` : 16/16, mock aligné sur `$executeRawUnsafe`.
- `npm run build` : exit 0, artefact standalone valide.
