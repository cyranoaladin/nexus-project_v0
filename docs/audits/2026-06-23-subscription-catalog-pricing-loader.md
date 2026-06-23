# Migration du catalogue operationnel abonnements et ARIA

## Date

2026-06-23

## Contexte

Les flux parent et assistante d'abonnements utilisent les identifiants operationnels `ACCES_PLATEFORME`, `HYBRIDE`, `IMMERSION`, `MATIERE_SUPPLEMENTAIRE` et `ANALYSE_APPROFONDIE`.

Avant cette migration, ces valeurs etaient maintenues dans `lib/constants.ts`, separement de la source canonique pricing `data/pricing.canonical.json`. Cela creait un risque de divergence entre le catalogue commercial, les validations serveur, les credits attribues et les montants affiches dans les parcours parent et assistante.

## Problemes observes

- Les constantes operationnelles abonnements et ARIA etaient hardcodees hors de `data/pricing.canonical.json`.
- Les routes de demandes parent et d'approbation assistante lisaient directement ces constantes.
- Le validateur de paiement reutilisait ces constantes pour resoudre les montants attendus.
- Les tests existants validaient la forme des constantes, mais pas leur equivalence avec le catalogue canonique.

## Decisions prises

- Ajouter dans `data/pricing.canonical.json` deux sections explicites pour le catalogue operationnel:
  - `operational_subscription_plans`
  - `operational_aria_addons`
- Creer `lib/subscription-catalog.ts` comme loader unique du catalogue operationnel adosse a `getFullPricingData()`.
- Migrer les routes serveur parent et assistante vers ce loader.
- Migrer le validateur `lib/security/payment-catalog.ts` vers ce loader.
- Conserver `lib/constants.ts` comme facade de compatibilite pour les constantes historiques, sans y maintenir de duplication abonnements/ARIA.
- Ajouter un test d'equivalence catalogue qui compare les getters operationnels a `getFullPricingData()`.

## Fichiers modifies

- `data/pricing.canonical.json`
- `lib/pricing.ts`
- `lib/subscription-catalog.ts`
- `lib/constants.ts`
- `lib/security/payment-catalog.ts`
- `app/api/parent/subscription-requests/route.ts`
- `app/api/parent/subscriptions/route.ts`
- `app/api/assistante/subscription-requests/route.ts`
- `app/api/assistante/subscriptions/route.ts`
- `app/dashboard/parent/abonnements/page.tsx`
- `app/dashboard/parent/paiement/page.tsx`
- `__tests__/lib/subscription-catalog.test.ts`
- `scripts/gate-all.sh`

## Tests executes

- Test rouge initial: `npx jest --config jest.config.js __tests__/lib/subscription-catalog.test.ts --runInBand`
- Test cible apres implementation: `npx jest --config jest.config.js __tests__/lib/subscription-catalog.test.ts --runInBand`
- Bundle routes/catalogue: `npx jest --config jest.config.js __tests__/lib/subscription-catalog.test.ts __tests__/api/parent.subscription-requests.route.test.ts __tests__/api/parent.subscriptions.route.test.ts __tests__/api/assistant.subscription-requests.route.test.ts __tests__/api/assistant.subscriptions.route.test.ts __tests__/lib/constants.test.ts __tests__/lib/constants.complete.test.ts --runInBand`
- Typecheck: `npm run typecheck`
- Gate complet: `scripts/gate-all.sh`

## Resultats

Les resultats definitifs du gate complet sont a reporter depuis le log d'execution contenant le marqueur `EXIT=`.

## Risques restants

- Les pages client parent affichent toujours le catalogue operationnel afin de presenter les offres et paiements. Le catalogue source reste unique, mais ces pages peuvent embarquer les donnees necessaires au rendu client.
- Les packs specifiques et couts de credits restent dans `lib/constants.ts`; ils n'ont pas ete inclus dans cette migration car la demande concernait abonnements et ARIA.

## Rollback

Revenir au commit precedent restaure les constantes hardcodees dans `lib/constants.ts` et retire les sections operationnelles ajoutees au pricing canonique. En cas de rollback partiel, verifier que les routes parent, assistante et le validateur paiement utilisent tous la meme source pour eviter une divergence de montant ou de credits.
