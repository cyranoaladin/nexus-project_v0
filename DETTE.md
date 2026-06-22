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

## Risques de divergence résolus

### Divergence endpoints abonnements parent
- **Fichiers** : `app/api/parent/subscriptions/route.ts`,
  `app/api/parent/subscription-requests/route.ts`,
  `app/api/assistante/subscription-requests/route.ts`,
  `app/dashboard/parent/abonnements/page.tsx`
- **Résolution** : `SubscriptionRequest` est la file canonique des intentions parent. Le bouton ARIA
  poste vers `requestType=ARIA_ADDON`, les changements de formule vers `requestType=PLAN_CHANGE`,
  et les prix/crédits sont résolus côté serveur.
- **Garde staff** : l'approbation assistante utilise une transaction avec
  `status: 'PENDING'`, retourne `409` en cas de double traitement concurrent, applique le prix
  catalogue et synchronise `creditsPerMonth` / crédits.
- **Routes dormantes** : `POST /api/subscriptions/change` et `POST /api/subscriptions/aria-addon`
  retournent `410 Gone`.
- **Preuve ciblée** : `npx jest --config jest.config.js __tests__/api/parent.subscriptions.route.test.ts __tests__/api/parent.subscription-requests.route.test.ts __tests__/api/assistant.subscription-requests.route.test.ts __tests__/api/subscriptions.change.route.test.ts __tests__/api/subscriptions.aria-addon.route.test.ts --runInBand`
  -> `5 passed`, `30 passed`.
- **Identifié** : 2026-06-22, audit endpoints abonnements parent.
- **Résolu** : 2026-06-22, correction file canonique `SubscriptionRequest`.

## État preuve modales

- **2026-06-22, fil 2** : 17 preuves e2e auth réelles couvrent les modales montées et atteignables
  dans `e2e/auth/dialog-all-roles-proof.spec.ts`.
- **2026-06-22, câblage complémentaire** : 2 preuves e2e auth ajoutées pour les modales parent
  précédemment non montées (`credit-purchase`, `invoice-details`). Le total de cette spec passe
  à 19 preuves.
- Les modales nested de rejet dans les flux assistante restent non ouvertes séparément dans ce lot ;
  les modales principales de détail/traitement sont couvertes.
