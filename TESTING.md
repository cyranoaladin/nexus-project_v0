# QA & E2E Testing

## Prérequis
- Node.js installé

## Installation des navigateurs Playwright
```bash
npx playwright install
```

## Lancer les tests E2E
```bash
npm run test:e2e
```

## Ce que valident les tests
- Chargement de la Home et affichage du titre Korrigo.
- Navigation des onglets (Établissements → Parents & Élèves).
- Présence des features clés (Smart Feedback, Live Harmonizer).
- Navigation vers la page Contact via le CTA.
