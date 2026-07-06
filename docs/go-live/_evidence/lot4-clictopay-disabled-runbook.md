# Lot 4 — ClicToPay disabled runbook

## Décision

ClicToPay reste désactivé durablement tant que l'intégration complète n'est pas livrée.

## Contrat public/backend

- UI publique : ne pas annoncer carte bancaire active.
- `/api/payments/clictopay/init` : `501 CLICTOPAY_NOT_CONFIGURED` par défaut.
- Si `NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC=true` alors que le backend est désactivé : `503 CLICTOPAY_PUBLIC_FLAG_INCONSISTENT`.
- `/api/payments/clictopay/webhook` : signature absente/invalide refusée, signature valide `501`.
- Aucune mutation paiement/facture/entitlement/crédit.

## Tests

- `__tests__/api/payments.clictopay.disabled-contract.test.ts`
- `__tests__/ui/payment-methods.clictopay-disabled.test.tsx`
- `__tests__/api/payments.clictopay.feature-flag-consistency.test.ts`

## Activation future

Impossible sans signature obligatoire, idempotence, contrôle montant/devise/productCode, réconciliation facture, activation entitlement, replay protection, audit log et E2E paiement.
