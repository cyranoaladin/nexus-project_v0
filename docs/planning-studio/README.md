# Nexus Planning Studio — planning hebdomadaire partagé

Outil interne de planification des cours collectifs (élèves scolarisés et candidats individuels), servi sur `/planning`, réservé au personnel connecté, avec **source de vérité côté serveur**, historique des révisions et verrou optimiste.

## Architecture

| Couche | Emplacement | Rôle |
|---|---|---|
| Source de l'outil | `tools/planning-studio/` | application HTML/CSS/JS autonome (fonctionne aussi en double-clic sur `index.html`) ; moteur métier sans DOM : `assets/core.js`, `model.js`, `validation.js` |
| Artefact servi | `public/planning/` | **généré** par `npm run planning:build` (chemins absolus `/planning/…` + `config.js` qui active le mode intégré). Ne jamais modifier à la main : `npm run planning:check` échoue si l'artefact diverge de la source |
| Moteur serveur | `lib/planning-studio/engine.ts` | charge le même moteur JS que le navigateur (imports à effet de bord) — une seule implémentation des règles |
| Validation serveur | `lib/planning-studio/validate-payload.ts` | taille, structure, schéma, normalisation (liste blanche des champs), conflits bloquants |
| Persistance | `lib/planning-studio/service.ts` | document canonique par année + révisions immuables, initialisation idempotente, verrou optimiste, restauration |
| API | `app/api/planning-studio/` | routes Node protégées par `apiGuard` et les politiques RBAC `planning-studio.*` |
| Accès page | `middleware.ts` + `lib/planning-studio/access.ts` | `/planning` et tous ses assets exigent une session ADMIN, ASSISTANTE ou COACH |
| Données | `prisma/schema.prisma` (`PlanningStudioDocument`, `PlanningStudioRevision`), migration `20260903190000_add_planning_studio` | JSONB normalisé, une ligne par révision |

### Pourquoi un document JSON plutôt qu'un modèle relationnel complet

Le planning est un tout cohérent (enseignants, salles, matières, groupes, séances, paramètres) validé globalement à chaque enregistrement. Un document JSONB versionné offre : source centrale, historique et rollback fonctionnel, import/export direct, compatibilité avec le schéma v2 de l'outil, migration additive minimale. Une normalisation relationnelle multiplierait tables et jointures sans besoin métier aujourd'hui ; elle reste possible plus tard (les identifiants sont stables).

## Flux de démarrage (mode intégré)

1. authentification (middleware) ;
2. `GET /api/planning-studio` → planning canonique, révision, permissions ;
3. le navigateur normalise, valide et affiche ;
4. modifications locales (brouillon de récupération dans `localStorage`, jamais appliqué silencieusement) ;
5. autosave (1,5 s après la dernière modification) ou bouton **Enregistrer** / `Ctrl+S` : `PUT` avec `expectedRevision` ;
6. le serveur valide (structure, conflits bloquants) et n'écrit que si la révision attendue est toujours la révision courante ;
7. nouvelle révision ; les autres clients la récupèrent (sondage toutes les 60 s, ou bouton **Actualiser**).

Le JSON livré (`tools/planning-studio/data/planning.default.json`) n'est qu'un **bootstrap** : il initialise le document lors du premier accès, puis n'est plus la source.

## Matrice des droits (barrière serveur)

| Rôle | Lire | Modifier / enregistrer | Importer | Historique | Restaurer / réinitialiser |
|---|---|---|---|---|---|
| ADMIN | oui | oui | oui | oui | oui |
| ASSISTANTE | oui | oui | oui | non | non |
| COACH | oui (lecture seule : filtres, vues, impression, export) | non | non | non | non |
| PARENT, ELEVE, anonyme | non | non | non | non | non |

Politiques RBAC : `planning-studio.read`, `planning-studio.write`, `planning-studio.history`, `planning-studio.restore` (`lib/rbac.ts`).

## API

| Méthode | Route | Politique | Réponses |
|---|---|---|---|
| GET | `/api/planning-studio` (`?meta=1` : révision seule) | read | 200 `{document, payload, permissions, viewer}` |
| PUT | `/api/planning-studio` `{expectedRevision, payload, action?: SAVE\|IMPORT\|RESET, summary?}` | write (RESET : restore) | 200 `{revision}` · 409 `PLANNING_REVISION_CONFLICT` · 422 `PLANNING_PAYLOAD_INVALID` · 400 · 403 |
| GET | `/api/planning-studio/revisions?limit=` | history | 200 `{revisions[]}` |
| GET | `/api/planning-studio/revisions/:n` | history | 200 payload de la révision |
| POST | `/api/planning-studio/restore` `{revision, expectedRevision}` | restore | 200 `{revision}` (nouvelle révision RESTORE) |

Un `409` porte la révision courante et l'auteur ; l'interface affiche « Le planning a été modifié par un autre utilisateur… » et propose de recharger ou d'exporter le brouillon. Jamais de « dernier écrivain gagne ».

## Commandes

```bash
npm run planning:gate        # syntaxe, JSON ≡ JS, schéma, 0 conflit bloquant, inventaire 45/44/1
npm run planning:check       # régénère public/planning et échoue si divergence
npm run planning:test        # tests de l'outil (moteur, migration v1→v2, exports)
npm run planning:test:unit   # validation serveur, service (double mémoire), matrice de rôles des routes
npm run planning:test:db     # PostgreSQL réel : init idempotente, verrou optimiste, restauration (DATABASE_URL requis)
npm run planning:ci          # enchaîne gate + check + test + test:unit
```

CI : `.github/workflows/planning-studio.yml` (jobs `gates` et `db`).

### Scénarios navigateur (middleware actif)

Le stack Docker E2E désactive le middleware ; les scénarios d'accès s'exécutent contre une instance locale du build standalone avec middleware, base jetable migrée et seedée (`scripts/seed-e2e-db.ts`) :

```bash
BASE_URL=http://localhost:3979 E2E_CREDENTIALS_PATH=e2e/.credentials.json \
  npx playwright test --config playwright.config.e2e.ts \
  e2e/planning-studio-access.spec.ts e2e/planning-studio-shared.spec.ts
```

`planning-studio-access.spec.ts` : anonyme, PARENT, ELEVE refusés sur `/planning` et chaque asset ; ADMIN, ASSISTANTE, COACH servis ; retour après connexion via `callbackUrl`.
`planning-studio-shared.spec.ts` : état partagé, 409 sans perte, COACH lecture seule (UI et API forgée), historique et restauration, autosave.

## Migration

`20260903190000_add_planning_studio` est strictement additive (un type énuméré, deux tables, index et clés étrangères vers `users` en `SET NULL`). Rollback logique : `DROP TABLE planning_studio_revisions, planning_studio_documents; DROP TYPE "PlanningStudioAction";` puis `prisma migrate resolve --rolled-back`. Aucune donnée existante n'est touchée.

Initialisation : au premier `GET`, le document est créé depuis le planning livré (révision 1, action `INIT`). L'opération est idempotente (contrainte d'unicité sur l'année scolaire + reprise en cas de course).

## Mettre à jour l'outil

1. modifier `tools/planning-studio/` (source) ; en cas de changement des données livrées, régénérer `data/default-data.js` avec `node tools/planning-studio/tests/build-default-data.mjs` ;
2. `npm run planning:build` puis committer `public/planning` ;
3. `npm run planning:ci`.
