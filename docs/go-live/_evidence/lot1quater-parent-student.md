# Lot 1-quater — Parent / Student

## Routes traitées

| Route | Avant | Après | Preuve |
| --- | --- | --- | --- |
| `/api/parent/children` | P1 | P2 | Zod strict, suppression token brut réponse |
| `/api/parent/subscription-requests` | P1 | P2 | Query/body Zod strict |
| `/api/parent/subscriptions` | P1 | P2 | Body Zod strict |
| `/api/eleve/bilan-diagnostic-maths-terminale` | P1 | P2 | Body Zod aligné types métier |
| `/api/student/automatismes/attempts` | P1 | P2 | Body Zod strict |
| `/api/student/automatismes/check-answer` | P1 | P2 | Body Zod strict |
| `/api/student/nexus-index` | P1 | P2 | Query Zod + rôle explicite |
| `/api/student/survival/*` | P1 | P2 | Params/body Zod strict |
| `/api/student/trajectory` | P1 | P2 | Query Zod + rôle explicite |

## Tests

- `__tests__/api/parent.children.route.test.ts`
- `__tests__/api/parent.children.activation.route.test.ts`
- `__tests__/api/eleve.bilan-diagnostic-maths-terminale.security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`
- Tests student existants conservés.

## Réserves

`/api/student/activate` reste P1 car activation publique par token. `/api/bilan-gratuit` crée encore des comptes inactifs et doit être arbitré en Lot 3.
