# Snippets (non appliqués)

Ce document contient des extraits prêts à l’emploi, à intégrer manuellement.

## 1) Sécurisation du Webhook Konnect (signature HMAC + idempotence)

Fichier: app/api/webhooks/konnect/route.ts

```ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  const digest = hmac.digest('hex');
  // Selon Konnect: adapter le format de signature attendu (ex: header 'x-konnect-signature')
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.KONNECT_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Récupération du corps brut pour HMAC
    const rawBody = await request.text();
    const signature = request.headers.get('x-konnect-signature');

    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { payment_id, status, transaction_id } = body;
    if (!payment_id || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Idempotence: marquer la transaction traitée une seule fois
    const idempotencyKey = transaction_id || payment_id;
    const alreadyProcessed = await prisma.payment.findFirst({
      where: {
        id: payment_id,
        metadata: { path: ['processedKeys'], array_contains: idempotencyKey },
      } as any,
    });

    if (alreadyProcessed) {
      return NextResponse.json({ success: true, idempotent: true });
    }

    // Charger le paiement
    const payment = await prisma.payment.findUnique({ where: { id: payment_id } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (status === 'completed') {
      // Mettre à jour paiement + append processedKeys
      await prisma.payment.update({
        where: { id: payment_id },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...(payment.metadata as Record<string, any> || {}),
            processedKeys: [
              ...(((payment.metadata as any)?.processedKeys) || []),
              idempotencyKey,
            ],
          },
        },
      });

      // TODO: activer service selon type (comme existant)
    } else if (status === 'failed') {
      await prisma.payment.update({ where: { id: payment_id }, data: { status: 'FAILED' } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WEBHOOK_KONNECT_ERROR]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

Notes:

- Adapter le nom du header de signature selon la doc Konnect réelle.
- Si Prisma en Postgres: metadata en JSONB permet array_contains via opérateurs Prisma/DB.

## 2) Paiement Konnect (côté serveur: derive montant, idempotence requête sortante)

Fichier: app/api/payments/konnect/route.ts

```ts
const PRICE_TABLE: Record<string, number> = {
  'ABO_HYBRIDE': 249,
  'ABO_IMMERSION': 399,
  'ADDON_ARIA_MATHS': 49,
};

// ...
const { key, studentId, type, description } = validatedData;
const amount = PRICE_TABLE[key];
if (!amount) {
  return NextResponse.json({ error: 'Unknown item key' }, { status: 400 });
}

const idempotencyKey = `${session.user.id}:${studentId}:${key}:${new Date().toISOString().slice(0,10)}`;

// Exemple d’appel API Konnect avec idempotency
// const konnectResponse = await fetch('https://api.konnect.network/api/v2/payments/init', {
//   method: 'POST',
//   headers: {
//     'x-api-key': process.env.KONNECT_API_KEY!,
//     'Idempotency-Key': idempotencyKey,
//     'Content-Type': 'application/json',
//   },
//   body: JSON.stringify({ ... , amount: amount * 1000 }),
// })
```

## 3) Migration Prisma vers PostgreSQL

Fichier: prisma/schema.prisma

```prisma
// Remplacer le datasource actuel
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Exemple: passer de String JSON à JSONB (si Postgres)
model Subscription {
  id              String   @id @default(cuid())
  studentId       String
  // ...
  ariaSubjects    Json     @default("[]")
  ariaCost        Int      @default(0)
}

// Indexation utile (Postgres)
model Payment {
  id        String   @id @default(cuid())
  userId    String   @index
  status    PaymentStatus @default(PENDING) @index
  method    String?  @index
  metadata  Json?
  createdAt DateTime @default(now()) @index
  updatedAt DateTime @updatedAt
}
```

Commandes (à exécuter manuellement):

```bash
# Mettre à jour dépendances Postgres si besoin
npm install pg @types/pg

# Générer le client et créer une migration Postgres
npx prisma generate
npx prisma migrate dev --name init_postgres

# Déployer en prod
npx prisma migrate deploy
```

## 4) Couverture Jest ≥85% et CI GitHub Actions

Fichier: jest.config.js (ajouter coverageThreshold)

```js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    'components/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

Pipeline CI (GitHub Actions): .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run check-config || true
      - run: npm run lint || true
      - run: npm test -- --ci --reporters=default --reporters=jest-junit
        env:
          CI: true
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          E2E_BASE_URL: http://localhost:3001
      - name: Build
        run: npm run build
      - name: Docker build
        run: |
          docker build -t ghcr.io/OWNER/REPO:${{ github.sha }} .
      - name: Upload artifacts (coverage, reports)
        uses: actions/upload-artifact@v4
        with:
          name: reports
          path: |
            coverage/
            playwright-report/
```

Option déploiement + tagging SemVer (exemple simplifié) à ajouter dans un job séparé.
