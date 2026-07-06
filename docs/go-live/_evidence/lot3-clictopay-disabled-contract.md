# Lot 3 — ClicToPay disabled contract

## Décision

ClicToPay reste désactivé. La carte bancaire ne doit pas être présentée comme active.

## Contrat API

- `init` reste `501 CLICTOPAY_NOT_CONFIGURED`.
- `webhook` exige une signature.
- Signature absente ou invalide : `401`.
- Signature valide : `501 CLICTOPAY_NOT_CONFIGURED`.
- Aucune mutation Prisma ne doit créer ou activer paiement, facture, entitlement ou crédit.
- Aucun `rawWebhook`, `rawPayload`, `metadata` brute ou stack ne sort en réponse.

## Tests

- `__tests__/api/payments.clictopay.disabled-contract.test.ts`
- `__tests__/api/payments.clictopay.webhook.disabled.test.ts`
- `__tests__/api/payments.clictopay.webhook.security.test.ts`
- `__tests__/ui/payment-methods.clictopay-disabled.test.tsx`

## Plan complet futur

Pour activer ClicToPay, il faudra implémenter et tester signature, idempotence, montant, devise, `productCode`, réconciliation facture, activation entitlement, replay protection, audit log et E2E paiement.
