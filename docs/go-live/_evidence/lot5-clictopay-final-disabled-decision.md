# Lot 5 — ClicToPay final disabled decision

## Décision

- `CLICTOPAY_STATUS = DISABLED`
- `CARD_PAYMENT_PUBLIC = NO`
- `MANUAL_PAYMENT_ONLY = YES`
- `GO_LIVE_CARD_PAYMENT = NO`

## Preuves

Tests exécutés :

```bash
npm run test:unit -- --runInBand \
__tests__/api/payments.clictopay.disabled-contract.test.ts \
__tests__/api/payments.clictopay.feature-flag-consistency.test.ts \
__tests__/ui/payment-methods.clictopay-disabled.test.tsx
```

Résultat : OK, `3` suites, `5` tests.

## Contrat confirmé

- UI publique : carte bancaire non annoncée comme active.
- `/api/payments/clictopay/init` par défaut : `501 CLICTOPAY_NOT_CONFIGURED`.
- Flag public actif + backend disabled : `503 CLICTOPAY_PUBLIC_FLAG_INCONSISTENT`.
- Webhook : signature requise/invalide refusée ; signature valide reste `501`.
- Aucune mutation `payment`, `invoice`, `entitlement`, `creditTransaction`.

## Décision go-live

Paiement manuel uniquement.

Paiement carte interdit tant que signature, idempotence, montant, devise, productCode, réconciliation facture, activation entitlement, replay protection, audit log et E2E paiement ne sont pas livrés.

