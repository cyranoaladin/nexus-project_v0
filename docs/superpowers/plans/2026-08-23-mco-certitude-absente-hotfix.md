# MCO Certitude Absente Hotfix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner immédiatement la saisie papier Mathématiques complémentaires sur les autres matières en permettant de déclarer explicitement une certitude absente.

**Architecture:** Supprimer la politique spéciale qui rend la certitude obligatoire pour le pack MCO et réutiliser le chemin nullable générique existant. L'UI distingue toujours une certitude non traitée (`undefined`, validation bloquée) du choix volontaire `ABSENTE` (`null`, validation autorisée). Le score de connaissances, le moteur de faits, la banque et les rapports restent inchangés.

**Tech Stack:** Next.js 15, React 18, TypeScript, Jest/Testing Library, Prisma/PostgreSQL jetable, GitHub Actions, runtime standalone/PM2.

---

## Chunk 1: TDD et hotfix minimal

### Task 1: Écrire les preuves RED UI et serveur

**Files:**
- Modify: `__tests__/bilans/saisie-papier-page-access.test.tsx`
- Modify: `__tests__/bilans/saisie-papier-workflow.test.tsx`
- Modify: `__tests__/bilans/saisie-papier-parite.test.ts`
- Modify: `__tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts`

- [ ] **Step 1: Ajouter le test page MCO qui exige le cinquième choix**

Dans `saisie-papier-page-access.test.tsx`, configurer `auth()` avec
`{ user: { id: 'staff-mco', role: 'ASSISTANTE' } }`, activer le flag MCO
uniquement pendant le test et faire retourner par `prisma.student.findFirst`
la forme Prisma complète suivante :

```ts
{
  id: 'student-mco',
  gradeLevel: 'TERMINALE',
  user: {
    firstName: 'Élève', lastName: 'MCO',
    email: 'eleve-mco@nexus-student.local',
  },
  parent: { user: { email: 'famille-mco@nexus-famille.local' } },
}
```

Ces adresses neutres ne contiennent aucun motif filtré (`example.test`,
`smoke`, `residual`, `do_not_use`). Ouvrir ensuite la page avec `studentId` et
`packSlug`, puis vérifier :

```ts
expect(screen.getByText('Terminale · Mathématiques complémentaires')).toBeInTheDocument();
expect(screen.getAllByRole('radio', { name: 'Absente de la copie' })).toHaveLength(18);
```

Restaurer la valeur précédente du flag dans un `finally`. Avec le code actuel, l'assertion doit échouer avec zéro radio parce que la page transmet `confidenceRequired`.

- [ ] **Step 2: Remplacer le contrat UI spécial par le comportement validé**

Dans `saisie-papier-workflow.test.tsx`, remplacer le test « exige une certitude 1–4 » par un test MCO sans prop spéciale qui prouve successivement :

```ts
expect(submit).toBeDisabled(); // aucune réponse
fireEvent.click(answerA);
expect(submit).toBeDisabled(); // certitude encore non traitée
fireEvent.click(absentConfidence);
expect(submit).toBeEnabled();  // choix ABSENTE explicite
```

Ce test de composant documente la différence `undefined`/`ABSENTE`; le test de page de Step 1 porte le RED du câblage MCO réel.

- [ ] **Step 3: Remplacer le contrat serveur spécial par l'acceptation nullable**

Dans `saisie-papier-parite.test.ts`, remplacer le bloc « certitude obligatoire » par :

```ts
const stored = buildPaperEntryAnswers(MCO_ENABLED_PACK, [{
  itemId: MCO_ITEM.id,
  optionId: MCO_ITEM.options[0].id,
  confidence: null,
}]);
expect(stored[MCO_ITEM.id]).toEqual({
  optionId: MCO_ITEM.options[0].id,
  confidence: null,
});
```

Conserver le test qui rejette `optionId:null` avec une confiance non nulle et les gardes option/item/doublon existants.

- [ ] **Step 4: Faire du scénario B PostgreSQL le canary nullable**

Dans `buildCopyB`, donner `confidence: null` à `ETL-MCO-TAU-02`. Supprimer le test qui attend `PAPER_ENTRY_CONFIDENCE_REQUIRED` et adapter le scénario B pour vérifier ensemble :

```ts
expect(answers['ETL-MCO-TAU-02']).toEqual({
  optionId: correctLetter('ETL-MCO-TAU-02'),
  confidence: null,
});
expect(factSheet.globalScore).toBe(expectedGlobalScore(copy));
```

Ne modifier aucune attente de calibration au-delà de la mise à jour mécanique produite par la fixture : la sémantique `null → isConfident:false` reste explicitement hors périmètre.

- [ ] **Step 5: Exécuter les tests RED et constater les bonnes causes**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/saisie-papier-page-access.test.tsx \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts
```

Expected: exactement deux causes RED : échec sur le nombre de choix `Absente
de la copie` dans la page MCO et rejet serveur
`PAPER_ENTRY_CONFIDENCE_REQUIRED`. Le nouveau test du composant générique est
déjà vert avant le hotfix ; tout autre échec signale une fixture incorrecte et
doit être corrigé avant de modifier le code produit.

### Task 2: Appliquer le GREEN minimal

**Files:**
- Modify: `lib/bilans/saisie-papier/entry.ts`
- Modify: `components/bilans/PaperEntryGrid.tsx`
- Modify: `app/dashboard/assistante/bilans/saisie-papier/page.tsx`

- [ ] **Step 1: Supprimer la politique serveur spécifique MCO**

Dans `entry.ts` :

- supprimer `paperEntryRequiresConfidence` ;
- supprimer le calcul `confidenceRequired` et le rejet `PAPER_ENTRY_CONFIDENCE_REQUIRED` ;
- conserver `PAPER_ENTRY_BLANK_WITH_CONFIDENCE` et toutes les validations d'appartenance au pack ;
- documenter que `confidence:null` peut représenter une case de certitude absente sur une réponse cochée.

- [ ] **Step 2: Supprimer le câblage spécial de la page**

Dans `page.tsx`, retirer l'import `paperEntryRequiresConfidence` et la prop `confidenceRequired`. La grille reçoit toujours le pack, les 18 items projetés et le lien de navigation existant.

- [ ] **Step 3: Rendre la grille uniformément nullable**

Dans `PaperEntryGrid.tsx` :

- supprimer la prop `confidenceRequired` ;
- considérer uniquement `undefined` comme certitude non traitée ;
- toujours afficher `Absente de la copie` ;
- conserver la conversion `ABSENTE → null` dans la requête ;
- conserver le résumé des certitudes absentes avant validation ;
- utiliser le message générique `Certitude non traitée` tant qu'aucun choix n'est fait.

- [ ] **Step 4: Exécuter le GREEN ciblé**

Run:

```bash
npx jest --config jest.unit.config.js --runInBand \
  __tests__/bilans/saisie-papier-page-access.test.tsx \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts \
  __tests__/bilans/saisie-papier-sans-reponse.test.ts \
  __tests__/bilans/saisie-papier-option-order.test.ts
```

Expected: PASS, 0 fail.

- [ ] **Step 5: Refactor et contrôle de portée**

Run:

```bash
! rg -n "paperEntryRequiresConfidence|confidenceRequired|PAPER_ENTRY_CONFIDENCE_REQUIRED" \
  app components lib __tests__
git diff --check
git diff --exit-code b3db5e26 -- \
  lib/bilans/facts lib/bilans/worker/score-job.ts lib/bilans/worker/scoring.ts \
  prisma package.json package-lock.json data/bilans/banks
```

Expected: aucune référence résiduelle à la politique spéciale et aucun changement de schéma, dépendance ou banque.

## Chunk 2: Base jetable, livraison et production

### Task 3: Prouver le parcours réel sur PostgreSQL jetable isolé

**Files:**
- Test: `__tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts`

- [ ] **Step 1: Préflight Chromium et créer une base unique en mémoire**

Run:

```bash
node -e "const {chromium}=require('playwright');void chromium.launch({headless:true}).then(b=>b.close())" \
  || npx playwright install --with-deps chromium
node -e "const {chromium}=require('playwright');void chromium.launch({headless:true}).then(b=>b.close())"
```

Puis exécuter Steps 2 et 3 dans le même shell. Le conteneur reçoit un nom
unique, un port hôte alloué par Docker et un `tmpfs`; aucun volume partagé
n'est créé.

- [ ] **Step 2: Migrer et exécuter l'intégration MCO complète**

Run:

```bash
set -euo pipefail
MCO_DB_CONTAINER="nexus-mco-postgres-$(date -u +%Y%m%dT%H%M%SZ)-$$"
case "$MCO_DB_CONTAINER" in nexus-mco-postgres-[0-9]*-*) ;; *) exit 64 ;; esac
MCO_DB_AUTH="$(openssl rand -hex 24)"
test -n "$MCO_DB_AUTH"
cleanup_mco_db() {
  docker rm -f "$MCO_DB_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup_mco_db EXIT INT TERM

docker run -d \
  --name "$MCO_DB_CONTAINER" \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_USER=nexus_user \
  -e POSTGRES_PASSWORD="${MCO_DB_AUTH}" \
  -e POSTGRES_DB=nexus_disposable_mco_test \
  -p 127.0.0.1::5432 \
  pgvector/pgvector:pg15 >/dev/null

MCO_DB_PORT="$(docker port "$MCO_DB_CONTAINER" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
test "$MCO_DB_PORT" -ge 1024
MCO_TEST_DATABASE_URL="postgresql://nexus_user:${MCO_DB_AUTH}@127.0.0.1:${MCO_DB_PORT}/nexus_disposable_mco_test?schema=public"

for attempt in $(seq 1 30); do
  docker exec "$MCO_DB_CONTAINER" pg_isready -U nexus_user -d nexus_disposable_mco_test >/dev/null && break
  test "$attempt" -lt 30
  sleep 1
done

DATABASE_URL="$MCO_TEST_DATABASE_URL" npx prisma migrate deploy
NEXUS_DISPOSABLE_POSTGRES=1 \
DATABASE_URL="$MCO_TEST_DATABASE_URL" \
TEST_DATABASE_URL="$MCO_TEST_DATABASE_URL" \
npx jest --config jest.integration.config.js --runInBand \
  __tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts
```

Expected: PASS. La tentative B conserve l'`optionId`, persiste `confidence:null`, garde le score attendu, protège ETL/logarithme et publie exactement le HTML prévisualisé.

- [ ] **Step 3: Détruire uniquement la ressource créée et confirmer l'absence de fuite**

Run:

```bash
cleanup_mco_db
trap - EXIT INT TERM
test -z "$(docker ps -aq --filter "name=^/${MCO_DB_CONTAINER}$")"
```

Expected: le conteneur unique n'existe plus. Aucun volume Docker n'a été créé,
car PostgreSQL utilisait exclusivement le `tmpfs` du conteneur.

### Task 4: Gates, revue et commit produit

**Files:**
- Modify: `docs/audits/2026-08-23-maths-complementaires-urgent-paper-entry.md`

- [ ] **Step 1: Mettre à jour l'audit factuel**

Consigner la décision opérateur, la limite de calibration acceptée, les tests RED/GREEN et l'absence de changement du score de connaissances.

- [ ] **Step 2: Exécuter les gates**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: exit 0. Toute alerte préexistante est comptée et distinguée d'un nouvel échec.

- [ ] **Step 3: Committer uniquement les fichiers du hotfix**

Run:

```bash
git diff --check
git status --short
git add \
  app/dashboard/assistante/bilans/saisie-papier/page.tsx \
  components/bilans/PaperEntryGrid.tsx \
  lib/bilans/saisie-papier/entry.ts \
  __tests__/bilans/saisie-papier-page-access.test.tsx \
  __tests__/bilans/saisie-papier-workflow.test.tsx \
  __tests__/bilans/saisie-papier-parite.test.ts \
  __tests__/integration/bilans-maths-complementaires-saisie-papier.real.test.ts \
  docs/audits/2026-08-23-maths-complementaires-urgent-paper-entry.md \
  docs/superpowers/plans/2026-08-23-mco-certitude-absente-hotfix.md
git commit -m "fix(bilans): autoriser la certitude absente en MCO"
```

Ne jamais ajouter `.tmp-mco-ui/`.

- [ ] **Step 4: Demander une revue indépendante sur deux SHA réels**

Utiliser `superpowers:requesting-code-review` avec `BASE_SHA=b3db5e26` et
`HEAD_SHA=$(git rev-parse HEAD)`. Corriger uniquement les constats vérifiés,
relancer les tests affectés et créer un commit de correction séparé si
nécessaire.

### Task 5: PR, CI, merge et déploiement autorisé

- [ ] **Step 1: Pousser la branche et ouvrir une PR dédiée**

Pousser uniquement `feat/maths-complementaires-runtime-bilans`, ouvrir une PR vers `main`, puis vérifier que le diff ne contient ni `.tmp-mco-ui/`, ni migration, ni secret.

- [ ] **Step 2: Attendre CI verte et approbation**

Attendre tous les checks requis, notamment Unit, Integration, Real DB, E2E Auth, Security, Production Build et `CI Success`. Ne pas fusionner avec un check rouge ou en attente.

- [ ] **Step 3: Merger et construire le SHA mergé exact**

Après approbation, merger via GitHub, récupérer le SHA de merge et construire une archive standalone depuis un checkout propre de ce SHA sous Node `22.23.1`.

- [ ] **Step 4: Déployer sous verrou avec rollback**

Selon le runbook privé vérifié : résoudre `<DEPLOY_LOCK>`,
`<CANONICAL_POINTER>`, `<PROCESS_NAME>` et `<RELEASE_ROOT>` sans les publier ;
acquérir le verrou ; capturer la release active comme `<PREVIOUS_RELEASE>` ;
sauvegarder DB/config ; installer une nouvelle release immuable ; basculer
atomiquement les pointeurs et reload PM2. La cible de rollback est la release
active capturée juste avant la bascule, jamais un nom figé dans ce plan.

Vérifier explicitement :

```text
NEXUS_BILAN_PACK_ENTREE_TERMINALE_MATHS_COMPLEMENTAIRES_V1_ENABLED=true
NEXUS_BILAN_FAMILY_NARRATION_ENABLED=false
BILAN_WORKER_ENABLED=true
```

- [ ] **Step 5: Smoke production sans soumission**

Avec la session ASSISTANTE autorisée : sélectionner un élève de Terminale, choisir Mathématiques complémentaires, vérifier 18 questions et pour chacune `1/2/3/4/Absente de la copie`. Vérifier qu'une réponse A/B/C/D sans choix de certitude garde la validation bloquée, puis que `Absente de la copie` la débloque. Ne soumettre aucune copie synthétique en production.

- [ ] **Step 6: Vérifier santé et worker, puis libérer le verrou**

Exiger HTTP 200 sur `/`, `/auth/signin`, `/api/health`, PM2 `online`, processus enfant sur la nouvelle release, narration OFF et métriques worker sans échec/quarantaine. Libérer le verrou uniquement après ces contrôles.

Déclencher le rollback si l'un de ces contrôles échoue, si le pack disparaît,
si le cinquième choix n'est pas visible, si la validation reste bloquée après
`Absente de la copie`, ou si le worker signale un échec/quarantaine. Sous le
même verrou : rebascule atomique vers `<PREVIOUS_RELEASE>`, restaure uniquement
la configuration sauvegardée si elle a changé, reload `<PROCESS_NAME>`, puis
revérifie pointeurs, PID/cwd, PM2 et healthchecks. Aucune restauration DB n'est
requise pour ce hotfix sans migration et sans smoke mutatif.
