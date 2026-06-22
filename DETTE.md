# Dette technique & produit — Nexus Réussite

## Trous fonctionnels UI (décision produit en attente)

### CreditPurchaseDialog — achat de crédits par le parent
- **Fichier** : `app/dashboard/parent/credit-purchase-dialog.tsx`
- **API** : `POST /api/parent/credit-request` (existe, fonctionnelle)
- **Problème** : le composant n'est importé/monté nulle part. Le parent n'a aucun bouton
  "Acheter des crédits" dans son dashboard. L'achat de crédits passe uniquement par
  l'assistante (`/dashboard/assistante/credit-requests`).
- **Impact** : le parent ne peut pas initier une demande de crédits en autonomie.
- **Décision requise** : câbler le bouton dans le dashboard parent (page.tsx ou abonnements),
  ou accepter que la fonction reste côté assistante uniquement.
- **Identifié** : 2026-06-22, audit modales C1.

### InvoiceDetailsDialog — détails d'abonnement (dates)
- **Fichier** : `app/dashboard/parent/invoice-details-dialog.tsx`
- **Problème** : le composant n'est importé/monté nulle part. Il affichait le plan actuel,
  le statut, le prix mensuel, la date de début et la prochaine facturation.
  La page `/dashboard/parent/factures` existe mais montre les factures (documents),
  pas les détails de l'abonnement en cours. La page `/dashboard/parent/abonnements`
  montre le plan et le statut mais PAS les dates (début, prochaine facturation).
- **Impact** : le parent n'a pas de vue des dates de son abonnement.
- **Décision requise** : câbler le dialog ou intégrer les dates dans la page abonnements.
- **Identifié** : 2026-06-22, audit modales C1.

## Risques de divergence

## État preuve modales

- **2026-06-22, fil 2** : 17 preuves e2e auth réelles couvrent les modales montées et atteignables
  dans `e2e/auth/dialog-all-roles-proof.spec.ts`.
- Les deux trous fonctionnels ci-dessus restent hors périmètre de preuve car les composants ne sont
  toujours pas montés dans un parcours utilisateur réel.
- Les modales nested de rejet dans les flux assistante restent non ouvertes séparément dans ce lot ;
  les modales principales de détail/traitement sont couvertes.

### Doublon de logique paiement/abonnement
- La page `abonnements/page.tsx` a sa propre modale inline de changement de plan
  qui poste à `POST /api/parent/subscriptions`.
- L'ancienne logique (dialog mort, supprimé) postait à `POST /api/parent/subscription-requests`.
- **Risque** : deux endpoints avec des règles de validation potentiellement divergentes.
- **Action recommandée** : auditer les deux endpoints dans le lot durcissement entitlements/paiements
  pour confirmer qu'ils appliquent les mêmes gardes (plafond, plancher, validation plan).
