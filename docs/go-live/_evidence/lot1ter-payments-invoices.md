# Lot 1-ter — Paiements et factures

## Paiements

| Route | Statut après Lot 1-ter | Décision | Preuve |
| --- | --- | --- | --- |
| `/api/payments/clictopay/init` | P2 | Désactivée par `501`, durcie | Zod strict, rôle `PARENT/ADMIN/ASSISTANTE`, test invalid payload et rôle `ELEVE` |
| `/api/payments/clictopay/webhook` | P1 | Désactivée par `501`, non fermée | Webhook non activé tant que signature/idempotence/montant/devise/entitlements ne sont pas complets |
| `/api/payments/validate` | P2 hérité | Non modifiée dans Lot 1-ter | À traiter en lot paiement/entitlements pour idempotence métier complète |

## Factures

| Route | Statut après Lot 1-ter | Preuve |
| --- | --- | --- |
| `/api/admin/invoices` | P2 | Staff-only, query/body Zod, limite `50`, projection `select`, tests validation |
| `/api/admin/invoices/[id]` | P2 hérité | Tests Lot 1/1-bis |
| `/api/admin/invoices/[id]/send` | P2 hérité | Tests Lot 1/1-bis |
| `/api/invoices/[id]/pdf` | P2 hérité | Tests ownership PDF |
| `/api/invoices/[id]/receipt/pdf` | P2 hérité | Tests ownership receipt |

## Réserves

- ClicToPay ne doit pas être affiché comme actif.
- Le webhook doit rester P1 tant qu'aucune signature/idempotence complète n'est implémentée.
- Le lot paiement/entitlements doit vérifier `InvoiceItem.productCode`, montant/devise, beneficiary et absence de double activation.
