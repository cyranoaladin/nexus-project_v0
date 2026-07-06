# Lot 1-quinquies — ClicToPay webhook

## Route

`/api/payments/clictopay/webhook`

## Statut

P1 maintenu. La route est plus strictement désactivée, mais ne peut pas devenir P2/OK tant que l'intégration complète ClicToPay n'est pas livrée.

## Contrat actuel

- Webhook sans signature : `401 CLICTOPAY_SIGNATURE_REQUIRED`.
- Signature invalide avec secret configuré : `401 CLICTOPAY_SIGNATURE_INVALID`.
- Signature valide avec secret configuré : `501 CLICTOPAY_NOT_CONFIGURED`.
- Signature présente sans secret runtime : `501 CLICTOPAY_NOT_CONFIGURED`.
- Aucune mutation Prisma.
- Aucune activation `payment`, `invoice`, `entitlement` ou crédit.
- Réponse sans `rawWebhook`, `rawPayload`, `metadata`, `bankReference`, `stack`.

## Tests

- `__tests__/api/payments.clictopay.webhook.route.test.ts`
- `__tests__/api/payments.clictopay.webhook.security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Décision

ClicToPay webhook reste non actif et non ambigu. Passage en OK interdit sans signature, idempotence, contrôle montant/devise/productCode, réconciliation facture/paiement/entitlement et tests bout-en-bout.
