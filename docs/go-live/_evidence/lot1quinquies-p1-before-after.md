# Lot 1-quinquies — P1 avant/après

Date locale : 2026-07-03.

## Synthèse

| Priorité | Avant | Après |
| --- | ---: | ---: |
| P0 | 0 | 0 |
| P1 | 12 | 6 |
| P2 | 137 | 143 |
| OK | 27 | 27 |
| Total | 176 | 176 |

Commande de preuve :

```bash
node scripts/security/audit-api-guards.mjs
node scripts/go-live/generate-api-security-matrix.mjs
```

Résultat observé après corrections :

```text
Wrote docs/security/API_GUARD_INVENTORY.md (176 routes)
Wrote docs/go-live/api-security-matrix.full.md (176 routes)
P0: 0, P1: 6, P2: 143, OK: 27
```

## Routes P1 fermées

| Route | Avant | Après | Type de preuve |
| --- | --- | --- | --- |
| `/api/admin/config` | P1 | P2 | Zod strict PATCH + test champs inattendus |
| `/api/admin/config/rollback` | P1 | P2 | Zod strict + test champs inattendus |
| `/api/admin/directeur/stats` | P1 | P2 | `requireRole(UserRole.ADMIN)`, query stricte, rate limit + tests |
| `/api/admin/recompute-ssn` | P1 | P2 | `requireRole(UserRole.ADMIN)`, body strict, rate limit + tests |
| `/api/admin/subscriptions` | P1 | P2 | query/body stricts, pagination bornée, select explicite + tests |
| `/api/admin/test-email` | P1 | P2 | ADMIN-only, body strict, réponse sans email destinataire + tests |

## Routes P1 restantes

| Route | Justification |
| --- | --- |
| `/api/payments/clictopay/webhook` | Ne peut pas devenir OK tant que l'intégration ClicToPay est désactivée/incomplète |
| `/api/assessments/submit` | Route publique sensible ; fermeture complète nécessite décision token/session/auth |
| `/api/bilan-gratuit` | Dette produit/RGPD : création de comptes inactifs malgré réponse API durcie |
| `/api/lamis/teacher-report` | Route pédagogique publique à arbitrer avant bêta élargie |
| `/api/stages/[stageSlug]/inscrire` | Route publique de conversion ; reste sensible malgré Zod/rate limit/no-leak |
| `/api/student/activate` | Route publique par token ; reste sensible par nature jusqu'à audit activation complet |
