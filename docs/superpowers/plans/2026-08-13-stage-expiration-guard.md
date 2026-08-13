# Stage Expiration Guard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer proprement `printemps-2026` et empêcher tout stage terminé de rester public, indexable ou inscriptible.

**Architecture:** Une règle temporelle pure et injectable définit l’expiration. Les requêtes publiques, le sitemap, le POST et l’administration l’appliquent à leur frontière ; une redirection statique exacte traite uniquement la fiche legacy déjà indexable.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 6, Jest 29, Playwright 1.58.

---

## Chunk 0: Fermeture opérationnelle réversible

### Task 0: Archiver la seule ligne de production concernée

**Files:**
- Aucun fichier du dépôt

- [x] **Step 1: lire et verrouiller la ligne exacte sans PII**

La ligne `printemps-2026` était `isVisible=true`, `isOpen=true`, avec deux
réservations `COMPLETED`.

- [x] **Step 2: mettre les deux drapeaux à false dans une transaction ciblée**

L’opération a exigé exactement une ligne affectée et n’a exécuté aucun
`DELETE`.

- [x] **Step 3: relire l’état et l’historique avant COMMIT**

Après mutation : `isVisible=false`, `isOpen=false`, toujours deux réservations
`COMPLETED`.

- [x] **Step 4: vérifier les surfaces publiques**

Avec le code actuellement déployé : fiche et inscription `404`, API publique
vide, slug absent du sitemap. La PR introduit ensuite le `301` de la fiche.

## Chunk 1: Invariant et frontières serveur

### Task 1: Règle temporelle centrale et lectures publiques

**Files:**
- Create: `lib/stages/lifecycle.ts`
- Create: `__tests__/lib/stages/lifecycle.test.ts`
- Modify: `lib/stages/public.ts:227-266`
- Modify: `__tests__/api/stages/stages-list.test.ts`

- [ ] **Step 1: écrire les tests rouges de la règle pure**

Tester avec `now = 2026-08-13T12:00:00Z` : fin en avril expirée, fin future valide, fin exactement égale à `now` valide.

- [ ] **Step 2: lancer le test et constater l’échec attendu**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/lib/stages/lifecycle.test.ts`

Expected: FAIL car `lib/stages/lifecycle.ts` n’existe pas.

- [ ] **Step 3: implémenter le prédicat minimal**

Exporter `isStageExpired(endDate, now)` et `getActiveStageEndDateFilter(now)` sans lecture système cachée.

- [ ] **Step 4: lancer le test et constater le vert**

Run: même commande. Expected: PASS.

- [ ] **Step 5: écrire les tests rouges des getters publics**

Vérifier que `listPublicStages` et `getPublicStageBySlug` transmettent
`endDate: { gte: now }`, et remplacer les fixtures valides d’avril par une
date future.

- [ ] **Step 6: lancer les tests et constater l’échec attendu**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/api/stages/stages-list.test.ts`

Expected: FAIL sur l’absence de filtre `endDate`.

- [ ] **Step 7: appliquer le filtre minimal aux deux getters**

Ajouter un paramètre `now` par défaut à la frontière publique et utiliser le
même filtre Prisma.

- [ ] **Step 8: relancer les tests ciblés**

Expected: PASS.

- [ ] **Step 9: commit**

```bash
git add lib/stages/lifecycle.ts lib/stages/public.ts \
  __tests__/lib/stages/lifecycle.test.ts __tests__/api/stages/stages-list.test.ts
git commit -m "fix(stages): borner les surfaces publiques par la date"
```

### Task 2: Refus atomique du POST d’inscription

**Files:**
- Modify: `app/api/stages/[stageSlug]/inscrire/route.ts:85-94`
- Modify: `__tests__/api/stages/inscriptions.test.ts`
- Modify: `__tests__/api/stages.inscrire.security.test.ts` si ses fixtures doivent recevoir `endDate`

- [ ] **Step 1: écrire le test rouge du stage expiré**

Figer l’horloge ; vérifier la clause Prisma `endDate >= now`, le statut `404`
et l’absence de recherche de doublon, transaction, création et notification.

- [ ] **Step 2: lancer le test et constater l’échec attendu**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/api/stages/inscriptions.test.ts`

- [ ] **Step 3: ajouter le filtre atomique à la sélection du stage**

Conserver le message et le statut `404` existants.

- [ ] **Step 4: relancer les tests inscription et sécurité**

Expected: PASS, sans changement de réponse publique.

- [ ] **Step 5: commit**

```bash
git add app/api/stages/[stageSlug]/inscrire/route.ts \
  __tests__/api/stages/inscriptions.test.ts __tests__/api/stages.inscrire.security.test.ts
git commit -m "fix(stages): refuser les inscriptions après la fin"
```

### Task 3: Sitemap, redirection 301 et seed fermé

**Files:**
- Modify: `app/sitemap.ts:149-174`
- Modify: `next.config.mjs`
- Modify: `prisma/seed.ts:603-626`
- Create: `__tests__/stages/expired-stage-sitemap.test.ts`
- Create: `__tests__/stages/expired-stage-routing.test.ts`
- Create: `__tests__/stages/expired-stage-seed-contract.test.ts`

- [ ] **Step 1: écrire les tests rouges sitemap et configuration**

Le nouveau test dédié aux stages doit vérifier que le sitemap requête
`endDate >= now`, conserve le témoin futur et n’émet pas le passé, sans modifier
les tests ou le parcours Pré-rentrée. La configuration doit déclarer uniquement
`/stages/printemps-2026 -> /stages` avec `statusCode: 301`, sans redirection
de `/inscription`.

- [ ] **Step 2: lancer les tests et constater les échecs attendus**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/stages/expired-stage-sitemap.test.ts __tests__/stages/expired-stage-routing.test.ts`

- [ ] **Step 3: implémenter le filtre sitemap et le 301 exact**

Ne modifier aucune route de campagne Pré-rentrée.

- [ ] **Step 4: écrire et lancer le test rouge du seed**

Le contrat source doit échouer tant que l’upsert contient `update: {}` ou crée
le stage avec un des drapeaux à `true`. Il ne doit jamais exécuter le seed.

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/stages/expired-stage-seed-contract.test.ts`

- [ ] **Step 5: fermer les deux branches de l’upsert seed**

Définir `update: { isVisible: false, isOpen: false }` et les mêmes valeurs dans
`create` pour `printemps-2026`.

- [ ] **Step 6: relancer les tests ciblés**

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add app/sitemap.ts next.config.mjs prisma/seed.ts \
  __tests__/stages/expired-stage-sitemap.test.ts \
  __tests__/stages/expired-stage-routing.test.ts \
  __tests__/stages/expired-stage-seed-contract.test.ts
git commit -m "fix(stages): désindexer le stage printemps 2026"
```

### Task 4: Empêcher la création et la réouverture administratives

**Files:**
- Modify: `app/api/admin/stages/route.ts:137-180`
- Modify: `app/api/admin/stages/[stageId]/route.ts:99-157`
- Modify: `__tests__/api/admin.stages.route.test.ts`

- [ ] **Step 1: écrire les tests rouges administratifs**

Cas avec horloge figée : création expirée ouverte explicite ou ouverte par
défaut refusée ; création expirée fermée autorisée ; PATCH rouvrant une ligne
expirée refusé ; PATCH d’un autre champ sur une ligne expirée encore ouverte
refusé ; PATCH déplaçant seulement `endDate` dans le passé alors que `isOpen`
reste vrai refusé ; PATCH fermant la ligne autorisé ; PATCH futur inchangé.

- [ ] **Step 2: lancer le test et constater l’échec attendu**

Run: `npx jest --config jest.unit.config.js --runInBand __tests__/api/admin.stages.route.test.ts`

- [ ] **Step 3: valider l’état effectif avec la règle centrale**

Pour POST, utiliser le payload parsé. Pour PATCH, combiner `payload.endDate ??
existingStage.endDate` et `payload.isOpen ?? existingStage.isOpen`. Répondre
`400` avant toute écriture si l’état effectif est expiré et ouvert.

- [ ] **Step 4: relancer le test ciblé**

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add app/api/admin/stages/route.ts app/api/admin/stages/[stageId]/route.ts \
  __tests__/api/admin.stages.route.test.ts
git commit -m "fix(stages): bloquer la réouverture des stages expirés"
```

## Chunk 2: Gate E2E et vérification complète

### Task 5: Gate E2E du cycle de vie

**Files:**
- Create: `e2e/real/pages/08-expired-stage-lifecycle.spec.ts`

- [ ] **Step 1: écrire le scénario E2E rouge**

Avant toute mutation, appeler `assertDisposableE2eDatabase`. Créer deux cas
distincts dans la base jetable :

- le slug legacy `printemps-2026` vérifie le `301` exact avec redirections
  désactivées et `Location: /stages` ;
- un autre slug passé visible/ouvert vérifie la garde générique : absent de la
  liste, détail API `404`, fiche et inscription `404/noindex`, POST `404` sans
  réservation, absent du sitemap.

Un témoin futur visible/ouvert reste exposé. Nettoyer uniquement les IDs créés
dans `finally`, puis déconnecter Prisma.

- [ ] **Step 2: lancer le gate ciblé et constater l’échec attendu**

Exécuter le scénario contre une stack jetable locale si PostgreSQL, Redis et le
serveur CI-like sont disponibles. La preuve autoritative reste le job GitHub
`E2E Tests`, dont le workflow démarre ces trois dépendances avant
`playwright.ci.config.ts`.

- [ ] **Step 3: ajuster uniquement le câblage E2E nécessaire**

Aucune modification bilans, pricing ou campagne Pré-rentrée.

- [ ] **Step 4: relancer le gate ciblé**

Expected: PASS, 0 skip.

- [ ] **Step 5: commit**

```bash
git add e2e/real/pages/08-expired-stage-lifecycle.spec.ts
git commit -m "test(stages): verrouiller le cycle de vie expiré en E2E"
```

### Task 6: Vérifications, documentation d’audit et PR

**Files:**
- Create: `docs/audits/2026-08-13-fermeture-stage-printemps-2026.md`

- [ ] **Step 1: exécuter tous les tests Jest sans filtre**

Run: `npx npm@10.9.8 test -- --runInBand`

Expected: 0 échec, 0 skip nouveau ou injustifié.

- [ ] **Step 2: exécuter l’intégration complète**

Run: `npx npm@10.9.8 run test:integration`

- [ ] **Step 3: exécuter typecheck et les cinq contrôles du job Lint**

```bash
npx npm@10.9.8 run typecheck
npx npm@10.9.8 run security:repo
npx npm@10.9.8 run check:test-quarantines
npx npm@10.9.8 run check:no-hardcoded
npx npm@10.9.8 run lint
npx npm@10.9.8 run check:docs-archive
```

- [ ] **Step 4: exécuter syntaxe E2E et build**

```bash
npx npm@10.9.8 run check:e2e-syntax
npx npm@10.9.8 run build:e2e
```

- [ ] **Step 5: exécuter les pré-scans disponibles localement**

Run: `npx npm@10.9.8 audit --omit=dev`. Le résultat local est un pré-contrôle ;
les politiques attestées restent celles des jobs GitHub.

- [ ] **Step 6: documenter les preuves et le rollback**

Inclure état production avant/après, conservation des deux réservations,
commandes et résultats exacts.

- [ ] **Step 7: commit documentaire et propreté Git**

```bash
git add docs/audits/2026-08-13-fermeture-stage-printemps-2026.md \
  docs/superpowers/plans/2026-08-13-stage-expiration-guard.md
git commit -m "docs(stages): consigner la fermeture printemps 2026"
git status --short
```

Expected: aucun fichier non suivi ou modifié.

- [ ] **Step 8: revue finale indépendante**

Demander une revue de conformité puis une revue de qualité/sécurité sur le diff
complet contre `origin/main`. Corriger tout point critique ou important et
relancer les gates concernées.

- [ ] **Step 9: pousser et ouvrir la PR sans merger**

Créer une PR vers `main`, demander l’approbation de `abenrhouma`, puis attendre
explicitement les jobs `Lint`, `TypeScript Type Check`, suites Jest,
`Dependency Integrity`, `Security Scan`, `E2E Tests` et l’agrégateur
`CI Success`. Ces jobs fournissent les gates Semgrep, OSV et Playwright que la
commande locale seule ne reproduit pas. Ne jamais merger ni déployer depuis
cette branche.
