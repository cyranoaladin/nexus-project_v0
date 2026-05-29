# P0-004 Lot 2D — Messages / conversations

Date : 2026-05-29

## Verdict

| Groupe | Statut | Tests | Risque résiduel |
|---|---|---|---|
| Send / receiver authorization | Corrigé | `__tests__/api/messages.send.route.test.ts`, `__tests__/lib/security/message-access.test.ts` | Rate limit et modération contenu à traiter en P1. |
| Message listing / conversations | Corrigé | `__tests__/api/messages.conversations.route.test.ts`, `__tests__/lib/security/message-access.test.ts` | Pas de route détail/read state dédiée observée. |
| Attachments / files | Route absente | Audit statique | Pièces jointes désactivées côté route `send`; future surface à traiter avant activation. |

## Inventaire manuel

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Fichiers ? | Verdict |
|---|---|---|---|---|---|---|---|
| Send | `app/api/messages/send/route.ts` | POST | Contenu message, sender/receiver, éventuel fichier | `auth()` manuel | `senderId` session + relation receiver | `fileUrl` legacy | KO avant patch : `receiverId` trop permissif et `fileUrl` arbitraire. Corrigé. |
| Conversations | `app/api/messages/conversations/route.ts` | GET | Messages, participants, read state | `auth()` manuel | Participant via `senderId/receiverId` | Non | KO avant patch : `lastMessage` complet pouvait exposer `fileUrl` ou champs inclus. Corrigé. |
| Attachments | N/A | N/A | Fichiers message | N/A | N/A | N/A | Route absente dans le dépôt. |
| Read state | N/A | N/A | `readAt` | N/A | N/A | Non | Route absente dans le dépôt. |

## Corrections réalisées

- Création de `lib/security/message-access.ts`.
- `senderId` reste imposé par `session.user.id`; le body client ne peut pas choisir l'expéditeur.
- `receiverId` est validé par rôle et relation métier :
  - staff vers utilisateurs utiles;
  - coach vers élèves assignés ou parents d'élèves assignés;
  - parent vers coachs assignés à ses enfants;
  - élève vers coach assigné ou staff.
- Auto-message refusé.
- `fileUrl` / `fileName` arbitraires refusés tant qu'aucune surface attachment autorisée n'existe.
- `fileName` n'est pas retourné dans les projections message; seul `hasAttachment` reste exposé pour éviter les chemins ou noms de fichiers privés.
- Projection message minimale via `sanitizeMessage`.
- Projection participant minimale via `sanitizeMessageUser`.
- Logs d'erreur sans contenu de message.

## Send / receiver authorization

Avant :

- `ELEVE` était seulement limité aux rôles `COACH` / `ASSISTANTE`.
- `COACH`, `PARENT`, `ADMIN`, `ASSISTANTE` n'avaient pas de contrôle relationnel explicite hors existence du receiver.
- `fileUrl` et `fileName` étaient acceptés depuis le body.

Après :

- `COACH` doit avoir une affectation active avec l'élève cible.
- `PARENT` doit avoir un enfant avec une affectation active au coach cible.
- `ELEVE` doit avoir une affectation active au coach cible, ou contacter le staff.
- Staff autorisé selon policy.
- Pièces jointes inline interdites sur cette route.

## Message listing / conversations

Avant :

- Le listing était bien scoped par `senderId === session.user.id OR receiverId === session.user.id`.
- Mais `lastMessage` reprenait l'objet Prisma complet retourné, pouvant transporter `fileUrl` ou champs ajoutés par un include futur.

Après :

- Conversations toujours participant-scoped.
- `user` et `lastMessage` sont projetés explicitement.
- `fileUrl`, `fileName`, chemins disque, password, tokens et champs internes ne sont pas retournés.

## Conversations / threads

Aucune route `app/api/conversations/**`, `threads`, `inbox`, `outbox` ou détail message dynamique n'a été trouvée dans ce lot. La surface active est limitée à :

- `app/api/messages/send/route.ts`
- `app/api/messages/conversations/route.ts`

## Read state

Aucune route read state dédiée n'a été trouvée. Le champ `readAt` est seulement lu dans `messages/conversations`.

## Attachments / files

Aucune route attachment/download message n'a été trouvée. Par sécurité, `POST /api/messages/send` refuse désormais `fileUrl` et `fileName` tant qu'un endpoint attachment autorisé n'existe pas.

## Champs sensibles

- `password` : non retourné par projections.
- `activationToken` : non retourné par projections.
- reset tokens : non retournés par projections.
- `fileUrl` : non retourné; refusé à l'envoi.
- `fileName` : non retourné; refusé à l'envoi.
- chemins disque : non retournés.
- emails/phones : non retournés par projections messaging.
- profils complets : non retournés.

## Tests exécutés

```bash
npm test -- --runInBand \
  __tests__/api/messages.send.route.test.ts \
  __tests__/api/messages.conversations.route.test.ts \
  __tests__/lib/security/message-access.test.ts
```

Résultat initial RED : échec attendu sur `receiverId` relationnel, `fileUrl` arbitraire et projections.

Résultat après patch : 3 suites, 16 tests OK.

```bash
npm run typecheck
```

Résultat : OK.

```bash
npm run test:unit -- --runInBand
```

Résultat : 446 suites, 5911 tests OK.

```bash
npm run build
```

Résultat : OK.

```bash
(timeout 2 bash -c '</dev/tcp/127.0.0.1/5435' && echo 'db_test_5435:open') || echo 'db_test_5435:closed'
```

Résultat : `db_test_5435:closed`. `npm run test:integration -- --runInBand` n'a pas été lancé car la DB test locale est indisponible.

## Inventaire après patch

```bash
node scripts/security/audit-api-guards.mjs
```

Résultat : `docs/security/API_GUARD_INVENTORY.md` régénéré, 164 routes scannées.

## Risques résiduels

- Rate limiting messaging en P1.
- Modération/filtrage contenu en P1.
- Audit trail messages en P1.
- Pièces jointes signées à concevoir avant toute activation attachment.
- DB test d'intégration `127.0.0.1:5435` indisponible.
- P0-004 global reste ouvert : Lot 2E assessments submit/test.

## Prochain lot recommandé

- Lot 2E : assessments submit/test.
- P1 : rate limit messaging, modération contenu, audit trail messages, pagination stricte, pièces jointes signées.

## Déploiement

Non déployé en production dans ce cycle.

Déploiement recommandé après validation :

1. Préflight prod Git/PM2/health.
2. Backup applicatif minimal.
3. `git pull --ff-only origin main`.
4. `npm run typecheck`.
5. Tests ciblés Lot 2D.
6. `npm run build`.
7. `pm2 startOrReload ecosystem.config.js --env production --update-env`.
8. Smoke : public, `/api/health`, routes messages sans auth, `send` sans auth, chemins sensibles, logs.
