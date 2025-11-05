# Plan de montée de version `next-auth`

## Contexte

- Vulnérabilité `cookie` (GHSA-pxg6-pf52-xh8x) propagée via `@auth/core` et `next-auth` (niveau "low").
- Correctif disponible en `next-auth` `>= 4.24.7` (rupture potentielle de compatibilité semver-major).
- Objectif : planifier une montée de version contrôlée sans impacter les parcours d'authentification.

## Préparation (Audit de compatibilité)

1. Lire les notes de version `next-auth` 4.24.7+ et identifier les breaking changes.
2. Cartographier les points d'intégration :
   - Pages/sign-in/out custom (`app/auth/`).
   - Callbacks (`lib/auth.ts`).
   - Configuration OAuth/credentials dans Prisma.
3. Vérifier les dépendances connexes : `@auth/core`, adaptateurs Prisma, fournisseurs OAuth.
4. Épingler les variables d'environnement sensibles (`NEXTAUTH_SECRET`, providers).
5. Préparer un plan de rétrogradation (réinstallation de la version actuelle) en cas de régression.

## Étapes d'implémentation

1. **Créer une branche** `chore/upgrade-next-auth-4-24-7`.
2. Mettre à jour `package.json` : `next-auth` `^4.24.7` (et `@auth/core` si requis).
3. Régénérer `package-lock.json` via `npm install`.
4. Revue rapide des fichiers suivants pour ajustements breaking changes :
   - `lib/auth.ts` (callbacks, session strategy, `jwt` config).
   - Pages/App Router sous `app/auth/`.
   - Toute logique custom NextAuth (`middleware.ts`).
5. Documenter dans le PR :
   - Breaking changes traités.
   - Tests exécutés.
   - Recommandations de déploiement.

## Validation & Tests

- `npm run lint`
- `npm run test:unit` et `npm run test:integration`
- `npm run test:e2e` (ou workflow Playwright) en se focalisant sur :
  - Création de compte / connexion via e-mail.
  - Connexions OAuth en sandbox.
  - Gestion des sessions prolongées (`remember me`, refresh tokens).
  - Flots sécuritaires (redirection si session expirée).
- Vérifier manuellement en local :
  - Inscription + connexion standard.
  - Déconnexion, réauthentification.
  - Accès aux routes `middleware` protégées (`/dashboard`, `/session`).

## Déploiement

1. Fusionner le PR quand la QA est validée.
2. Déployer en pré-production.
3. Surveiller les métriques d'erreurs (AuthAdapter Prisma, HTTP 401).
4. Déployer en production pendant une fenêtre à faible trafic.

## Rollback

- Revenir au commit précédent.
- Réinstaller l'ancienne version `next-auth` via `npm install next-auth@<version précédente>`.
- Redéployer.

## Suivi des workflows CI/E2E

- Surveiller les pipelines via l'onglet GitHub Actions.
- Pour un suivi en direct :
  ```bash
  gh run list --workflow Tests --limit 1
  gh run watch <run_id>
  gh run watch <run_id> --job <job_id>
  ```
- Cibler prioritairement les workflows : `Tests`, `CI`, `E2E (Playwright)`.

## Prochaines étapes

- Programmer la montée de version lors du prochain créneau de maintenance dépendances.
- Créer une carte de travail dédiée (issue/board) avec ce plan comme référence.
