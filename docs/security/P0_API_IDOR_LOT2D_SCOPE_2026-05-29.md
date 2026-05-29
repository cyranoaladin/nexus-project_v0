# P0-004 Lot 2D — Messages / conversations

Date : 2026-05-29

Ce document cadre le prochain sous-lot P0-004 après le déploiement production du Lot 2C. Il ne contient aucune correction applicative.

## Verdict de cadrage

Le Lot 2D doit auditer les routes de messagerie, conversations et éventuelles pièces jointes. Le go-live large reste non autorisé tant que Lot 2D et Lot 2E ne sont pas triés.

Statut 2026-05-29 : Lot 2D corrigé et testé localement. Rapport détaillé : `docs/security/P0_API_IDOR_LOT2D_MESSAGES_CONVERSATIONS_2026-05-29.md`. Non déployé production dans ce cycle.

## Tableau préparatoire

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Risque | Priorité |
|---|---|---|---|---|---|---|---|
| Messages send | `app/api/messages/send/route.ts` | À confirmer | Contenu message, sender/receiver | À lire | `senderId` issu de la session; receiver autorisé | Usurpation sender/receiver | P0-B |
| Conversations | `app/api/messages/conversations/route.ts` | À confirmer | Conversations, emails, read state | À lire | Participant uniquement ou staff autorisé | Lecture conversation sans ownership | P0-A |
| Attachments | `app/api/messages/**/attachments/**` si existant | À confirmer | `fileUrl`, `fileName`, fichier disque | À lire | Participant avant accès fichier | Fuite fichier / path traversal | P0-A |
| Conversation read state | routes `read`, `readAt` si existantes | À confirmer | Statut lecture, participants | À lire | Participant uniquement | Marquage abusif / énumération | P0-B |

## Règles de cadrage Lot 2D

- `senderId` doit venir de la session, jamais du client.
- `receiverId` doit être autorisé selon la relation métier.
- Lecture conversation : participant uniquement ou staff autorisé.
- Attachments : auth + participant avant accès fichier.
- `fileUrl` ne doit pas permettre path traversal ni accès public non signé.
- Pas d'énumération d'emails/utilisateurs via messaging.
- Rate limit à planifier en P1 si absent.

## Classification

- P0-A : lecture message/conversation/attachment sans ownership.
- P0-B : envoi message avec `senderId` ou `receiverId` usurpé.
- P1 : staff-only peu exposé mais guard manuel.
- P2 : route technique/test.

## Hors périmètre Lot 2D

- Assessments submit/test : Lot 2E.
- CSP/CORS/Jitsi : P1.
- UX, dashboards, business, marketing.
