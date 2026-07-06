# Lot 1-quater — Assistante

## Routes traitées

| Route | Avant | Après | Preuve |
| --- | --- | --- | --- |
| `/api/assistante/credit-requests` | P1 | P2 | Body Zod strict |
| `/api/assistante/quotes/pdf` | P1 | P2 | Payload devis Zod strict, rate limit existant |
| `/api/assistante/students/credits` | P1 | P2 | Query/body Zod, montant borné |
| `/api/assistante/subscription-requests` | P1 | P2 | Query/body Zod, pagination bornée |
| `/api/assistante/subscriptions` | P1 | P2 | Body Zod strict |

## Tests

- `__tests__/api/assistant.credit-requests.route.test.ts`
- `__tests__/api/assistant.students.credits.route.test.ts`
- `__tests__/api/assistant.subscription-requests.route.test.ts`
- `__tests__/api/assistant.subscriptions.route.test.ts`
- `__tests__/api/assistante.quotes.pdf.route.test.ts`

## Réserves

Les réponses assistante restent staff-only. La réduction P1 ne vaut pas preuve RGPD complète sur minimisation PII ; elle prouve validation stricte et absence de mutation sur payload invalide.
