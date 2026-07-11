# Post-merge chores (G-SEC #62 + G-PAY #61)

> Ne pas confondre avec DOC-5 = `docs/architecture/restructuration/05-architecture-migration.md`

## Chores à traiter (un chantier à la fois)

| # | Chore | Scope | Branche cible |
|---|-------|-------|---------------|
| 1 | `download-streaming` | Streaming des fichiers volumineux dans `/api/documents/[id]/download` | Lot dédié à planifier |
| 2 | `audit-per-method-guards` | Généraliser parseJsonBody + gardes par méthode HTTP aux ~13 routes restantes | Lot dédié à planifier |
| 3 | `instrument-precision-2` | Affiner la classification automatique (réduire P2 → OK sur les routes déjà correctes) | Lot dédié à planifier |
| 4 | `clictopay-signature-format` | Checklist d'activation paiement : format signature HMAC, secret rotation, webhook 200. Retirer/aligner le flag `NEXT_PUBLIC_ENABLE_CLICTOPAY_PUBLIC` du composant `PaymentMethodsNote` (revenu via #61, dormant fail-closed). | G-FUNNEL |
| 5 | `stabilize-flaky-tests` | Identifier et stabiliser les tests flaky (P1017, timeouts CI) | Lot dédié à planifier |

## Héritages nominatifs G-FUNNEL (3 items)

1. **Token signé `assessments/submit`** — route P1, nécessite un token HMAC par soumission pour éliminer les soumissions fantômes.
2. **Minimisation payload HMAC `leadEmailHash`** — le webhook bilan-gratuit ne doit transmettre qu'un hash de l'email, pas l'email en clair.
3. **Honeypot vérifié par l'instrument** — le champ honeypot des formulaires publics doit être détecté par l'audit automatique (classification → P0 si absent).

## Contexte

- SHA merge #62 (G-SEC) : `b2ea32f0b`
- SHA merge #61 (G-PAY) : `ac02f548b`
- HEAD main post-merge : `ac02f548b`
- Matrice : P0=0, P1=2, PUBLIC=3, P2=144, OK=27
- Tests gate local (branche g-pay rebasée) : 518 suites, 6496 tests pass
- PR #58 fermée, branche `feat/lot4-accessors-runtime` supprimée
