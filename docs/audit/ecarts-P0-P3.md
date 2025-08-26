# Grille d’écarts détaillée (P0 → P3)

Contexte: référentiel Next.js 14 + Prisma. Références exactes aux fichiers et lignes observées.

Notation:

- P0: Bloquant prod / sécurité
- P1: Qualité/robustesse forte
- P2: Observabilité/fiabilité
- P3: Perf/DX/a11y

## P0 — Bloquants sécurité/production

1. Webhook Konnect non signé et non idempotent
   - Fichier: app/api/webhooks/konnect/route.ts
   - Lignes: 4–16 (lecture body, aucune vérif signature), 41–117 (effets de bord sans idempotence)
   - Écart: Pas de vérification HMAC (KONNECT_WEBHOOK_SECRET), aucun contrôle d’idempotence (replay possible).

2. Incohérence BDD: Prisma sur SQLite alors que la prod vise PostgreSQL
   - Fichier: prisma/schema.prisma
   - Lignes: 8–11
   - Écart: provider = "sqlite" et url = "file:./dev.db" vs docker-compose/env.example qui pointent Postgres.

3. Secret NextAuth généré dynamiquement si absent
   - Fichier: lib/auth.ts
   - Lignes: 8–21 (generateSecret), 23–26 (utilisation)
   - Écart: En prod, un secret aléatoire à chaque boot invaliderait des sessions JWT et est contraire aux bonnes pratiques.

4. Identifiants par défaut et DNS codés en dur dans docker-compose
   - Fichier: docker-compose.yml
   - Lignes: 9 (POSTGRES_PASSWORD par défaut), 34–36 (DNS 8.8.8.8/8.8.4.4), 38 (DATABASE_URL incluant mot de passe par défaut)
   - Écart: MDP par défaut inacceptable en prod; DNS forcés non souhaitables.

5. Acceptation d’un montant côté client pour les paiements Konnect
   - Fichier: app/api/payments/konnect/route.ts
   - Lignes: 7–13 (schema inclut amount), 46–63 (création Payment avec montant du client)
   - Écart: Le prix ne doit jamais venir du client; doit être résolu côté serveur (itemKey → tarif).

## P1 — Qualité / robustesse

1. CI/CD absent, aucune garantie de lint/tests/build
   - Fichiers: (manquants) .github/workflows/\*
   - Écart: Règle utilisateur CI/CD non respectée.

2. ESLint ignoré pendant build, Prettier non configuré
   - Fichier: next.config.mjs
   - Lignes: 7–9 (eslint.ignoreDuringBuilds: true)
   - Fichier: .eslintrc.json (présent) / Prettier (absent)
   - Écart: Le build ne doit pas ignorer le lint; formatage Prettier manquant.

3. Fichier env.txt commité
   - Fichier: env.txt
   - Lignes: 1–9
   - Écart: Même avec placeholders, c’est source de confusion et risque; les fichiers d’exemple doivent être _.example et .env_ ignorés.

4. Stratégie de migrations/multi-env non verrouillée
   - Fichier: prisma/migrations/\* (SQLite), scripts prisma (package.json)
   - Écart: Besoin d’un chemin clair Postgres (migrate:deploy) et suppression des artefacts SQLite en prod.

## P2 — Observabilité / fiabilité

1. Webhook et paiements sans idempotency keys
   - Fichiers: app/api/webhooks/konnect/route.ts (41–117) ; app/api/payments/konnect/route.ts (64–86 TODO, 88–93 resp.)
   - Écart: Risques de double application.

2. Logging non structuré et absence de monitoring/alerting
   - Fichiers: lib/_.ts (usage console._), routes API
   - Écart: Pas de pino/winston, pas de Sentry/alerting.

3. IA ARIA: modèle hardcodé vs variable d’environnement
   - Fichier: lib/aria.ts
   - Lignes: 91–97 (model: 'gpt-3.5-turbo')
   - Écart: Utiliser OPENAI_MODEL si présent.

## P3 — Performance / DX / a11y

1. Images non optimisées en prod
   - Fichier: next.config.mjs
   - Lignes: 11–14 (images.unoptimized: true)
   - Écart: à activer en prod pour perf/SEO.

2. Accessibilité manuelle non outillée
   - Fichiers: components/\*_/_.tsx
   - Écart: Manque lint a11y (eslint-plugin-jsx-a11y) et tests axe-core.

3. Storybook / doc UI absents
   - Fichiers: (manquants)
   - Écart: Règle doc composants non pleinement adressée.

4. Couverture tests ≥85% non enforce
   - Fichier: jest.config.js
   - Lignes: 12–18 collectCoverageFrom, pas de coverageThreshold
   - Écart: Règle min 85% backend non imposée.
