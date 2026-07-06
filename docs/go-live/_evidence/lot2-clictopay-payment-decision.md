# Lot 2 — Décision ClicToPay

## Décision

ClicToPay reste désactivé.

## Contrat webhook

- Sans signature : `401 CLICTOPAY_SIGNATURE_REQUIRED`.
- Signature invalide : `401 CLICTOPAY_SIGNATURE_INVALID`.
- Signature valide : `501 CLICTOPAY_NOT_CONFIGURED`.
- Aucune mutation Prisma.
- Aucune activation payment/invoice/entitlement/credit.
- Aucun succès ambigu.

## UI publique

`PaymentMethodsNote` n'affiche pas le paiement carte sans `NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC=true`.

## Tests

- `__tests__/api/payments.clictopay.webhook.disabled.test.ts`
- `__tests__/api/payments.clictopay.webhook.security.test.ts`
- `__tests__/api/payments.clictopay.webhook.route.test.ts`
- `__tests__/ui/payment-methods.clictopay-disabled.test.tsx`

## Verdict

Route volontairement P1 paiement. Passage P2/OK interdit tant que signature, idempotence, montant/devise/productCode, facture, paiement et entitlement ne sont pas complets.
