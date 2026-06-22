# Parent Modal Wiring Design

## Date

2026-06-22

## Contexte

Deux composants de modales parent existaient mais n'etaient pas montes dans un parcours utilisateur reel :

- `app/dashboard/parent/credit-purchase-dialog.tsx`
- `app/dashboard/parent/invoice-details-dialog.tsx`

Le commanditaire a valide que tout doit etre cable, avec une preuve e2e reelle sous authentification.

## Decision

Les deux modales sont cablees dans `/dashboard/parent/abonnements`, sur la carte de l'enfant selectionne.

- `CreditPurchaseDialog` ouvre une demande de credits pour l'enfant courant et appelle l'API existante `POST /api/parent/credit-request`.
- `InvoiceDetailsDialog` affiche le plan, le statut, le prix et les dates de l'abonnement courant de l'enfant.

Cette approche evite d'inventer un paiement direct de credits ou une facturation automatique non prouvee. Le libelle produit doit parler de demande de credits tant que le flux reste soumis a validation assistante.

## Alternatives Rejetees

- Monter `InvoiceDetailsDialog` dans `/dashboard/parent/factures` : la page liste les factures PDF, pas l'abonnement courant.
- Remplacer les modales par des blocs inline : cela ne traite pas la dette "composant non monte" du chantier modales.

## Tests Attendus

- Deux tests e2e auth parent ouvrent reellement les modales.
- Chaque preuve conserve la batterie standard : `role=dialog`, fond sombre, animation terminee, filet or, titre Fraunces, focus-trap, ESC, retour focus, contraste AA.
- `AUTH_MIN` augmente de 33 a 35.
