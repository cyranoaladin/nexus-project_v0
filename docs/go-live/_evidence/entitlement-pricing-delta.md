# Delta pricing canonique vs entitlement registry

Date locale : 2026-07-02 18:20 CET

## Fichiers lus

- `data/pricing.canonical.json`
- `lib/entitlement/types.ts`
- `lib/entitlement/engine.ts`
- `lib/operational-catalog.ts`
- `app/api/payments/validate/route.ts`

## Produits pricing opérationnels

| Produit pricing | Prix | Crédits annoncés | Source |
| --- | ---: | ---: | --- |
| `ACCES_PLATEFORME` | 150 TND/mois | 0 | `data/pricing.canonical.json` `operational_subscription_plans` |
| `HYBRIDE` | 450 TND/mois | 4 | `data/pricing.canonical.json` `operational_subscription_plans` |
| `IMMERSION` | 750 TND/mois | 8 | `data/pricing.canonical.json` `operational_subscription_plans` |

## Produits entitlement

| ProductCode entitlement | Label | Crédits accordés | Source |
| --- | --- | ---: | --- |
| `ABONNEMENT_ESSENTIEL` | Abonnement Essentiel | 4 | `lib/entitlement/types.ts` `PRODUCT_REGISTRY` |
| `ABONNEMENT_HYBRIDE` | Abonnement Hybride | 8 | `lib/entitlement/types.ts` `PRODUCT_REGISTRY` |
| `ABONNEMENT_IMMERSION` | Abonnement Immersion | 16 | `lib/entitlement/types.ts` `PRODUCT_REGISTRY` |

## Écarts prouvés

| Mapping paiement | Pricing | Entitlement | Écart |
| --- | ---: | ---: | --- |
| `ACCES_PLATEFORME` -> `ABONNEMENT_ESSENTIEL` | 0 crédit | 4 crédits | +4 crédits |
| `HYBRIDE` -> `ABONNEMENT_HYBRIDE` | 4 crédits | 8 crédits | +4 crédits |
| `IMMERSION` -> `ABONNEMENT_IMMERSION` | 8 crédits | 16 crédits | +8 crédits |

## Risques

- Sur-crédit potentiel lors de `activateEntitlements()` après validation paiement.
- Double projection possible : `activateEntitlements()` incrémente les crédits sur `Student`, puis la logique legacy `Subscription` crée aussi une `CreditTransaction` mensuelle si `creditsPerMonth > 0`.
- Le paiement validé peut créer une facture et des droits incohérents avec l'offre achetée.
- Les tests actuels ne prouvent pas le contrat pricing -> invoice item -> entitlement -> credits.

## Décision recommandée

- Source cible : `data/pricing.canonical.json` pour les prix et crédits opérationnels.
- `PRODUCT_REGISTRY` doit être aligné automatiquement ou généré depuis la source canonique, ou bien ne porter que les droits techniques sans quantité commerciale.
- Ne pas corriger toute la chaîne dans Lot 0-bis ; traiter en Lot 4 avec tests de contrat et migration contrôlée.

## Test à créer dans Lot 4

Créer un test de contrat qui vérifie pour chaque plan opérationnel :

1. le `productCode` résolu par `app/api/payments/validate/route.ts` ;
2. le nombre de crédits accordés par `activateEntitlements()`;
3. l'absence de double allocation entre `Entitlement`, `Student.credits` et `CreditTransaction`;
4. l'idempotence sur validation concurrente ou retry.
