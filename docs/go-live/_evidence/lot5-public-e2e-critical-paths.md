# Lot 5 — Public E2E critical paths

## Objectif

Vérifier les parcours publics critiques après build frais.

## Tests à exécuter en gates finales

```bash
npm run build
npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium
npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium
```

## Critères

- `/`, `/offres`, `/bilan-gratuit` : pas de 500, CTA critiques et contenu attendu visibles.
- `/bilan-gratuit/assessment?...email=...` : redirection vers URL canonique.
- Email query absent du HTML.
- Token assessment absent de l'URL.
- Token assessment absent du HTML.
- Message de refus sobre sans cookie.

## Résultat

Build frais : OK.

Premier lancement Playwright sur port par défaut : ÉCHEC environnement, port `3002` déjà occupé par un autre projet local (`Qantara_IA` en `next dev`). Aucun test Nexus exécuté sur cette tentative.

Relance sur port isolé :

```bash
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium
```

Résultat : OK, `24` tests passés.

```bash
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium
```

Résultat : OK, `1` test passé.

## Décision

Parcours publics critiques validés localement après build frais, sur port isolé `3012`.
