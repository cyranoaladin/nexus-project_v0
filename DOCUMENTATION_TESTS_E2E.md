# Documentation Tests E2E (Playwright)

**Dernière mise à jour :** 21 février 2026

## 1) Configuration

- **Config** : `playwright.config.ts`
- **TestDir** : `e2e/`
- **Base URL** : `http://localhost:3000`
- **Serveur** : build standalone (`.next/standalone`) — démarré automatiquement par Playwright
- **Projet** : Chromium uniquement en CI
- **Résultats** : 19 fichiers, 207 tests, 194+ passed

## 2) Lancer les tests

```bash
# Standard (build + run)
npm run test:e2e

# UI mode (debug interactif)
npm run test:e2e:ui

# Headed (voir le navigateur)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Chromium uniquement
npx playwright test --project=chromium
```

## 3) Suites disponibles

Dans `e2e/` :

| Fichier | Description |
|---------|-------------|
| `auth-and-booking.spec.ts` | Auth complète + booking flow + crédits |
| `qa-auth-workflows.spec.ts` | QA workflows auth (activation, reset) |
| `parent-dashboard.spec.ts` | Dashboard parent (enfants, sessions) |
| `student-dashboard.spec.ts` | Dashboard élève |
| `coach-dashboard.spec.ts` | Dashboard coach |
| `admin-dashboard.spec.ts` | Dashboard admin |
| `student-journey.spec.ts` | Parcours élève Maths 1ère |
| `navigation.spec.ts` | Navigation publique |
| `homepage.spec.ts` | Homepage + SEO |
| `offres.spec.ts` | Page offres |
| `contact.spec.ts` | Formulaire contact |
| `stages.spec.ts` | Stages intensifs |
| ... | + autres suites |

## 4) Prérequis

### Base de données E2E

```bash
# Seed la DB E2E (crée users, sessions, crédits)
DATABASE_URL=postgresql://...nexus_e2e npx tsx scripts/seed-e2e-db.ts
```

Le seed génère `e2e/.credentials.json` avec les emails/passwords dynamiques.

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL (DB `nexus_e2e`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret JWT (32+ chars) |
| `AUTH_TRUST_HOST` | `true` |

## 5) CI

Le job `e2e` dans `.github/workflows/ci.yml` :
1. Build Next.js standalone
2. Seed DB E2E (`scripts/seed-e2e-db.ts`)
3. `npx playwright test --project=chromium`
4. Upload traces/screenshots on failure
5. `continue-on-error: true` (ne bloque pas le merge)

## 6) Helpers E2E

- `e2e/helpers/auth.ts` — `loginAsUser()`, `ROLE_PATHS`
- `e2e/helpers/credentials.ts` — `CREDS` (singleton depuis `.credentials.json`)
- `e2e/helpers/db.ts` — `setStudentCreditsByEmail()`, `ensureCoachAvailabilityByEmail()`
