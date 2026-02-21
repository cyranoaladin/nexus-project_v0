# QA & E2E Testing — Nexus Réussite

**Dernière mise à jour :** 21 février 2026

## Prérequis

- Node.js 20.x
- PostgreSQL (pour tests DB et E2E)
- Navigateurs Playwright : `npx playwright install`

## Commandes

```bash
# Unit + API (Jest, parallel)
npm test

# DB intégration (Jest, serial)
npm run test:db-integration

# Tous les Jest (unit + DB)
npm run test:all

# E2E (Playwright, Chromium)
npm run test:e2e
```

## Ce que valident les tests

### Unit + API (206 suites, 2 593 tests)
- RBAC policies (21 tests), feature gating (56 tests)
- Scoring engine (25 tests), diagnostic mapping (84 tests)
- API routes (auth, admin, parent, coach, student, sessions, payments)
- Composants React (navigation, dashboard, offres, bilan, stages)
- Validation Zod, crédits, entitlements, facturation

### DB Intégration (7 suites, 68 tests)
- Schéma Prisma (FK, cascades, contraintes)
- Concurrence (double-booking, idempotence crédits/paiements)
- Transactions (rollback, validation paiement)
- Pipeline assessment (pgvector, ARIA)

### E2E (19 fichiers, 207 tests)
- Authentification complète (login, activation, reset password)
- Booking flow parent (réservation, crédits insuffisants)
- Dashboards par rôle (parent, élève, coach, admin)
- Navigation publique (homepage, offres, stages, contact)
- Student journey (Maths 1ère, progression, badges)
