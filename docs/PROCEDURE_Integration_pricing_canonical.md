# Procédure d'intégration — catalogue canonique

## Statut

Procédure mise à jour le 2026-06-23.

Le seul catalogue opérationnel est `data/pricing.canonical.json`, chargé par `lib/pricing.ts`. Aucun autre JSON, tableau Markdown ou script de génération ne doit servir de source de prix.

## Structure actuelle

| Clé racine | Usage |
|---|---|
| `rules` | Effectifs, seuils, planchers, remises et règles de paiement. |
| `offers` | Parcours annuels, candidats libres et plateforme. |
| `stage_formats` | Formats de stages et prix par élève. |
| `stage_calendar` | Calendrier public des stages. |
| `stage_editions` | Éditions de stages. |
| `ponctuel_offers` | Offres ponctuelles. |
| `coaching` | Offres coaching. |
| `packs` | Packs et composants. |
| `special_programs` | Programmes spécifiques. |
| `aria_addon` | Add-on ARIA pédagogique. |
| `operational_*` | Catalogues opérationnels serveur pour abonnements, ARIA, packs et coûts crédits. |
| `carte_nexus` | Carte Nexus. |
| `urgence` | Services d'urgence. |
| `reperes_tarifaires` | Repères d'affichage public. |

## Règles d'intégration

1. Modifier les prix uniquement dans `data/pricing.canonical.json`.
2. Lire les prix uniquement via `lib/pricing.ts` ou un loader serveur qui l'utilise.
3. Ne pas importer directement le JSON dans une page ou un composant.
4. Ne pas recréer de fichier catalogue dérivé concurrent.
5. Ne pas recopier de montants dans `docs/` pour en faire une référence opérationnelle.
6. Vérifier toute nouvelle surface par test : rendu public, route serveur ou e2e auth selon le cas.

## Surfaces actuellement alignées

- `/offres` consomme `lib/pricing.ts`.
- `/stages` consomme `lib/pricing.ts`.
- `/dashboard/assistante/devis` consomme `lib/assistante-devis-catalog.ts`, lui-même alimenté par `lib/pricing.ts`.
- Les invariants inter-flux abonnements/ARIA sont couverts par les specs auth dédiées.

## Vérifications recommandées

- `npm run typecheck`
- `npx jest --config jest.config.js __tests__/assistante-devis-catalog.test.ts --runInBand`
- `CI=1 BASE_URL=http://localhost:3002 npx playwright test --config=playwright.auth.config.ts e2e/auth/assistante-devis-catalog.spec.ts --reporter=line`
- `scripts/gate-all.sh` avant livraison applicative.
