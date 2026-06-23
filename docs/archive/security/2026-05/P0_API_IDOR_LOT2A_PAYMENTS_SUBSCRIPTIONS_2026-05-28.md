# P0-004 Lot 2A — Payments / Webhooks / Subscriptions

Date : 2026-05-28

## Verdict

| Groupe | Statut | Tests | Risque résiduel |
|---|---|---|---|
| Payments parent | Corrigé | OK | `check-pending` reste basé sur description/montant client mais scope strictement `userId` parent. |
| Payment validation staff | Corrigé | OK | Validation manuelle staff reste nécessaire tant que ClicToPay n'est pas activé. |
| ClicToPay init/webhook | Non product-ready, sécurisé par refus | OK | Webhook retourne `501`; si secret configuré, signature invalide refusée. Traitement provider réel à implémenter avant go-live paiement carte. |
| Subscriptions parent | Corrigé | OK | Création d'abonnement parent reste une demande `INACTIVE`; activation staff/paiement obligatoire. |
| Subscription requests | Corrigé | OK | Les demandes `INVOICE_DETAILS` restent informationnelles et sans prix. |
| Credits parent/staff | Corrigé | OK | Types de crédit staff bornés; modèle d'audit financier plus riche à prévoir en P1/P2. |
| Admin/assistante subscriptions | Corrigé/audité | OK | Routes staff-only; l'inventaire statique les garde P1 faute de reconnaissance complète des guards manuels. |

Lot 2A est fermé côté code, tests locaux et déploiement production.

Go-live large : toujours non autorisé tant que P0-004 global reste ouvert.
Bêta contrôlée : maintenue sous surveillance.

## Inventaire manuel avant correction

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership actuel | Idempotence/signature | Verdict |
|---|---|---|---|---|---|---|---|
| Payments | `app/api/payments/bank-transfer/confirm/route.ts` | POST | Paiement pending, montant, produit, `studentId` | Parent-only | Parent non vérifié pour `studentId` | Anti-doublon par parent/montant/description | KO — ownership absent + montant client |
| Payments | `app/api/payments/validate/route.ts` | POST | Validation paiement, facture, crédits | ADMIN/ASSISTANTE | Staff-only | Transaction mais update non conditionné `PENDING` | KO — idempotence incomplète |
| Payments | `app/api/payments/pending/route.ts` | GET | Liste paiements pending | ADMIN/ASSISTANTE | Staff-only | N/A | OK — staff only confirmé |
| Payments | `app/api/payments/check-pending/route.ts` | GET | Existence paiement pending parent | Parent-only | `userId=session.user.id` | N/A | OK — parent owner confirmé |
| ClicToPay | `app/api/payments/clictopay/init/route.ts` | POST | Initialisation paiement carte | Auth requis | Aucun effet financier, retourne 501 | N/A | OK — endpoint non configuré |
| ClicToPay | `app/api/payments/clictopay/webhook/route.ts` | POST | Webhook paiement carte | Aucun auth session | N/A | Signature si secret configuré; retourne 501 | À confirmer — test signature requis |
| Parent credits | `app/api/parent/credit-request/route.ts` | POST | Demande crédits enfant | Parent-only | Parent owns student | Pas de traitement direct | KO — montant non borné |
| Parent subscriptions | `app/api/parent/subscriptions/route.ts` | GET, POST | Abonnements enfants | Parent-only | Parent owns student | Activation `INACTIVE` | KO — prix/crédits client acceptés |
| Parent subscription requests | `app/api/parent/subscription-requests/route.ts` | GET, POST | Demandes abonnement/add-on | Parent-only | Parent owns student | Traitement staff ultérieur | KO — prix client accepté |
| Assistante credits | `app/api/assistante/credit-requests/route.ts` | GET, POST | Traitement crédits | ADMIN/ASSISTANTE | Staff-only | Type changé mais race possible | KO — idempotence à renforcer |
| Assistante student credits | `app/api/assistante/students/credits/route.ts` | GET, POST | Transactions crédits | ADMIN/ASSISTANTE | Staff-only | N/A | KO — type/montant non bornés |
| Assistante subscriptions | `app/api/assistante/subscriptions/route.ts` | GET, POST | Activation abonnement/crédits | ADMIN/ASSISTANTE | Staff-only | Race possible sur crédits | KO — idempotence à renforcer |
| Assistante subscription requests | `app/api/assistante/subscription-requests/route.ts` | GET, PATCH | Traitement demandes | ADMIN/ASSISTANTE | Staff-only | Refuse non-PENDING | OK — staff only confirmé |
| Admin subscriptions | `app/api/admin/subscriptions/route.ts` | GET, PUT | Gestion abonnement | ADMIN-only | Staff admin | N/A | OK — admin only confirmé |
| Subscriptions change | `app/api/subscriptions/change/route.ts` | POST | Demande changement plan | Parent-only | Parent owns student | Crée `INACTIVE` depuis catalogue | OK — parent owner confirmé |
| Subscriptions ARIA addon | `app/api/subscriptions/aria-addon/route.ts` | POST | Add-on ARIA | Parent-only | Parent owns student + abonnement actif | Retourne prix catalogue, pas d'activation | OK — parent owner confirmé |
| Student credits | `app/api/student/credits/route.ts` | GET | Solde crédits élève | ELEVE-only | `student.userId=session.user.id` | N/A | OK — ownership confirmé |

## Corrections réalisées

### Paiement virement parent

Route : `app/api/payments/bank-transfer/confirm/route.ts`

- Vérifie désormais que `studentId` appartient au parent connecté avant création de `Payment`.
- Refuse `subscription` et `addon` sans `studentId`.
- Ne fait plus confiance à `amount` ni `description` envoyés par le client.
- Résout le produit via catalogue serveur :
  - `SUBSCRIPTION_PLANS`;
  - `ARIA_ADDONS`;
  - `SPECIAL_PACKS`.
- Anti-doublon aligné sur montant/description serveur.

Helper ajouté : `lib/security/payment-catalog.ts`.

### Validation paiement staff

Route : `app/api/payments/validate/route.ts`

- Contrôle que le paiement subscription cible un enfant du parent lié au paiement.
- Remplace l'update simple par `updateMany({ id, status: 'PENDING' })`.
- Si la ligne n'est plus `PENDING`, retourne `409` et ne déclenche ni abonnement ni crédits.
- Les crédits mensuels ne sont créés qu'après l'update atomique du paiement.

### ClicToPay webhook

Route : `app/api/payments/clictopay/webhook/route.ts`

- Le webhook reste non product-ready et retourne `501`.
- Test ajouté : si `CLICTOPAY_WEBHOOK_SECRET` est configuré, une signature invalide retourne `401`.
- Aucun payload complet, secret ou signature n'est loggué.

### Abonnements parent

Route : `app/api/parent/subscriptions/route.ts`

- `planName` doit exister dans `SUBSCRIPTION_PLANS`.
- `monthlyPrice` et `creditsPerMonth` client sont ignorés.
- La subscription créée reste `INACTIVE` avec prix/crédits serveur.

Route : `app/api/parent/subscription-requests/route.ts`

- `PLAN_CHANGE` doit référencer un plan catalogue.
- `ARIA_ADDON` doit référencer un add-on catalogue.
- `monthlyPrice` client est ignoré.
- `INVOICE_DETAILS` reste sans prix.

### Crédits parent/staff

Route : `app/api/parent/credit-request/route.ts`

- Validation Zod : crédits entiers entre 1 et 100.
- Ownership parent/enfant existant conservé.

Route : `app/api/assistante/credit-requests/route.ts`

- Approbation atomique via `updateMany({ id, type: 'CREDIT_REQUEST' })`.
- Si demande déjà traitée, retourne `409` et ne crée pas de crédit.

Route : `app/api/assistante/students/credits/route.ts`

- Types staff autorisés : `CREDIT_ADD`, `CREDIT_REFUND`, `MANUAL_ADJUSTMENT`, `MONTHLY_ALLOCATION`.
- Montant staff strictement positif et fini.

Route : `app/api/assistante/subscriptions/route.ts`

- Approbation atomique via `updateMany({ id, status: 'INACTIVE' })`.
- Si abonnement déjà traité, retourne `409` et ne crée pas de crédits.

## Webhooks

- Signature : ClicToPay vérifie `x-clictopay-signature` par HMAC SHA-256 si `CLICTOPAY_WEBHOOK_SECRET` est configuré.
- Idempotence : aucun traitement financier réel n'est actif; endpoint retourne `501`.
- Montant/devise : non applicable tant que le traitement provider réel n'est pas implémenté.
- Retry : réponse stable `501` tant que non configuré; signature invalide stable `401`.
- Risque résiduel : avant activation ClicToPay réelle, il faudra implémenter vérification provider complète, montant/devise, statut, idempotence par transaction externe et side effects transactionnels.

## Tests exécutés

```bash
npm test -- --runInBand \
  __tests__/api/payments.bank-transfer.confirm.test.ts \
  __tests__/api/payments.validate.route.test.ts \
  __tests__/api/payments.pending.route.test.ts \
  __tests__/api/payments.check-pending.route.test.ts \
  __tests__/api/payments.clictopay.init.route.test.ts \
  __tests__/api/payments.clictopay.webhook.route.test.ts \
  __tests__/api/parent.credit-request.route.test.ts \
  __tests__/api/parent.subscription-requests.route.test.ts \
  __tests__/api/parent.subscriptions.route.test.ts \
  __tests__/api/assistant.credit-requests.route.test.ts \
  __tests__/api/assistant.students.credits.route.test.ts \
  __tests__/api/assistant.subscription-requests.route.test.ts \
  __tests__/api/assistant.subscriptions.route.test.ts \
  __tests__/api/admin.subscriptions.route.test.ts \
  __tests__/api/subscriptions.change.route.test.ts \
  __tests__/api/subscriptions.aria-addon.route.test.ts \
  __tests__/api/student.credits.route.test.ts
```

Résultat : 17 suites, 98 tests passés.

```bash
npm run typecheck
```

Résultat : OK.

```bash
npm run test:unit -- --runInBand
npm run build
```

Résultats :
- Unit complet : 443 suites, 5888 tests passés.
- Build production local : OK.

Intégration :
- DB test `127.0.0.1:5435` indisponible (`connection refused`).
- `npm run test:integration -- --runInBand` non relancé car la dépendance DB test est absente.

Note : les warnings Jest de mocks dupliqués sous `.next/standalone` sont un bruit connu lié à l'artefact local. Un test `check-pending` loggue volontairement une erreur DB simulée.

## Inventaire après patch

Commande :

```bash
node scripts/security/audit-api-guards.mjs
```

Résultat : `docs/security/API_GUARD_INVENTORY.md` régénéré, 164 routes scannées.

Extrait Lot 2A :
- `payments/clictopay/webhook` reste P0 statique car aucun guard session n'est attendu pour un webhook; statut manuel : non product-ready, `501`, signature invalide testée.
- `payments/validate`, `bank-transfer/confirm`, `check-pending`, `pending` restent finance mais sont audités/testés.
- Routes parent/staff subscriptions/credits restent P1/P2 statiques avec guards manuels; statut manuel : corrigées ou confirmées.

## Risques résiduels

- ClicToPay réel non activé : le webhook est volontairement non product-ready.
- `check-pending` accepte description/montant client pour rechercher un pending existant mais ne sort que le scope parent connecté.
- Les factures parent restent basées sur email dans le modèle existant; hors Lot 2A car traité en Lot 1.
- L'audit route-by-route P0-004 global reste ouvert : NPC, messages, admin users, assistante students/coaches, assessments submit/test.
- DB test d'intégration locale indisponible sur `127.0.0.1:5435`.

## Prochain lot recommandé

Lot 2B :

1. Admin users.
2. Assistante students/coaches/credits restants hors surface financière directe.
3. Paiements admin historiques si routes additionnelles découvertes.

Puis :
- Lot 2C : NPC reports/submissions/documents.
- Lot 2D : messages/conversations.
- Lot 2E : assessments submit/test.

## Déploiement production

Date :
- UTC : 2026-05-28 22:xx.
- Serveur : 2026-05-29 00:xx +02.

Commit déployé :
- `e3c07144b fix(security): enforce payment and subscription ownership`.

État avant déploiement :
- Production avant pull : `1f37eeb0 fix(security): enforce API ownership checks lot 1`.
- Branche : `main`.
- Worktree production : propre.
- PM2 `nexus-prod` : online.
- Port applicatif : `127.0.0.1:3001`.
- Santé locale `/api/health` : 200.
- Site public `/` : 200.
- Chemins sensibles pré-déploiement : 404.

Backup :
- Chemin : `/root/nexus-backups/p0-004-lot2a-deploy-20260529001813`.
- Contenu : HEAD Git avant déploiement, status Git, PM2 jlist/describe, état `ss`, copies de `ecosystem.config.js`, `package.json`, `package-lock.json`.
- Aucun secret copié volontairement.

Commandes principales :

```bash
git fetch origin main
git pull --ff-only origin main
npm run typecheck
npm test -- --runInBand <17 tests Lot 2A>
npm run build
pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 save
```

Vérifications serveur :
- `npm run typecheck` : OK.
- Tests ciblés Lot 2A : 17 suites, 98 tests OK.
- `npm run build` : OK.
- PM2 `nexus-prod` : online après reload.
- Port : `127.0.0.1:3001`, pas de retour à `0.0.0.0:3001`.

Smoke production :

| Check | Résultat |
|---|---|
| `/` | 200 |
| `/offres` | 200 |
| `/stages` | 200 |
| `/dashboard/eleve` sans auth | 307 |
| `/api/health` local | 200 |
| `POST /api/payments/bank-transfer/confirm` sans auth | 401 |
| `POST /api/payments/validate` sans auth | 401 |
| `POST /api/payments/check-pending` sans auth | 405 |
| `POST /api/parent/credit-request` sans auth | 401 |
| `GET /api/parent/subscriptions` sans auth | 401 |
| `POST /api/parent/subscription-requests` sans auth | 401 |
| `POST /api/subscriptions/change` sans auth | 401 |
| `POST /api/subscriptions/aria-addon` sans auth | 401 |
| `POST /api/payments/clictopay/webhook` payload vide | 501 |
| `POST /api/payments/clictopay/webhook` signature invalide | 501 |
| `/.env` | 404 |
| `/.git/config` | 404 |
| `/.next/standalone/.env` | 404 |
| `/docker-compose.prod.yml` | 404 |
| `/prisma/schema.prisma` | 404 |

Logs :
- `pm2 logs nexus-prod --lines 160 --nostream` filtré : aucune erreur critique applicative nouvelle.

ClicToPay :
- Le paiement carte n'est pas product-ready.
- Le webhook retourne `501` et ne valide aucun paiement.
- L'activation commerciale ClicToPay reste interdite tant que provider réel, signature, montant/devise et idempotence ne sont pas implémentés et testés.

Rollback :
- Prévu : retour au commit `207382f19`, rebuild, puis `pm2 startOrReload ecosystem.config.js --env production --update-env`.
- Non exécuté : aucune condition critique de rollback rencontrée.
