# Lot 1-ter — Bilans et assessments

## Bilans traités

| Route | Après | Preuve |
| --- | --- | --- |
| `/api/bilans` | P2 | Query/body Zod, tests invalid filters, correction `isPublished` absent |
| `/api/bilans/[id]` | P2 | Param/body Zod, tests unsafe ID et update fields |
| `/api/bilans/[id]/export` | P2 | Param/query/body Zod, tests audience/format |
| `/api/bilans/generate` | P2 | Body/query Zod, tests refus avant DB |

## Assessments

`/api/assessments/submit` reste P1. La route est publique sensible avec données pédagogiques mineur. Elle est hors fermeture complète Lot 1-ter car le choix token signé/session/auth doit être arbitré sans casser le tunnel pédagogique.

## Tests

- `__tests__/api/bilans.id.route.test.ts`
- `__tests__/api/bilans.idor.test.ts`
- `__tests__/api/bilans/generate.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Risque résiduel

Les modèles `Diagnostic / Assessment / StageBilan / Bilan` restent à canonicaliser pour éviter les divergences fonctionnelles, même si les routes `Bilan` durcies ne sont plus P1 statiques.
