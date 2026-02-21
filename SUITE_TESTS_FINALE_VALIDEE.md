# Suite de Tests — Statut Réel

**Dernière mise à jour :** 21 février 2026

Ce fichier sert de repère et **n’implique pas** que tous les tests passent automatiquement.

## Résumé actuel (CI vert ✅)

| Type | Suites | Tests | Failures | Skipped |
|------|--------|-------|----------|---------|
| Unit + API | 206 | 2 593 | 0 | 0 |
| DB Intégration | 7 | 68 | 0 | 0 |
| E2E (Chromium) | 19 | 207 | 0 | 0 |
| **Total** | **232** | **2 868** | **0** | **0** |

## Commandes

```bash
npm test                    # Unit + API (parallel)
npm run test:db-integration # DB intégration (serial)
npm run test:all            # Les deux séquentiellement
npm run test:e2e            # Playwright E2E
```
