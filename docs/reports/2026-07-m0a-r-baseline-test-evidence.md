# M0A-R Baseline Test Evidence

> Date : 2026-07-11
> Branche : `feat/pre-rentree-2026-m0a-review`
> SHA : `0d2206fe90aa3dc5e84eb60bb42e7da1b1402119`
> origin/main : `c90b142c88d69bdc600f3f848b44ca0317c00242`

## Résultats avant modification

### Typecheck (`npx tsc --noEmit`)

- **Résultat** : FAIL (5 erreurs)
- **Localisation** : `services/npc-worker/processors/ai-service.ts` uniquement
- **Cause** : imports Prisma (`PrismaClient`, `AiJobType`, `CopySubmission`) absents — service séparé hors app principale
- **Classification** : préexistant, hors périmètre M0A-R
- **Impact M0A-R** : aucun — le service NPC worker n'est pas dans le périmètre sécurité routes API

### Lint (`npx eslint . --max-warnings 300`)

- **Résultat** : FAIL (388 erreurs, 1581 warnings)
- **Classification** : préexistant, dette technique connue
- **Impact M0A-R** : aucune modification ne doit augmenter ces compteurs

### Tests unitaires sécurité

**Commande** : `npx jest --config jest.unit.config.js --testPathPattern='__tests__/(api|lib)/(guards|rbac|documents|invoice|payments|bilans|sessions)'`

| Métrique | Valeur |
|----------|--------|
| Suites totales | 48 |
| Suites réussies | 45 |
| Suites échouées | 3 |
| Tests totaux | 631 |
| Tests réussis | 597 |
| Tests échoués | 34 |
| Durée | 2.739 s |

**Suites échouées (préexistantes)** :

| Suite | Tests échoués | Cause |
|-------|--------------|-------|
| `__tests__/api/rbac-matrix.test.ts` | 34/34 | `testUsers.student` est `null` — fixture DB non disponible en mode unitaire |

**Diagnostic** : `rbac-matrix.test.ts` dépend d'une connexion DB pour créer des fixtures utilisateur. En mode unitaire (jest.unit.config.js), aucune DB n'est disponible. Tous les 34 tests échouent sur la même erreur : `TypeError: Cannot read properties of null (reading 'id')` à la ligne 104.

**Classification** : préexistant — ce test est un test d'intégration mal classé en unitaire.

### Audit API Guards

**Commande** : `node scripts/security/audit-api-guards.mjs`

- **Résultat** : SUCCESS
- **Routes classifiées** : 176
- **P0** : 0 ✅
- **P1** : 2 (assessments/submit, clictopay/webhook)
- **PUBLIC** : 3
- **P2** : 144
- **OK** : 27

### Inventaire complet

Les suites passées couvrent :

| Domaine | Suite | Tests | Statut |
|---------|-------|-------|--------|
| Guards centraux | guards.test.ts | ✅ | PASS |
| RBAC policies | rbac.test.ts | ✅ | PASS |
| Documents download | documents-download.test.ts | 16 | PASS |
| Documents access | documents-access.test.ts | ✅ | PASS |
| Invoice access scope | invoice/access-scope.test.ts | ✅ | PASS |
| Invoice date | invoices.issuedAt.test.ts | 134 | PASS |
| IDOR bilans | bilans.idor.test.ts | ✅ | PASS |
| IDOR bilans generate | bilans.generate.idor.test.ts | ✅ | PASS |
| Bilans generate | bilans/generate.test.ts | ✅ | PASS |
| Webhook ClicToPay | payments.clictopay.webhook.test.ts | ✅ | PASS |
| Webhook route | payments.clictopay.webhook.route.test.ts | 3 | PASS |
| Init ClicToPay | payments.clictopay.init.route.test.ts | 3 | PASS |
| Sessions video | sessions.video.route.test.ts | ✅ | PASS |
| Parent children | parent.children.route.test.ts | ✅ | PASS |
| Parent activation | parent.children.activation.route.test.ts | ✅ | PASS |
| Coach bilan diag | coach.bilan-diagnostic-maths-terminale.security.test.ts | ✅ | PASS |
| Audit classification | scripts/audit-api-guards.classification.test.ts | ✅ | PASS |
| Pre-commit hook | scripts/pre-commit-hook.test.ts | ✅ | PASS |
| Seed guard | scripts/seed-e2e-guard.test.ts | ✅ | PASS |
