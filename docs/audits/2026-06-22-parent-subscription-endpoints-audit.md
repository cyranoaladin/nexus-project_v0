# Audit divergence endpoints abonnements parent

## Date

2026-06-22

## Contexte

Audit demandé après le câblage complet des modales parent. Le point à vérifier était la divergence
documentée entre :

- `POST /api/parent/subscriptions`
- `POST /api/parent/subscription-requests`

Routes connexes inspectées :

- `POST /api/assistante/subscriptions`
- `PATCH /api/assistante/subscription-requests`
- `POST /api/subscriptions/change`
- `POST /api/subscriptions/aria-addon`
- `POST /api/payments/bank-transfer/confirm`

## Constats

### P0 — Deux files d'attente concurrentes pour un même métier

`/api/parent/subscriptions` crée directement une ligne `Subscription` en statut `INACTIVE`.
Cette ligne est traitée par `POST /api/assistante/subscriptions`.

`/api/parent/subscription-requests` crée une ligne `SubscriptionRequest` en statut `PENDING`.
Cette ligne est traitée par `PATCH /api/assistante/subscription-requests`.

Ces deux modèles représentent tous deux une demande parent en attente, mais ne partagent pas le
même cycle de vie, les mêmes écrans staff, ni les mêmes effets à l'approbation.

### P0 — Effets d'approbation divergents

L'approbation d'une `Subscription INACTIVE` :

- active la subscription via `updateMany({ id, status: 'INACTIVE' })`;
- ajoute des crédits via `CreditTransaction` si `creditsPerMonth > 0`;
- protège contre un double traitement concurrent avec une transaction.

L'approbation d'une `SubscriptionRequest PLAN_CHANGE` :

- met à jour une subscription `ACTIVE` existante;
- modifie `planName` et `monthlyPrice`;
- ne met pas à jour `creditsPerMonth`;
- n'ajoute pas de crédits;
- n'utilise pas de garde atomique `status: 'PENDING'` dans l'update de traitement.

Résultat : un même changement vers `HYBRIDE` peut aboutir à des crédits et un état différents selon
la route d'entrée.

### P0 — Le bouton ARIA parent appelle la mauvaise route

`/dashboard/parent/abonnements` appelle `POST /api/parent/subscriptions` pour les add-ons ARIA avec
un `planName` de type `ARIA_${addonKey}`.

Or `/api/parent/subscriptions` ne valide que `SUBSCRIPTION_PLANS`. Les add-ons ARIA doivent passer
par un flux `ARIA_ADDON` ou par le paiement catalogue `type=addon`. En l'état, le bouton ARIA doit
retourner `400 Plan d'abonnement invalide`.

### P1 — Routes anciennes encore actives mais non appelées par l'UI

`POST /api/subscriptions/change` duplique la création d'une `Subscription INACTIVE`.

`POST /api/subscriptions/aria-addon` valide un add-on ARIA et retourne "prêt pour le paiement", mais
ne crée ni `Payment`, ni `SubscriptionRequest`, ni modification d'abonnement.

Aucun appel UI direct à ces deux routes n'a été trouvé dans `app/` ou `components/`.

### P1 — Prix client actuellement ignorés côté serveur

Les deux routes parent principales ignorent désormais les prix envoyés par le client et résolvent les
montants depuis `SUBSCRIPTION_PLANS` / `ARIA_ADDONS`.

Les tests existants couvrent ce point :

- `parent.subscriptions.route.test.ts`
- `parent.subscription-requests.route.test.ts`

La faille historique "prix client accepté" documentée en mai 2026 semble donc corrigée pour ces deux
routes.

## Décision appliquée

Choisir une seule file d'attente métier pour les demandes parent.

Option retenue : `SubscriptionRequest` devient la file canonique pour les intentions parent
avant validation/paiement.

- `PLAN_CHANGE` : crée une `SubscriptionRequest`.
- `ARIA_ADDON` : crée une `SubscriptionRequest`, pas une `Subscription INACTIVE`.
- `INVOICE_DETAILS` : à supprimer comme type de demande si la modale de détails suffit.
- `Subscription INACTIVE` ne doit plus servir de file d'attente générique parent hors paiement validé.

## Correction appliquée

- `/dashboard/parent/abonnements` poste les changements de formule vers
  `POST /api/parent/subscription-requests` avec `requestType=PLAN_CHANGE` et la clé de plan
  canonique.
- Le bouton ARIA poste vers `POST /api/parent/subscription-requests` avec
  `requestType=ARIA_ADDON`.
- `POST /api/parent/subscriptions` reste compatible mais crée désormais une `SubscriptionRequest`
  `PLAN_CHANGE`, sans prix ni crédits issus du client.
- `PATCH /api/assistante/subscription-requests` traite les approbations dans une transaction avec
  garde atomique `status: 'PENDING'`.
- L'approbation `PLAN_CHANGE` applique le prix catalogue, synchronise `creditsPerMonth` et ajoute
  les crédits du plan.
- L'approbation `ARIA_ADDON` applique le prix catalogue de l'add-on sur l'abonnement actif.
- `POST /api/subscriptions/change` et `POST /api/subscriptions/aria-addon` retournent `410 Gone`.

## Tests exécutés

```bash
npx jest --config jest.config.js \
  __tests__/api/parent.subscriptions.route.test.ts \
  __tests__/api/parent.subscription-requests.route.test.ts \
  __tests__/api/assistant.subscription-requests.route.test.ts \
  __tests__/api/subscriptions.change.route.test.ts \
  __tests__/api/subscriptions.aria-addon.route.test.ts \
  --runInBand
```

Résultat ciblé après correction : `5 passed`, `30 passed`.

Gate complet après correction :

- Jest : `6216 passed` (plancher `6215`);
- E2E public : `184 passed` (plancher `184`);
- E2E auth réelle : `35 passed` (plancher `35`);
- Total : `6435` (plancher `6434`);
- `EXIT=0`.

## Risques restants

- `POST /api/assistante/subscriptions` reste présent pour traiter d'anciennes lignes
  `Subscription INACTIVE` éventuelles, mais il ne doit plus être utilisé comme file d'attente
  parent pour les nouveaux changements de formule.
- La décision métier "ajouter les crédits immédiatement à l'approbation d'un changement de plan" est
  maintenant codée et testée. Si le prochain cycle de facturation doit porter cette allocation, il
  faudra changer explicitement la règle produit et les tests.

## Rollback

Revenir au commit précédent restaure les deux files concurrentes. Si rollback nécessaire, conserver
la dépréciation des routes dormantes ou bloquer l'UI parent pour éviter de recréer des demandes dans
la mauvaise file.
