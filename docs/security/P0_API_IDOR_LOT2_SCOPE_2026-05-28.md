# P0-004 API IDOR Lot 2 — Cadrage

Date : 2026-05-28

Ce document prépare le prochain lot d'audit/correction. Aucune correction Lot 2 n'a été appliquée dans le cycle de déploiement du Lot 1.

## Verdict de cadrage

Le Lot 2 doit traiter les routes encore sensibles après le déploiement du Lot 1 : assessments submit/test, NPC, paiements, abonnements, admin users, assistante et messagerie. Le go-live large reste interdit tant que ces routes n'ont pas été triées.

## Tableau préparatoire

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Risque | Priorité |
|---|---|---|---|---|---|---|---|
| Assessments | `app/api/assessments/submit/route.ts` | À confirmer | Résultats élèves, diagnostic | À lire | Élève/parent/staff autorisé selon assessment ciblé; pas d'usurpation de `studentId` | Mutation de données pédagogiques | P0-A |
| Assessments | `app/api/assessments/test/route.ts` | À confirmer | Données de test potentiellement exposées | À lire | Désactivation prod ou staff-only si endpoint technique | Endpoint test en production | P2 si désactivé, P0-B sinon |
| NPC submissions | `app/api/**/submissions/**/route.ts` | À confirmer | Copies élèves, fichiers, états IA | À lire | Élève propriétaire, parent enfant, coach assigné, staff | Données scolaires et documents | P0-A |
| NPC reports | `app/api/**/reports/**/route.ts` | À confirmer | Rapports pédagogiques IA, corrections | À lire | Élève/parent/coach assigné/staff selon audience | Fuite de rapport ou contenu interne | P0-A |
| NPC documents | `app/api/**/documents/**/route.ts` | À confirmer | Fichiers uploadés | À lire | Autorisation avant accès disque | Fuite document | P0-A |
| Payments | `app/api/**/payments/**/route.ts` | À confirmer | Paiements, statuts, identifiants transaction | À lire | Parent propriétaire ou staff; webhook signé | Fuite financière ou validation abusive | P0-A |
| Bank transfer | `app/api/**/bank-transfer/**/route.ts` | À confirmer | Preuves paiement, demandes | À lire | Parent propriétaire ou staff | Mutation financière | P0-B |
| ClicToPay/Konnect | `app/api/**/webhook*/route.ts` | À confirmer | Paiements externes | À lire | Signature provider, idempotence | Falsification paiement | P0-A |
| Subscriptions | `app/api/**/subscriptions/**/route.ts` | À confirmer | Abonnement, droits, offres | À lire | Parent owner ou staff; assistante selon policy | Escalade droits/entitlements | P0-B |
| Admin users | `app/api/admin/**/users/**/route.ts` | À confirmer | Comptes, rôles, activation | À lire | Admin-only sauf policy explicite | Escalade compte/rôle | P0-A |
| Assistante students | `app/api/assistante/**/students/**/route.ts` | À confirmer | Données élèves, activation | À lire | Assistante/admin uniquement, scope opérationnel | Données mineurs | P0-A |
| Assistante coaches | `app/api/assistante/**/coaches/**/route.ts` | À confirmer | Profils coachs, affectations | À lire | Assistante/admin uniquement | Données staff et affectations | P1 |
| Assistante credits | `app/api/assistante/**/credits/**/route.ts` | À confirmer | Crédits, transactions | À lire | Assistante/admin selon policy | Mutation financière | P0-B |
| Messages | `app/api/**/messages/**/route.ts` | À confirmer | Conversations, pièces jointes | À lire | Participant conversation ou staff selon policy | IDOR conversation | P0-A |
| Conversations | `app/api/**/conversations/**/route.ts` | À confirmer | Historique message | À lire | Participant conversation | Fuite PII | P0-A |

## Priorité recommandée

1. Payments/webhooks/subscriptions. Statut 2026-05-28 : Lot 2A corrigé et testé localement, non déployé production.
2. Admin users et assistante students/credits.
3. NPC reports/submissions/documents.
4. Messages/conversations.
5. Assessments submit/test.

## Vérifications attendues

- Un test négatif IDOR/RBAC par groupe P0-A.
- Une preuve staff-only pour les routes admin/assistante.
- Une vérification d'idempotence et signature pour webhooks paiement.
- Aucun accès fichier avant autorisation pour les routes documents/NPC.
- Aucun contenu interne Nexus exposé aux élèves/parents.
