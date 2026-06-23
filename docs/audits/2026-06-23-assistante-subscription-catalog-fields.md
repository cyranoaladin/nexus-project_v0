# Cohérence catalogue abonnements assistante

## Date

2026-06-23

## Contexte

Revue des onglets assistante liés aux abonnements après verrouillage de la file canonique `SubscriptionRequest`.

## Problèmes observés

- L'onglet `Demandes` exposait le prix stocké dans `SubscriptionRequest`, mais pas l'effet catalogue complet appliqué à l'approbation.
- L'onglet legacy `Souscriptions` exposait et approuvait encore les champs stockés dans une `Subscription INACTIVE`.

## Décisions prises

- Enrichir les réponses staff avec les champs catalogue calculés côté serveur.
- Afficher dans l'UI assistante le prix catalogue et l'effet catalogue avant traitement.
- Verrouiller l'approbation legacy pour réécrire `monthlyPrice` et `creditsPerMonth` depuis `SUBSCRIPTION_PLANS`.

## Fichiers modifiés

- `app/api/assistante/subscriptions/route.ts`
- `app/api/assistante/subscription-requests/route.ts`
- `app/dashboard/assistante/subscriptions/page.tsx`
- `__tests__/api/assistant.subscriptions.route.test.ts`
- `e2e/auth/assistante-subscription-approval-invariants.spec.ts`
- `scripts/gate-all.sh`

## Tests exécutés

- `npx jest --config jest.config.js __tests__/api/assistant.subscriptions.route.test.ts --runInBand`
- `npx jest --config jest.config.js __tests__/api/assistant.subscriptions.route.test.ts __tests__/api/assistant.subscription-requests.route.test.ts --runInBand`
- `npm run typecheck`
- `npm run build`
- `./scripts/gate-auth-e2e.sh e2e/auth/assistante-subscription-approval-invariants.spec.ts`
- `scripts/gate-all.sh`

## Résultats

- Test rouge observé sur l'onglet `Demandes`: absence de `8 crédits/mois`.
- Test rouge observé sur l'approbation legacy: `updateMany` ne recevait que `status: ACTIVE`.
- Gate complet vert: Jest 6217, public 184, auth 40, total 6441, `EXIT=0`.

## Risques restants

- Les montants abonnements opérationnels restent portés par `lib/constants.ts`; une migration ultérieure peut les faire converger vers `lib/pricing.ts`.

## Rollback

Revenir au commit précédent et redéployer. Les changements sont isolés au flux abonnements assistante et aux tests associés.
