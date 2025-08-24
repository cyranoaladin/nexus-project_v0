# Plan d’actions: Quick Wins (1–2 jours) vs Stabilisation (1–2 semaines)

## Quick Wins (1–2 jours)

1. Exiger NEXTAUTH_SECRET en production
    - Action: Modifier lib/auth.ts pour throw si !NEXTAUTH_SECRET && NODE_ENV==='production'.
    - Impact: Sécurité sessions JWT.

2. Sécuriser Webhook Konnect (MVP)
    - Action: Vérifier signature HMAC avec KONNECT_WEBHOOK_SECRET et refuser si invalide; ajouter contrôle d’idempotence (clé unique transaction).
    - Fichiers: app/api/webhooks/konnect/route.ts.
    - Impact: Bloque attaques replay/forgery.

3. Paiements: ne pas accepter "amount" du client
    - Action: Dans app/api/payments/konnect/route.ts, résoudre le prix côté serveur depuis itemKey.
    - Impact: Empêche manipulation des montants par client.

4. Nettoyage secrets/devenv
    - Action: Retirer env.txt du dépôt ou renommer en env.local.example; s’assurer .env* ignorés.
    - Impact: Réduction risque fuite.

5. Lint/Format de base
    - Action: Ajouter Prettier, eslint-config-prettier, scripts lint:fix/format, retirer ignoreDuringBuilds en CI.
    - Impact: Qualité de code conforme règles.

6. Couverture minimale 85%
    - Action: Ajouter coverageThreshold dans jest.config.js; faire échouer CI sous 85%.
    - Impact: Conformité règle couverture backend.

7. OPENAI_MODEL configurable
    - Action: lib/aria.ts → modèle via process.env.OPENAI_MODEL avec fallback.
    - Impact: Flexibilité/alignement doc.

## Stabilisation (1–2 semaines)

1. Migration complète vers PostgreSQL
    - Actions:
        - Mettre datasource Postgres dans prisma/schema.prisma
        - Re-générer migrations et données seed.
        - Adapter champs JSON string → JSONB si applicable, ajouter index GIN, index clés de jointure.
    - Tests: e2e/integration sur Postgres docker.

2. CI/CD complet (GitHub Actions)
    - Pipeline: lint → test (unit/int/E2E Chromium) → audit → build → build image Docker → push registry → tag SemVer → déploiement (staging/prod) → rollback.
    - Ajout job check-config pour variables requises.

3. Observabilité
    - Intégrer pino pour logs structurés; Sentry pour erreurs.
    - Ajouter endpoint /api/health complet.

4. Sécurité HTTP et rate limiting
    - Middleware: headers de sécurité (CSP/HSTS/X-Frame-Options), rate limiting (Upstash Redis ou simple token bucket).

5. Paiements production
    - Intégrer vrai appel Konnect (init session), pages success/fail, signature webhook, idempotency exhaustive, audit trail.

6. Accessibilité et Storybook
    - Ajouter eslint-plugin-jsx-a11y, tests axe (CI optionnelle); mise en place Storybook pour UI.

7. Performance
    - Activer optimisation images en prod; analyser bundle; activer cache headers (ISR/revalidate) où pertinent.

## Dépendances & rôles

- DevOps: CI/CD, Docker/NGINX, secrets.
- Backend: Prisma/Postgres, routes API, paiements, webhooks.
- Frontend: a11y, Storybook, optimisations.
- QA: Couverture, E2E stables.
