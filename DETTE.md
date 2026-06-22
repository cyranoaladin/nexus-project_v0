# Dette technique & produit — Nexus Réussite

## Trous fonctionnels UI résolus

### CreditPurchaseDialog — demande de crédits par le parent
- **Fichier** : `app/dashboard/parent/credit-purchase-dialog.tsx`
- **API** : `POST /api/parent/credit-request` (existe, fonctionnelle)
- **Résolution** : composant monté dans `/dashboard/parent/abonnements` sur la carte de l'enfant
  sélectionné. Le flux crée une demande de crédits, sans déclencher de paiement direct.
- **Preuve** : `parent: abonnements credit-purchase dialog` dans
  `e2e/auth/dialog-all-roles-proof.spec.ts`.
- **Identifié** : 2026-06-22, audit modales C1.
- **Résolu** : 2026-06-22, câblage validé commanditaire.

### InvoiceDetailsDialog — détails d'abonnement (dates)
- **Fichier** : `app/dashboard/parent/invoice-details-dialog.tsx`
- **Résolution** : composant monté dans `/dashboard/parent/abonnements` sur la carte de l'enfant
  sélectionné. Il affiche le plan, le statut, le prix mensuel, la date de début et la fin de
  période prévue.
- **Preuve** : `parent: abonnements invoice-details dialog` dans
  `e2e/auth/dialog-all-roles-proof.spec.ts`.
- **Identifié** : 2026-06-22, audit modales C1.
- **Résolu** : 2026-06-22, câblage validé commanditaire.

## Risques de divergence

## État preuve modales

- **2026-06-22, fil 2** : 17 preuves e2e auth réelles couvrent les modales montées et atteignables
  dans `e2e/auth/dialog-all-roles-proof.spec.ts`.
- **2026-06-22, câblage complémentaire** : 2 preuves e2e auth ajoutées pour les modales parent
  précédemment non montées (`credit-purchase`, `invoice-details`). Le total de cette spec passe
  à 19 preuves.
- Les modales nested de rejet dans les flux assistante restent non ouvertes séparément dans ce lot ;
  les modales principales de détail/traitement sont couvertes.

### Doublon de logique paiement/abonnement
- La page `abonnements/page.tsx` a sa propre modale inline de changement de plan
  qui poste à `POST /api/parent/subscriptions`.
- L'ancienne logique (dialog mort, supprimé) postait à `POST /api/parent/subscription-requests`.
- **Risque** : deux endpoints avec des règles de validation potentiellement divergentes.
- **Action recommandée** : auditer les deux endpoints dans le lot durcissement entitlements/paiements
  pour confirmer qu'ils appliquent les mêmes gardes (plafond, plancher, validation plan).
