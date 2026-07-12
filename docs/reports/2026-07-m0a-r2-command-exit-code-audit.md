# M0A-R2 — Audit des codes de sortie

> Date : 2026-07-12
> Branche : `review/pre-rentree-2026-m0a-r2`

## Comparaison M0A-R (R1) vs M0A-R2

| Commande | Exit R1 annoncé | Exit R1 réel (pipe masqué) | Exit R2 | Cause de divergence |
|----------|----------------|---------------------------|---------|---------------------|
| `npm run typecheck` | "FAIL (5 erreurs)" | Non exécuté directement | **0** | R1 utilisait `npx tsc` avec `npm ci --ignore-scripts` → Prisma non généré |
| `npm run lint` | "FAIL (388 erreurs)" | Non exécuté directement | **0** | R1 utilisait `npx eslint .` au lieu de `npm run lint` (seuil 300 warnings) |
| Tests sécurité | "34 échoués" | Code de sortie masqué par pipe | **0** (773 pass) | R1 : Prisma non généré → `DocumentVisibilityScope` undefined + rbac-matrix null |
| `audit-api-guards.mjs` | "SUCCESS" | 0 | **0** | Correct |
| Build | "Non exécuté" | N/A | **0** | R1 prétendait que secrets requis ; faux — .env.example suffit |
| `git diff --check` | "Aucune erreur" | 0 | **0** | Correct |

## Causes racines

### 1. `npm ci --ignore-scripts`

Cette commande empêche `@prisma/client`'s postinstall hook de générer le client Prisma. Conséquences :
- `DocumentVisibilityScope` undefined → `documents-access.test.ts` crash à l'import (0 tests)
- Imports Prisma dans `services/npc-worker/` échouent au typecheck
- `rbac-matrix.test.ts` : test de connexion DB renvoie null → 34 tests "échoués" (en réalité, graceful skip)

### 2. Commandes non canoniques

R1 utilisait `npx tsc --noEmit` et `npx eslint . --max-warnings 300` au lieu de `npm run typecheck` et `npm run lint` (qui sont les commandes du dépôt dans package.json).

### 3. Pipe vers tail masquant les exit codes

Les commandes R1 utilisaient `| tail -20` qui retourne le code de sortie de `tail` (toujours 0), pas celui de la commande précédente.

## Résolution

- Installation avec `npm ci` (scripts activés, Prisma généré)
- Commandes canoniques `npm run typecheck`, `npm run lint`
- Codes de sortie capturés directement (`cmd > file 2>&1; echo "EXIT:$?"`)
- Build exécuté avec `.env.example` copié en `.env.local` (valeurs fictives)
