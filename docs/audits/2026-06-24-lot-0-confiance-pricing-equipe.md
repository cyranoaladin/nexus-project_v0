# Lot 0 - Confiance, prix et encodage

## Date

2026-06-24

## Contexte

Le lot 0 demandait de supprimer les contenus trompeurs de `/equipe`, de retirer l'ancien affichage `monthly_display` fonde sur `price_annual / 10`, et de normaliser les sequences UTF-8 echappees de la page equipe.

## Problèmes observés

- `/equipe` presentait des identites nominatives, notes et citations non prouvees comme des personnes reelles.
- `monthly_display` etait encore expose dans `data/pricing.canonical.json` et lu par les cartes d'offres, le moteur de recommandation et le catalogue devis.
- Des chaines JSX de `/equipe` contenaient des sequences `\u00...` rendues telles quelles.

## Décisions prises

- Application de l'option A : remplacer les intervenants fictifs par des profils d'accompagnement non nominatifs par discipline et besoin.
- Suppression de `monthly_display` du JSON canonique et du type `AnnualOffer`.
- Affichage des offres annuelles depuis l'echeancier canonique : acompte, mensualites, derniere mensualite si differente, total annuel.
- Ajout de tests de garde pour empecher le retour de temoignages, notes, noms fictifs, copies ROI agressives et sequences `\u00`.

## Fichiers modifiés

- `app/equipe/page.tsx`
- `data/pricing.canonical.json`
- `lib/pricing.ts`
- `components/premium/ExamCard.tsx`
- `components/premium/recommendation-engine.ts`
- `components/marketing/OfferDetailDialog.tsx`
- `lib/assistante-devis-catalog.ts`
- Tests pricing, devis, modal offre et contenu equipe.

## Tests exécutés

- `npx jest --config jest.unit.config.js __tests__/app/equipe-content.test.ts __tests__/lib/pricing-canonical-validator.test.ts __tests__/lib/data-coherence.test.ts __tests__/lib/business-model-invariants.test.ts __tests__/lib/reperes-vs-offers.test.ts __tests__/lib/pricing-display-coherence.test.ts __tests__/assistante-devis-catalog.test.ts __tests__/components/offer-detail-dialog.test.tsx --runInBand`
- `npx jest --config jest.unit.config.js __tests__/marketing/french-typography-guard.test.ts __tests__/app/equipe-content.test.ts --runInBand`
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`

## Résultats

- Tests cibles : 8 suites, 120 tests passes.
- Garde typographique ciblee : 2 suites, 6 tests passes.
- Suite Jest complete : 490 suites passees, 1 skipped, 6 228 tests passes, 4 skipped.
- Build Next : compilation reussie, 139 pages generees, assets standalone copies.
- Lint : exit 0 avec warnings preexistants du depot.

## Risques restants

- Le PDF devis conserve un champ libre `monthlyDisplay` non relie au catalogue annuel canonique. Il n'est pas une lecture de `monthly_display`, mais reste a auditer si le flux PDF expose un libelle mensuel.
- Le lot 1 doit encore traiter les landings SEO et l'harmonisation de marque.

## Rollback

Revenir le commit du lot 0 restaure l'ancienne page equipe et le champ `monthly_display`. Aucun changement de schema base de donnees n'a ete effectue.
