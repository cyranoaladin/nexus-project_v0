# Validation des Tests — État Actuel

**Dernière mise à jour :** 21 janvier 2026

Ce document ne valide pas automatiquement les tests. Il décrit **ce qui existe** et **comment vérifier**.

## 1) Ce qui est présent
- Jest : unit + integration (configs séparées)
- Playwright : E2E (config par défaut sur `__tests__/e2e`)

## 2) Vérification manuelle
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 3) Remarques
- Les résultats dépendent de l’environnement local (DB, variables, données de seed).
- Les scénarios dans `e2e/` ne sont pas exécutés par défaut.

