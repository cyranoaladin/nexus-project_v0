# Legacy Unknown Curriculum Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le filtrage des définitions diagnostiques legacy sans curriculum connu, valider le lot bilans complet, puis préparer son commit et son push.

**Architecture:** `adaptLegacyDefinition` continue de produire une définition inspectable avec des identifiants sentinelles. `adaptLegacyDefinitions` décide de l'exclusion depuis les deux identifiants structurés de `curriculumBinding`, sans dépendre du texte libre des avertissements.

**Tech Stack:** TypeScript, Zod, Jest, Next.js, Git.

---

## Chunk 1: Correction, validation et publication

### Task 1: Détecter les liaisons curriculum inconnues

**Files:**

- Modify: `lib/diagnostics/legacy-adapter.ts:188-196`
- Test: `__tests__/lib/diagnostics/assessment-definition.test.ts:245-261`

- [ ] **Step 1: Confirmer le test rouge existant**

Run:

```bash
npm test -- --runInBand __tests__/lib/diagnostics/assessment-definition.test.ts -t 'skips definitions with UNKNOWN curriculum IDs'
```

Expected: FAIL avec `Expected length: 1` et `Received length: 2`. Cette preuve rouge a déjà été observée avant toute correction.

- [ ] **Step 2: Appliquer la correction minimale**

Dans `adaptLegacyDefinitions`, remplacer la recherche de `UNKNOWN` dans les avertissements par l'inspection des identifiants structurés :

```typescript
const { prerequisiteCurriculumId, targetCurriculumId } =
  result.definition.curriculumBinding;
const hasUnknownCurriculumBinding = [
  prerequisiteCurriculumId,
  targetCurriculumId,
].some((curriculumId) => curriculumId.startsWith('UNKNOWN:'));

if (hasUnknownCurriculumBinding) {
  skipped.push(legacy.key);
} else {
  results.push(result);
}
```

Ne modifier ni les mappings curriculum, ni le format des avertissements, ni le contrat `AdapterResult`.

- [ ] **Step 3: Vérifier le passage au vert du test isolé**

Run:

```bash
npm test -- --runInBand __tests__/lib/diagnostics/assessment-definition.test.ts -t 'skips definitions with UNKNOWN curriculum IDs'
```

Expected: PASS, un test réussi et les autres tests de ce fichier ignorés par le filtre `-t`.

- [ ] **Step 4: Vérifier les quatre suites du lot bilans**

Run:

```bash
npm test -- --runInBand __tests__/lib/curriculum/registry.test.ts __tests__/lib/curriculum/schemas.test.ts __tests__/lib/curriculum/version-resolution.test.ts __tests__/lib/diagnostics/assessment-definition.test.ts
```

Expected: 4 suites et 49 tests réussis, aucun échec.

### Task 2: Exécuter les quality gates et créer le commit du lot

**Files:**

- Add: `__tests__/lib/curriculum/*.test.ts`
- Add: `__tests__/lib/diagnostics/assessment-definition.test.ts`
- Add: `docs/bilans/**`
- Add: `docs/superpowers/plans/2026-07-20-legacy-unknown-filter.md`
- Add: `lib/curriculum/**`
- Add: `lib/diagnostics/assessment-definition.ts`
- Add: `lib/diagnostics/legacy-adapter.ts`

- [ ] **Step 1: Exécuter les contrôles complets**

Run, dans cet ordre :

```bash
npm run typecheck
npm run lint
npm run security:repo
npm test -- --runInBand
npm run build
```

Expected: chaque commande retourne le code 0. Les avertissements lint préexistants sont acceptables ; toute erreur ou tout nouvel échec doit être diagnostiqué avant de continuer.

- [ ] **Step 2: Contrôler et indexer uniquement le lot cohérent**

Run:

```bash
git status --short
git diff --check
git add __tests__/lib/curriculum \
  __tests__/lib/diagnostics/assessment-definition.test.ts \
  docs/bilans \
  docs/superpowers/plans/2026-07-20-legacy-unknown-filter.md \
  lib/curriculum \
  lib/diagnostics/assessment-definition.ts \
  lib/diagnostics/legacy-adapter.ts
git diff --cached --check
git diff --cached --stat
```

Expected: seuls les fichiers curriculum, diagnostics et documentation bilans approuvés sont indexés. Les suppressions de `node_modules` du dépôt voisin `NSI_cours_accompagnement` ne sont pas concernées.

- [ ] **Step 3: Créer le commit fonctionnel**

Run:

```bash
git commit -m "feat(bilans): add versioned curriculum foundations"
```

Expected: un commit est créé sur `fix/lockfix-node22-deps` avec le lot indexé.

- [ ] **Step 4: Pousser et vérifier l'amont**

Run:

```bash
git push -u origin fix/lockfix-node22-deps
git fetch origin
git status -sb
git rev-list --left-right --count origin/fix/lockfix-node22-deps...HEAD
```

Expected: push réussi, worktree propre et compte `0 0` entre la branche locale et son amont.
