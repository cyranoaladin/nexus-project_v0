# Planning Studio — rapport de convergence Git (lecture seule)

Établi le 3 septembre 2026. Ce rapport ne modifie rien : il cartographie ce qui devra être rejoué lorsque la convergence générale PROD → MAIN sera menée (chantier distinct).

## Identités

```text
MAIN_HEAD=ed0aa55368a000c9920be347df9efdbde8a5cedf   (origin/main)
PROD_BASE=0c7c894cb2c1a3dd1283f4f5bad25404e89a9a0b   (lignée de production, parent du Planning Studio)
PLANNING_FEATURE_SHA_1=7d114621d9510b7a048fea388614c681a5b04cda   (accès /planning, middleware, liens, artefact statique)
PLANNING_MANIFEST_SHA_1=f1aa92d1a8c24f968b1351656516cc41bbf88059  (manifeste de release — provenance, ne pas rejouer)
PLANNING_FEATURE_SHA_2=9b00ff18b2ec60dab8b3a5a9caf4890f82d609e7   (persistance partagée, RBAC, CI, tests)
PLANNING_MANIFEST_SHA_2=<manifeste de la release persistance — provenance, ne pas rejouer>
MERGE_BASE(main, prod_base)=1641a69d0cfc94828d395fd0742cbe1cd02598b4
AHEAD_BEHIND(prod_base...main)=1498/1751
```

La lignée de production et `main` divergent de 1 498 commits d'un côté et 1 751 de l'autre. `main` compte 92 dossiers de migrations Prisma contre 87 sur la lignée de production, et la base de production contient une migration absente de la lignée (`20260830150000_add_lva_lvb_languages`, appliquée le 30 août). Le Planning Studio n'est pas concerné par cette dérive (sa migration est additive et indépendante), mais elle confirme qu'aucun `git merge main` ni PR directe n'est envisageable sans stratégie.

## Commits portables (fonctionnels)

| Commit | Rôle | À rejouer |
|---|---|---|
| `7d114621d` | accès `/planning`, middleware, réécriture, liens tableaux de bord, artefact statique v1 | oui |
| `9b00ff18b` | source canonique + génération, persistance (schéma, migration, service, API), RBAC, client intégré, tests, CI, docs | oui |
| `f1aa92d1a`, manifeste 2 | `release-manifest.json` uniquement | non (provenance) |

## Fichiers portés

```text
PLANNING_PORTABLE_FILES=
  tools/planning-studio/**                      (source de l'outil)
  public/planning/**                            (généré : régénérer sur la cible avec npm run planning:build)
  scripts/planning/build-public.mjs, gate.mjs
  lib/planning-studio/{access,engine,service,validate-payload}.ts
  app/api/planning-studio/**                    (4 routes + _shared)
  prisma/migrations/20260903190000_add_planning_studio/migration.sql
  prisma/schema.prisma                          (2 modèles, 1 enum, 2 relations sur User — bloc additif)
  lib/rbac.ts                                   (4 politiques planning-studio.* — bloc additif)
  middleware.ts                                 (import + 2 blocs : chemin protégé, contrôle de rôle)
  next.config.mjs                               (rewrites /planning → /planning/index.html)
  app/dashboard/assistante/page.tsx, app/dashboard/admin/page.tsx   (un lien chacun)
  package.json                                  (scripts planning:*)
  __tests__/lib/planning-studio/**, __tests__/api/planning-studio.route.test.ts, __tests__/database/planning-studio.db.test.ts
  e2e/planning-studio-access.spec.ts, e2e/planning-studio-shared.spec.ts
  .github/workflows/planning-studio.yml
  docs/planning-studio/**
PLANNING_DB_MIGRATIONS=20260903190000_add_planning_studio (additive : CREATE TYPE + 2 CREATE TABLE + index + FK vers users)
```

## Candidats à conflit lors du rejeu sur `main`

Fichiers touchés par le Planning Studio **et** modifiés sur `main` depuis la base de fusion :

```text
CONFLICT_CANDIDATES=
  middleware.ts                    (blocs additifs faciles à réappliquer à la main)
  next.config.mjs                  (ajout d'une fonction rewrites ; vérifier qu'aucune n'existe déjà sur main)
  lib/rbac.ts                      (bloc de 4 politiques ; conflit textuel probable, résolution triviale)
  prisma/schema.prisma             (bloc additif en fin de fichier + 2 lignes dans User)
  app/dashboard/assistante/page.tsx, app/dashboard/admin/page.tsx   (un lien ; réappliquer à la main si le composant a changé)
  package.json                     (scripts)
  release-manifest.json            (ne pas porter)
```

Tous les autres fichiers sont nouveaux et ne peuvent pas entrer en conflit.

## Stratégie de rejeu recommandée

```text
RECOMMENDED_REPLAY_STRATEGY=cherry-pick sélectif des deux commits fonctionnels (7d114621d puis 9b00ff18b) sur la branche canonique issue de la convergence, en excluant les manifestes ; puis npm run planning:build (régénération de public/planning sur la cible) et npm run planning:ci ; migration à conserver telle quelle (horodatage 20260903190000 postérieur aux 92 migrations de main) ; vérifier prisma migrate status sur une copie de la base cible avant déploiement.
```

Points d'attention : sur `main`, `middleware.ts` et `lib/rbac.ts` ont évolué ; réappliquer les blocs à la main plutôt que de forcer une résolution automatique. La matrice de rôles est entièrement testée (`__tests__/api/planning-studio.route.test.ts`, `e2e/planning-studio-*.spec.ts`) : ces tests sont la preuve à rejouer après le portage.
