# Validation des Tests — État Actuel

**Dernière mise à jour :** 21 février 2026

Ce document décrit **ce qui existe** et **comment vérifier**.

## 1) Ce qui est présent

- **Jest unit + API** : `jest.config.js` — 206 suites, 2 593 tests
- **Jest DB intégration** : `jest.config.db.js` — 7 suites, 68 tests
- **Playwright E2E** : `playwright.config.ts` (testDir: `e2e/`) — 19 fichiers, 207 tests

## 2) Vérification

```bash
npm test                    # Unit + API (parallel)
npm run test:db-integration # DB intégration (serial)
npm run test:e2e            # Playwright E2E
```

## 3) Remarques

- Les tests DB nécessitent PostgreSQL (local port 5435 ou CI port 5432).
- Les tests E2E nécessitent un build préalable + seed de la DB E2E.
- CI exécute les 3 types dans des jobs séparés (7 jobs total).
