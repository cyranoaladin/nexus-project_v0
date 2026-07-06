# Lot 1-quinquies — Routes admin P1

## Synthèse

Les six routes admin P1 identifiées après Lot 1-quater sont passées P2 par correction de code et tests. Aucune baisse ne vient d'une modification du script d'audit.

| Route | Correction | Tests |
| --- | --- | --- |
| `/api/admin/config` | Zod strict PATCH, rejet champs inattendus avant transaction | `__tests__/api/admin.config.route.test.ts` |
| `/api/admin/config/rollback` | Zod strict rollback, rejet `force` implicite | `__tests__/api/admin.config.route.test.ts` |
| `/api/admin/directeur/stats` | `requireRole(UserRole.ADMIN)`, query vide stricte, rate limit avant DB | `__tests__/api/admin.directeur.stats.route.test.ts` |
| `/api/admin/recompute-ssn` | `requireRole(UserRole.ADMIN)`, body strict, rate limit avant calcul | `__tests__/api/admin.recompute-ssn.route.test.ts` |
| `/api/admin/subscriptions` | query/body stricts, pagination bornée, projections explicites | `__tests__/api/admin.subscriptions.route.test.ts` |
| `/api/admin/test-email` | ADMIN-only, body strict, pas d'adresse email dans message succès | `__tests__/api/admin.test-email.route.test.ts` |

## Risques résiduels

Ces routes restent P2 statiques car elles manipulent de la configuration, des stats ou données admin. Elles ne sont pas autorisées hors rôle admin et doivent rester couvertes par monitoring/logs sobres.
