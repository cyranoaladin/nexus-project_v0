# Mathématiques complémentaires Urgent Paper Hotfix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre sûr aujourd’hui le parcours de saisie papier `entree-terminale-maths-complementaires-v1` avec restitution ETL correcte et certitude 1–4 obligatoire pour toute réponse cochée.

**Architecture:** Le scoring, la banque validée et son checksum restent inchangés. Une projection humaine explicite corrige uniquement les textes de restitution de `ETL-MCO-PRO-02`, tandis qu’une politique pure et partagée entre serveur et UI impose la certitude pour ce pack sans modifier le comportement nullable des autres packs. La narration LLM reste désactivée et le rapport déterministe suit la revue `ASSISTANTE` existante.

**Tech Stack:** Next.js 15, React 19, TypeScript, Jest/Testing Library, Prisma/PostgreSQL jetable, Playwright, Chromium PDF.

**Contraintes d’exécution:** aucun commit, push, merge, déploiement, SSH, migration, dépendance ou modification de production. Les changements restent dans ce worktree sale et les modifications préexistantes sont préservées.

---

## Chunk 1: Hotfixs déterministes

### Task 1: Projection humaine sûre de ETL-MCO-PRO-02

**Files:**
- Create: `lib/bilans/render/human-facing-evidence.ts`
- Modify: `lib/bilans/render/question-evidence.ts`
- Create: `__tests__/bilans/maths-complementaires-etl-render.test.ts`
- Create (fichier de travail actuellement non suivi, à durcir): `__tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts`

- [ ] **Step 1: Écrire le test rouge sur les deux chemins de rendu de l’option B**

Le test charge le pack validé sans le modifier et prouve d’abord que l’option canonique correcte reste `B`. Il construit ensuite deux `QuestionEvidence`, l’un avec B choisi et l’autre avec A choisi. Dans chaque objet, il cible l’item `ETL-MCO-PRO-02`, puis rend `ELEVE`, `PARENTS` et `NEXUS` avec une fixture `FactSheet` MCO et une `RenderIdentity` pseudonyme valides.

Dans le même temps, retirer le `test.failing` du scénario PostgreSQL et le convertir en assertion normale avant toute modification produit. Cela fournit le rouge d’intégration ETL, en complément du rouge unitaire.

Assertions obligatoires :

```ts
expect(rawCorrect.id).toBe('B');
expect(rawCorrect.isCorrect).toBe(true);
expect(evidenceCorrect.items
  .find(({ itemId }) => itemId === 'ETL-MCO-PRO-02')
  ?.options.find(({ id }) => id === 'B')?.text)
  .toBe("Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %");
for (const html of renderedAudiences) {
  expect(html).not.toMatch(/Non\s*:\s*la probabilité[\s\S]{0,180}59/i);
  expect(html).not.toMatch(/clé papier|mot [«“\"]?Non|du PDF|incohérent/i);
}
```

- [ ] **Step 2: Exécuter le test et constater l’échec attendu**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/maths-complementaires-etl-render.test.ts
```

Expected: FAIL car `buildQuestionEvidence` expose encore le texte brut « Non … 59 % » et la note éditoriale.

Puis exécuter le test d’intégration démasqué sur PostgreSQL jetable. Expected: FAIL sur la même restitution ETL. Ces deux rouges doivent être observés avant Step 3.

- [ ] **Step 3: Ajouter la projection minimale de restitution**

Créer un registre de projection explicitement limité aux textes humains :

```ts
const OVERRIDES = {
  'entree-terminale-maths-complementaires-v1': {
    'ETL-MCO-PRO-02': {
      optionTextById: {
        B: "Oui : la probabilité qu’elle soit porteuse est d’environ 59,5 %",
      },
      shortCorrection:
        "Par la formule de Bayes, P(porteur | test positif) = " +
        "0,03 × 0,95 / (0,03 × 0,95 + 0,97 × 0,02) ≈ 59,5 %. " +
        "Une personne testée positive est donc probablement porteuse.",
    },
  },
} as const;
```

La fonction exportée reçoit `packSlug`, `itemId`, options et `shortCorrection`, retourne une copie gelée destinée au rendu et ne change jamais `id`, `isCorrect`, ordre, banque, checksum ou statut de validation.

- [ ] **Step 4: Faire passer le test ETL et les tests de rendu voisins**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/maths-complementaires-etl-render.test.ts \
  __tests__/bilans/question-evidence.test.ts \
  __tests__/bilans/report-materialization.test.ts
```

Expected: PASS, option canonique B inchangée et aucune chaîne interne exposée.

### Task 2: Certitude 1–4 obligatoire pour le pack MCO papier

**Files:**
- Modify: `lib/bilans/saisie-papier/entry.ts`
- Modify: `components/bilans/PaperEntryGrid.tsx`
- Modify: `app/dashboard/assistante/bilans/saisie-papier/page.tsx`
- Modify: `__tests__/bilans/saisie-papier-workflow.test.tsx`
- Modify: `__tests__/bilans/saisie-papier-parite.test.ts`

- [ ] **Step 1: Écrire les tests rouges de politique serveur et d’interface**

Ajouter les comportements suivants :

Construire la fixture exacte avec le résolveur canonique, puis choisir `mcoItem` dans ce pack :

```ts
const MCO_ENABLED_PACK = resolveEnabledPack(
  PACK_SLUG,
  undefined,
  { [packFeatureFlagName(PACK_SLUG)]: 'true' },
);
if (MCO_ENABLED_PACK === null) throw new Error('MCO_PACK_NOT_RESOLVED');
```

Utiliser séparément `CANONICAL_WORKER_ENABLED_PACK` pour prouver que le nullable générique reste inchangé hors MCO.

```ts
expect(() => buildPaperEntryAnswers(MCO_ENABLED_PACK, [
  { itemId: mcoItem.id, optionId: 'A', confidence: null },
])).toThrow('PAPER_ENTRY_CONFIDENCE_REQUIRED');

expect(() => buildPaperEntryAnswers(MCO_ENABLED_PACK, [
  { itemId: mcoItem.id, optionId: null, confidence: null },
])).not.toThrow('PAPER_ENTRY_CONFIDENCE_REQUIRED');
```

Rendre `PaperEntryGrid` avec `confidenceRequired` et vérifier : absence du choix « Absente de la copie », bouton inactif sans certitude, bouton actif après choix 1–4. Le rendu par défaut d’un autre pack conserve le choix nullable.

Modifier ensuite, toujours avant le code produit, le scénario B PostgreSQL : donner une certitude 1–4 à `ETL-MCO-TAU-02`, retirer les commentaires/assertions devenus faux sur une certitude absente, et ajouter une requête MCO avec option cochée et `confidence: null`. Attendre HTTP 400, code `PAPER_ENTRY_CONFIDENCE_REQUIRED` et aucune nouvelle tentative.

- [ ] **Step 2: Exécuter les tests et constater les échecs attendus**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts
```

Expected: FAIL car la politique et la prop n’existent pas encore.

Exécuter aussi le scénario PostgreSQL modifié avant Step 3. Expected: FAIL car la requête avec confiance absente est encore acceptée.

- [ ] **Step 3: Implémenter la politique pure et partagée**

Dans `entry.ts`, ajouter :

```ts
export function paperEntryRequiresConfidence(packSlug: string): boolean {
  return packSlug === 'entree-terminale-maths-complementaires-v1';
}
```

`buildPaperEntryAnswers` rejette `optionId !== null && confidence === null` uniquement lorsque cette politique vaut vrai. Une non-réponse `null/null` reste autorisée. Les autres packs gardent le comportement générique actuel.

La page calcule la politique côté serveur et passe `confidenceRequired` à la grille. Déclarer `confidenceRequired?: boolean` avec `false` par défaut pour préserver tous les autres usages. La grille masque le choix « Absente de la copie » et adapte les consignes pour ce pack ; aucune refonte visuelle.

- [ ] **Step 4: Faire passer les tests papier et de parité**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts \
  __tests__/bilans/saisie-papier-sans-reponse.test.ts \
  __tests__/bilans/saisie-papier-option-order.test.ts
```

Expected: PASS ; le score connu et la parité online/papier restent inchangés.

---

## Chunk 2: Preuve PostgreSQL et restitution

### Task 3: Scénario réel MCO déterministe

**Files:**
- Create (fichier de travail actuellement non suivi): `__tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts`

- [ ] **Step 1: Consolider les tests rouges déjà exécutés dans Tasks 1 et 2**

Vérifier que le fichier contient bien : aucun `test.failing`, une erreur sur `ETL-MCO-PRO-02`, une erreur de logarithme, aucune confiance absente sur une réponse cochée, et le garde HTTP 400 `PAPER_ENTRY_CONFIDENCE_REQUIRED`. Les rouges correspondants ont obligatoirement été observés avant les Steps 3 de Tasks 1 et 2.

- [ ] **Step 2: Exécuter le scénario complet après les deux implémentations**

Run sur la base dédiée `nexus_disposable_mco_77d4dbc7_test` uniquement :

```bash
NEXUS_DISPOSABLE_POSTGRES=1 \
DATABASE_URL="$MCO_DISPOSABLE_DATABASE_URL" \
TEST_DATABASE_URL="$MCO_DISPOSABLE_DATABASE_URL" \
MCO_E2E_ARTIFACT_DIR="$MCO_ARTIFACT_DIR" \
npx jest --config jest.integration.config.js --runInBand \
  __tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts
```

Expected: PASS. Les sorties des exécutions rouges préalables sont consignées dans l’audit final.

- [ ] **Step 3: Prouver le parcours complet et l’égalité prévisualisation/publication**

Sur le scénario B, capturer avant validation les trois HTML de `previewPendingReport`, les indexer par audience, publier avec le rôle `ASSISTANTE`, puis faire trois égalités strictes avec `ReportAudienceArtifact.html`. Vérifier aussi :

```ts
expect(attempt.provenance).toBe('SAISIE_PAPIER');
expect(attempt.subject).toBe('MATHEMATIQUES');
expect(correctLetter('ETL-MCO-PRO-02')).toBe('B');
expect(revision.status).toBe('PENDING_REVIEW');
expect(published.status).toBe('PUBLISHED');
expect(allHtmlAndPdfText).not.toMatch(/clé papier|Non\s*:\s*la probabilité[\s\S]{0,180}59/i);
expect(allHtmlAndPdfText).not.toMatch(/lacune de Premi[èe]re/i);
expect(allHtmlAndPdfText).toContain('repérage anticipé');
```

Sauvegarder puis restaurer `NEXUS_BILAN_FAMILY_NARRATION_ENABLED`. Pendant le test, la supprimer explicitement. Injecter un `buildTransport` espion qui jette s’il est appelé, affirmer `expect(buildTransport).not.toHaveBeenCalled()`, puis vérifier que `logger.info` a reçu `A88_GENERATE_REPORT_JOB_COMPLETED` avec `mode: 'DETERMINISTIC_FALLBACK'`.

- [ ] **Step 4: Inspecter les PDF régénérés**

Extraire le texte des six PDF et rasteriser au moins les pages contenant probabilités/logarithmes. Sur chaque HTML et chaque texte PDF séparément, normaliser les espaces ou utiliser `/Non\s*:\s*la probabilité[\s\S]{0,180}59/i` afin de couvrir les retours à la ligne. Confirmer accents, absence de coupe, libellé humain « Mathématiques complémentaires » et absence des textes interdits.

### Task 4: Vérification ciblée et rapport d’audit

**Files:**
- Create: `docs/audits/2026-08-23-maths-complementaires-urgent-paper-entry.md`

- [ ] **Step 1: Lancer les tests ciblés consolidés**

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/maths-complementaires-etl-render.test.ts \
  __tests__/bilans/subject-display-maths-complementaires.test.ts \
  __tests__/bilans/entree-terminale-maths-complementaires-bank.test.ts \
  __tests__/bilans/question-evidence.test.ts \
  __tests__/bilans/report-materialization.test.ts \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts \
  __tests__/bilans/saisie-papier-sans-reponse.test.ts \
  __tests__/bilans/saisie-papier-option-order.test.ts
```

Expected: toutes les suites PASS, aucun `test.failing` MCO.

- [ ] **Step 2: Lancer les quality gates proportionnés**

```bash
npm run typecheck
npm run lint
npm run build
```

Documenter exactement tout échec préexistant ou nouveau. Ne pas masquer les avertissements pertinents.

- [ ] **Step 3: Rejouer le parcours navigateur ciblé**

Avec le flag MCO local uniquement : sélection Terminale/MCO, 18 lignes A/B/C/D, absence du choix de certitude manquante, bouton bloqué tant qu’une certitude 1–4 manque, puis soumission synthétique et contrôle DB jusqu’à `REPORT_PENDING_REVIEW`.

- [ ] **Step 4: Rédiger l’audit factuel et détruire l’environnement jetable**

Le rapport liste SHA, fichiers, tests PASS/FAIL, preuve optionId B, preuve que la banque JSON/YAML et son checksum sont inchangés, preuve de publication, estimation chronométrée de saisie et rollback. Arrêter uniquement le serveur local du worktree créé pour cette mission. Vérifier explicitement l’identité et les mounts, puis supprimer uniquement la cible :

```bash
docker inspect nexus-mco-disposable-77d4dbc7 \
  --format '{{.Name}}|{{json .Mounts}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
docker rm -f nexus-mco-disposable-77d4dbc7
```

Nettoyer uniquement le répertoire d’artefacts temporaire identifié après livraison. Ne toucher à aucun autre conteneur.

- [ ] **Step 5: Contrôler le diff sans commit**

```bash
git diff --check
git status --short
```

Expected: uniquement les fichiers du hotfix, le plan/audit et les modifications préexistantes explicitement signalées. Aucun commit, push, merge ou déploiement.
