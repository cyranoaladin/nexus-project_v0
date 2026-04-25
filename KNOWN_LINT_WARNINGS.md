# Known Lint Warnings — Nexus Réussite

> Dernière mise à jour : 2026-04-25
> Total : 103 warnings
> Aucun dans les fichiers Phase 6 (dashboard/eleve SSoT)

Ces warnings sont **pré-existants** et hors scope des PRs en cours. Ils ne bloquent pas le build.

## Catégories

### `@typescript-eslint/no-explicit-any` (~55 occurrences)

Pattern systématique dans les routes API utilisant `prisma.$queryRaw` ou des types d'erreur non typés (`catch (err: any)`). Correction prévue lors d'une PR dédiée "strict-any cleanup".

Fichiers principaux :
- `app/api/aria/**` (3 routes)
- `app/api/bilan-gratuit/**` (3 routes)
- `app/api/bilans/route.ts`
- `app/api/coach/trajectory/route.ts`
- `app/api/payments/validate/route.ts`
- `app/api/student/automatismes/**`
- `app/dashboard/coach/page.tsx`
- `app/dashboard/parent/**`
- `app/programme/maths-1ere/components/**` (~15 occurrences)

### `@typescript-eslint/no-unused-vars` (~48 occurrences)

Imports et variables laissés lors de refactorisations partielles. Pattern courant :
- Icônes Lucide importées mais remplacées
- Hooks `useState` créés pour fonctionnalités futures
- Types Prisma importés pour référence future

Fichiers principaux :
- `app/api/student/automatismes/series/[id]/route.ts` (8 vars — destructuring d'objet QCM non utilisé)
- `components/automatismes/AutomatismesPlayer.tsx` (3 imports)
- `components/automatismes/AutomatismesResults.tsx` (5 imports/vars)
- `app/programme/maths-1ere/components/Enseignant/TeacherView.tsx` (5 vars)
- `app/dashboard/parent/**` (4 vars)

## Décision

Ces warnings ne seront **pas corrigés dans cette PR** (feat/dashboards-premiere-finalization) car :
1. Hors scope de la finalisation dashboard élève
2. Corrections risquent d'introduire des effets de bord non testés
3. CI Next.js build passe (warnings != errors)

**Action future** : PR séparée `chore/lint-cleanup` après déploiement prod de la PR en cours.
