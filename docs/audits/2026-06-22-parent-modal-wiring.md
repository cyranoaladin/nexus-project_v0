# Câblage des modales parent restantes

## Date

2026-06-22

## Contexte

`CreditPurchaseDialog` et `InvoiceDetailsDialog` existaient comme composants mais n'étaient pas
montés dans un parcours parent. Le commanditaire a validé leur câblage dans
`/dashboard/parent/abonnements`.

## Problèmes observés

- Les deux composants étaient inatteignables par l'utilisateur parent.
- Le libellé "achat de crédits" pouvait laisser croire à un paiement direct.
- Le libellé "facturation automatique" n'était pas prouvé par le flux actuel.

## Décisions prises

- Monter les deux modales dans la carte "Abonnement actuel" de l'enfant sélectionné.
- Garder le flux crédit comme demande validée par l'assistante via l'API existante.
- Afficher les détails d'abonnement depuis l'API parent subscriptions.
- Ajouter deux preuves e2e auth avec la batterie standard charte/a11y/focus.

## Fichiers modifiés

- `app/api/parent/subscriptions/route.ts`
- `app/dashboard/parent/abonnements/page.tsx`
- `app/dashboard/parent/credit-purchase-dialog.tsx`
- `app/dashboard/parent/invoice-details-dialog.tsx`
- `e2e/auth/dialog-all-roles-proof.spec.ts`
- `scripts/gate-all.sh`
- `DETTE.md`

## Tests exécutés

- Rouge ciblé : les deux nouveaux tests échouent sur trigger absent.
- Build local : `npx next build`.
- Vert ciblé : les deux nouveaux tests passent après câblage.

## Résultats

- Les deux modales sont montées dans un parcours réel parent.
- La spec auth modales passe de 17 à 19 preuves.
- Le plancher `AUTH_MIN` passe de 33 à 35.

## Risques restants

- La demande de crédits n'est pas un paiement direct ; ce choix est volontaire pour ne pas coder
  une décision produit non validée.
- Le risque de divergence entre endpoints d'abonnement reste documenté dans `DETTE.md`.

## Rollback

- Revenir le commit de câblage et remettre `AUTH_MIN=33`.
