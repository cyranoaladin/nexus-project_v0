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

## Décision recommandée

Choisir une seule file d'attente métier pour les demandes parent.

Option recommandée : `SubscriptionRequest` devient la file canonique pour les intentions parent
avant validation/paiement.

- `PLAN_CHANGE` : crée une `SubscriptionRequest`.
- `ARIA_ADDON` : crée une `SubscriptionRequest` ou redirige vers paiement `type=addon`, mais pas via
  `/api/parent/subscriptions`.
- `INVOICE_DETAILS` : à supprimer comme type de demande si la modale de détails suffit.
- `Subscription INACTIVE` ne doit plus servir de file d'attente générique parent hors paiement validé.

## Plan de correction recommandé

1. Extraire un helper serveur canonique, par exemple `lib/subscriptions/catalog.ts`, qui résout :
   - plan;
   - prix;
   - crédits;
   - type de demande autorisé.
2. Corriger `/dashboard/parent/abonnements` :
   - plan change -> route canonique retenue;
   - ARIA add-on -> route canonique `ARIA_ADDON` ou paiement `type=addon`.
3. Aligner le traitement staff :
   - approval atomique sur `SubscriptionRequest.status = PENDING`;
   - pour `PLAN_CHANGE`, mettre à jour `planName`, `monthlyPrice`, `creditsPerMonth`;
   - définir explicitement si des crédits sont ajoutés immédiatement ou au prochain cycle.
4. Déprécier ou supprimer les routes dormantes :
   - `/api/subscriptions/change`;
   - `/api/subscriptions/aria-addon`.
5. Ajouter des tests d'invariant inter-flux :
   - prix client falsifié ignoré;
   - crédits `HYBRIDE` / `IMMERSION` cohérents après approbation;
   - ARIA add-on n'appelle pas `/api/parent/subscriptions`;
   - double approbation renvoie `409`.

## Tests exécutés

```bash
npx jest --config jest.config.js \
  __tests__/api/parent.subscriptions.route.test.ts \
  __tests__/api/parent.subscription-requests.route.test.ts \
  __tests__/api/assistant.subscriptions.route.test.ts \
  __tests__/api/assistant.subscription-requests.route.test.ts \
  --runInBand
```

Résultat : `4 passed`, `27 passed`.

## Risques restants

- Les tests unitaires actuels valident chaque route isolément, mais pas l'équivalence métier entre
  les deux chemins.
- Le bouton ARIA parent est probablement cassé fonctionnellement tant qu'il poste vers
  `/api/parent/subscriptions`.

## Rollback

Audit documentaire uniquement. Aucun rollback applicatif requis.
