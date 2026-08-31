# ARIA-B Conversation Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer PR #200 sans dette conversationnelle : un seul cas d'usage `runConversation`, un contexte autorisé, un lifecycle idempotent/récupérable, un pipeline RAG/prompt/modèle/persistance, un moteur frontend et des frontières mécaniquement enforceables.

**Architecture:** Chaque transport appelle un barrel public du bounded context Conversation. `buildAriaConversationContext` résout actor, subject=self, Academic Map, accès, capabilities, conversation, skill/ressource et policies. `runConversation` réserve un `AriaConversationTurn`, exécute retrieval et gateway hors transaction, puis finalise par CAS. Les ressources sont identifiées/versionnées dans Nexus ; le dépôt RAG publie le manifeste servable et Nexus en épingle le digest.

**Tech Stack:** Next.js 14 App Router, TypeScript, Zod, Prisma/PostgreSQL, Jest, Playwright, OpenAI-compatible gateway, Python/Pydantic/pytest dans le dépôt RAG, Mermaid/Markdown pour l'architecture.

---

## 0. Contrat d'exécution du plan

- Baseline Nexus immuable : `1149572f5bf85b43bc10c870cb4fd81b336f7f56`.
- Baseline RAG auditée : `ffc1bae31e57a23e0e9dca7c4a7da66270c24552` ; utiliser un worktree propre, jamais le worktree RAG actuellement modifié.
- Aucun reset de `1149572`, aucun retour à `cab1e8e5`, aucun merge et aucune demande d'approbation humaine avant les gates finaux.
- Chaque commit fonctionnel suit Red → Green minimal → Refactor → vérification ciblée → commit.
- Les cinq threads GitHub ne sont résolus qu'après le test de régression correspondant vert sur le HEAD poussé.
- `AriaConversationTurn.status` est l'unique lifecycle SSoT : TX1 persiste `PENDING`, un claim CAS court passe à `RUNNING` avant tout réseau, puis une seule transition terminale produit `COMPLETED/CANCELLED/ERROR`.
- Un champ legacy conservé pendant l'expand/contract est read-only/strictement dérivé et interdit aux writes applicatifs.
- Aucun appel réseau n'est effectué dans une transaction DB.

### Séquence de branches

Ordre exécutable : RAG C02 contrats → RAG C03a inventory bootstrap → Nexus C05a Resource Registry → RAG C03b manifeste servable lié → RAG C04 évaluation liée → Nexus C05b import lock/runtime → Nexus C05c harness TDD hermétique. PR #200 contient C01, C05a–C05c et C06–C16 ; M1/backfills suivent l'ordre du plan. M2 est une vague ultérieure distincte.

## Chunk 1 — Architecture, manifests, données et core

## Task 1 — C01 `docs(aria): freeze approved V2 architecture and execution plan`

**RED TEST**

- [ ] Depuis la baseline, exécuter `test -f docs/architecture/ARIA_V1.md && rg -n "AriaConversationTurn|PENDING.*RUNNING|RESOURCE_IDENTITY|OBSERVE" docs/architecture/ARIA_V1.md`.

**EXPECTED FAILURE**

`ARIA_V1.md` est absent sur la baseline et la conception complète n'est pas versionnée.

**FILES TO CHANGE**

- `docs/architecture/ARIA_V1.md`
- `docs/architecture/ARIA_PERSONAL_LEARNING_OS_DATA_MODEL.md`
- `docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md`

**MINIMAL IMPLEMENTATION**

Versionner la décision V2, les diagrammes Mermaid, ownership use-case/kernel, lifecycle SSoT, actor/subject, policies, transactions, recovery, Resource Registry/RAG manifest, lots C–G et le présent plan. Ne présenter aucun target comme déjà implémenté.

**MIGRATION IMPACT**

Aucun schéma ni donnée ; la documentation devient le contrat avant Prisma.

**SECURITY IMPACT**

Fige `subject=self`, les audiences et les imports interdits.

**PEDAGOGICAL IMPACT**

Fige la boucle pédagogique et la séparation Global Safety / Pedagogical Mode.

**REGRESSION TESTS**

- [ ] `git diff --check`
- [ ] `rg -n "CANDIDAT_LIBRE_COVERAGE=NOT_PROVEN|LANGUAGE_CHOICE_MODEL=NOT_APPROVED" docs/architecture/ARIA_PERSONAL_LEARNING_OS_DATA_MODEL.md`

**EXIT CRITERIA**

Les deux docs sont cohérents, versionnables, liés entre eux et ne revendiquent aucune couverture à 100 %.

## Task 2 — C02 `contracts: define servable corpus manifest v1` (dépôt RAG)

**RED TEST**

- [ ] Dans un worktree propre RAG, créer puis lancer `python -m pytest packages/contracts/tests/test_servable_corpus_manifest.py packages/contracts/tests/test_resource_registry_bootstrap.py packages/contracts/tests/test_internal_identity_vectors.py packages/contracts/tests/test_schema_export.py -q`.

**EXPECTED FAILURE**

Le type, le schéma JSON exporté, la canonicalisation et le digest du manifeste n'existent pas.

**FILES TO CHANGE**

- `<RAG_REPO>/docs/adr/ADR-0046-manifeste-corpus-servable-nexus.md`
- `<RAG_REPO>/packages/contracts/src/nexus_contracts/{servable_corpus_manifest.py,servable_corpus_index.py,internal_identity.py,__init__.py}` et `packages/contracts/pyproject.toml`
- `<RAG_REPO>/packages/contracts/src/nexus_contracts/{retrieval.py,resource_registry_bootstrap.py}`
- `<RAG_REPO>/packages/contracts/scripts/export_schemas.py` et `packages/contracts/schema/servable-corpus-manifest-v1.json`
- `<RAG_REPO>/packages/contracts/schema/{retrieval-request.json,retrieval-response.json,retrieval-error.json,internal-identity-envelope.json,servable-corpus-index-v1.json,resource-registry-bootstrap-v1.json}`
- `<RAG_REPO>/packages/contracts/tests/{test_servable_corpus_manifest.py,test_resource_registry_bootstrap.py,test_internal_identity_vectors.py,test_schema_export.py}`
- `<RAG_REPO>/.github/workflows/ci.yml`

**MINIMAL IMPLEMENTATION**

Ajouter les contrats Pydantic stricts du manifeste, de son index N/N-1, de l'envelope d'identité et de l'inventory bootstrap. Étendre l'autorité existante `retrieval.py`/schemas : request porte manifest/version, response porte `resourceId/resourceVersionId/contentSha256/chunkId/locator/corpusVersionId/manifestSha256`, error porte un code interne stable ; aucun schema parallèle dans l'endpoint. Le manifest porte Registry version/digest, producteur/commit, année, corpus/scope, binding et versions indexées. Chaque export possède `$id`, package SemVer et SHA ; canonicaliser JSON UTF-8 trié/newline + SHA-256 détaché. Ajouter un vecteur de signature fixe utilisé à l'identique par Python et Node.

**MIGRATION IMPACT**

Aucune DB ; évolution de contrat cross-repo versionnée.

**SECURITY IMPACT**

Refuser champ inconnu, hash invalide, identité ressource dupliquée et binding incomplet ; aucune PII.

**PEDAGOGICAL IMPACT**

Conserve année/scope/applicabilité sans inventer candidat libre ou langue.

**REGRESSION TESTS**

- [ ] `python packages/contracts/scripts/export_schemas.py --output packages/contracts/schema --check`
- [ ] Test byte-identical/digest stable et test `resourceVersionId != contentSha256`.

**EXIT CRITERIA**

Le contrat RAG est la seule définition du manifeste servable et la CI contracts exécute réellement ses tests.

## Task 3 — C03a `rag-engine: export governed resource bootstrap inventory` (dépôt RAG)

**RED TEST**

- [ ] Lancer `python -m pytest packages/contracts/tests/test_resource_registry_bootstrap.py services/rag-engine/tests/test_resource_registry_bootstrap_inventory.py -q`.

**EXPECTED FAILURE**

Aucun export scellé ne relie resource, artifact hash, rag artifact et chunks existants pour le bootstrap Nexus.

**FILES TO CHANGE**

- `<RAG_REPO>/services/rag-engine/scripts/build_resource_registry_bootstrap_inventory_cli.py`
- `<RAG_REPO>/services/rag-engine/src/ingestor/resource_registry_bootstrap.py`
- `<RAG_REPO>/services/rag-engine/tests/test_resource_registry_bootstrap_inventory.py`
- `<RAG_REPO>/services/rag-engine/tests/integration/test_resource_registry_bootstrap_inventory_pg.py`

**MINIMAL IMPLEMENTATION**

Exporter en lecture seule le mapping historique exact : `ingestion_control.resources.resource_id → Nexus resourceId`; `ingestion_control.artifacts.artifact_id → Nexus resourceVersionId`; `artifacts.sha256 → contentSha256`; jointure vers `public.rag_artifacts` exclusivement par `rag_artifacts.ingestion_artifact_id = artifacts.artifact_id`; `rag_artifacts.artifact_id == artifacts.sha256` reste l'identité interne content-addressed RAG et **ne devient jamais** un ResourceVersion ID ; `rag_chunks.artifact_id → rag_artifacts.artifact_id` fournit chunkId/locator. Inclure provenance/rights et producer SHA. Trier/canonicaliser, signer le digest et refuser orphelin, duplicate, hash/linkage incohérent. Ce commit ne change aucun ID ni runtime search.

**MIGRATION IMPACT**

Aucune écriture DB ; snapshot depuis une release promue et répétable sur le même snapshot PostgreSQL.

**SECURITY IMPACT**

Aucun contenu/PII/path secret dans l'inventory ; source URI et droits contrôlés.

**PEDAGOGICAL IMPACT**

Préserve exactement la provenance et les chunks déjà servis avant transfert d'autorité documentaire.

**REGRESSION TESTS**

- [ ] Snapshot PG exact, bytes/digest stables, artifact≠sha, chunk orphelin et rights absents refusés.

**EXIT CRITERIA**

L'inventory C03a est piné par commit+digest et devient l'unique entrée autorisée de C05a.

## Task 4 — C05a `aria: bootstrap canonical resource registry from audited RAG inventory`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/resource-registry-bootstrap.test.ts` avec l'inventory signé/exporté par C03a.

**EXPECTED FAILURE**

Nexus n'a ni ResourceVersion/hash canonique ni comparaison exhaustive avec les identités RAG existantes.

**FILES TO CHANGE**

- `data/aria/resources.v1.json`, `data/aria/bootstrap/rag-resource-inventory.lock.json`
- `data/aria/schemas/resource-registry-v1.schema.json`
- `data/aria/generated/rag-contracts/v1/resource-registry-bootstrap-v1.json`
- `data/aria/rag/contracts.lock.json`
- `lib/aria/manifests/resource-registry.ts`
- `scripts/aria/{import-rag-contracts,import-rag-resource-inventory,export-resource-registry}.ts`
- `__tests__/lib/aria/resource-registry-bootstrap.test.ts`

**MINIMAL IMPLEMENTATION**

Avant de lire l'inventory, importer byte-identical `resource-registry-bootstrap-v1.json` sous `generated/rag-contracts/v1` et créer `contracts.lock.json` avec son `$id`, package SemVer, schema SHA-256 et producer commit. Valider strictement l'inventory C03a contre ce schéma verrouillé, puis vérifier producer SHA/schemaVersion/digest et conserver sans réinterprétation le mapping `resources.resource_id→resourceId`, `artifacts.artifact_id→resourceVersionId`, `artifacts.sha256→contentSha256`. Comparer chaque doc/chunk/attribution/hash, refuser collision ou provenance absente et refuser explicitement l'utilisation de `rag_artifacts.artifact_id` comme ResourceVersion ID. Exporter Registry v1 + digest que C03b devra consommer. Aucun runtime RAG/capability n'est activé dans ce commit.

**MIGRATION IMPACT**

Pas de Prisma ; bootstrap data versionné et reproductible. Toute identité non prouvée reste exclue/manual review.

**SECURITY IMPACT**

Inventory sans PII ; source URI/rights/hash requis ; aucun chemin physique exposé au client.

**PEDAGOGICAL IMPACT**

Une ressource n'est pas déclarée officielle/servable avant preuve de provenance et de contenu.

**REGRESSION TESTS**

- [ ] Schéma bootstrap modifié, `$id`/package/commit/digest divergent, champ inconnu, collision ID/hash, ressource sans source, chunk sans parent et inventory d'un autre SHA échouent fermés.

**EXIT CRITERIA**

Le commit Nexus C05a publie un Registry/digest stable ; C03b peut le consommer sans éditer une identité.

## Task 5 — C03b `rag-engine: publish identity-bound servable corpus manifest` (dépôt RAG)

**RED TEST**

- [ ] Lancer les nouveaux tests unitaires et PG : `python -m pytest services/rag-engine/tests/test_servable_corpus_manifest.py services/rag-engine/tests/integration/test_servable_corpus_manifest_pg.py -q`.

**EXPECTED FAILURE**

Aucun producteur ne joint releases, scopes, artefacts et attributions ; aucun endpoint BFF ne publie le digest.

**FILES TO CHANGE**

- `<RAG_REPO>/services/rag-engine/src/ingestor/{servable_corpus_manifest.py,servable_corpus_index.py,retrieval_v2_endpoint.py,api_v2.py}`
- `<RAG_REPO>/packages/contracts/src/nexus_contracts/ingestion.py`
- `<RAG_REPO>/services/rag-engine/src/ingestor/{ingestion_control/provisioning.py,ingestion_worker/runner.py}`
- `<RAG_REPO>/services/rag-engine/scripts/{build_servable_corpus_manifest_cli.py,deploy_verified_release_cli.py}`
- `<RAG_REPO>/services/rag-engine/infra/nginx/{rag-v2.conf,rag-api.conf.template}`
- `<RAG_REPO>/services/rag-engine/infra/.env.example`
- `<RAG_REPO>/services/rag-engine/tests/{test_servable_corpus_manifest.py,test_servable_corpus_index.py,test_resource_identity_freeze.py,test_retrieval_v2_contract.py}`
- `<RAG_REPO>/services/rag-engine/tests/integration/test_servable_corpus_manifest_pg.py`

**MINIMAL IMPLEMENTATION**

Construire en lecture seule le manifeste depuis la release promue, l'export Resource Registry Nexus et les tables gouvernées. Après bootstrap, `provisioning.py`/`runner.py` refusent tout mint et identité/version absente (`RESOURCE_REGISTRY_ISSUANCE_REQUIRED`). Publier un index `GET /corpora/servable/v1` qui retourne `activeManifestSha256`, `resourceRegistrySha256`, les versions supportées N/N-1 et leur `retireAt`, puis un document immuable `GET /corpora/servable/v1/{manifestSha256}`. `/search/v2` implémente exclusivement les modèles `nexus_contracts.retrieval` exportés par C02, exige le digest piné et renvoie pour chaque résultat ResourceVersion/hash, chunkId et locator exacts plus digests réellement utilisés. N-2, inconnu, retiré, registry incompatible ou digest divergent sont refusés. Aucun DTO local divergent ni mapping `courseKey → collection`.

**MIGRATION IMPACT**

Pas de nouvelle table ; requêtes de lecture et contrat HTTP v1.

**SECURITY IMPACT**

Token de service requis, identité interne signée pour `/search/v2`, messages sûrs, aucun endpoint public.

**PEDAGOGICAL IMPACT**

Un corpus n'est déclaré servable que si scope et artefacts vérifiés concordent.

**REGRESSION TESTS**

- [ ] Mauvais digest, artefact sans attribution, hash divergent, scope non représentable, N-2, corpus inconnu/retiré et registry incompatible échouent fermés.
- [ ] N et N-1 restent servis jusqu'à `retireAt`; l'index et chaque manifeste ont des bytes/digests stables.
- [ ] Provisioning ressource et runner artefact refusent tout nouvel ID après bootstrap, y compris en appel direct.
- [ ] `services/rag-engine/tests/test_lot41_legacy_route_closure.py` reste vert : `/search` ne revient pas.

**EXIT CRITERIA**

Le runtime sert N et N-1 par version immuable, avec digest et identités documentaires traçables.

## Task 6 — C04 `eval: bind retrieval evidence to corpus manifest` (dépôt RAG)

**RED TEST**

- [ ] Lancer `python -m pytest services/rag-engine/tests/test_eval_manifest_binding.py -q`.

**EXPECTED FAILURE**

L'évaluation choisit encore une collection via `COLLECTION_BY_NIVEAU` et ne prouve aucun digest de manifeste.

**FILES TO CHANGE**

- `<RAG_REPO>/services/rag-engine/eval/{contracts.py,run_eval.py}` et `eval/golden/{aria-retrieval-corpus-qualification.v1.schema.json,aria-retrieval-corpus-qualification.v1.jsonl,aria-retrieval-corpus-qualification.v1.review.json}`
- `<RAG_REPO>/services/rag-engine/Makefile`
- `<RAG_REPO>/services/rag-engine/tests/test_eval_manifest_binding.py`
- `<RAG_REPO>/.github/workflows/promote.yml`

**MINIMAL IMPLEMENTATION**

Le RAG possède uniquement la qualification retrieval/corpus. Remplacer les collections par `corpusId + corpusVersionId`, résoudre le binding par le manifeste et inclure `manifestSha256 + ragSuiteFingerprint` dans l'evidence. Le JSON Schema strict et `contracts.py` valident ID, intention, scope, droits/visibilité, attendus de retrieval/citation et seuils. La suite active contient au moins un positif et un cross-scope négatif par corpus et intention, mesure précision/support citation et p95, possède source/licence/rubric/seuils et un artifact de revue nominatif. Tant que `reviewStatus != APPROVED`, schema/runner peuvent être verts mais la promotion reste fermée. Une suite `_legacy_` ne peut pas qualifier la production.

**MIGRATION IMPACT**

Migration de format de fixtures uniquement.

**SECURITY IMPACT**

Les goldens restent sans PII et le runner n'accepte aucun binding client libre.

**PEDAGOGICAL IMPACT**

Les métriques retrieval sont liées au corpus réellement évalué.

**REGRESSION TESTS**

- [ ] `make -C services/rag-engine lint typecheck test`
- [ ] Promotion refusée sans suite active revue et digest correspondant.

**EXIT CRITERIA**

Le PR RAG compagnon est vert, son SHA exact est épinglé, et il n'écrase aucune modification du worktree RAG existant. Le manifeste peut être déployé ; aucune capability pédagogique n'est marquée AVAILABLE avant approval réel de la suite active.

## Task 7 — C05b `aria: consume canonical resource and RAG manifests`

**RED TEST**

- [ ] Créer puis lancer `npm run test:unit -- --runInBand __tests__/lib/aria/resource-registry.test.ts __tests__/lib/aria/rag-manifest.test.ts __tests__/lib/aria/capability-manifest.test.ts`.

**EXPECTED FAILURE**

Ressources hardcodées, faux provenance files, deux mappings ARIA course→collection et aucun digest vérifié.

**FILES TO CHANGE**

- `data/aria/course-capabilities.v1.json`
- `data/aria/rag/servable-corpus-index.lock.json`
- `data/aria/rag/manifests/<manifestSha256>.json` pour N et N-1
- `data/aria/rag/contracts.lock.json`
- `lib/aria/manifests/course-capabilities.ts`
- `lib/aria/infrastructure/rag/manifest.ts`
- `lib/aria/infrastructure/rag/internal-identity.ts`
- `lib/aria/infrastructure/rag/rag-engine-client.ts`
- `scripts/aria/export-resource-registry.ts`
- `scripts/aria/import-rag-manifest.ts`
- `scripts/aria/check-runtime-manifest.ts`
- `lib/aria/application/resources/public.ts`
- `lib/aria/application/resources/ports.ts`
- `lib/aria/infrastructure/prisma/resource-repository.ts`
- `lib/aria/infrastructure/resources/secure-open-linux.ts`
- `lib/aria/infrastructure/resources/resource-content-repository.ts`
- `app/api/aria/resources/route.ts`
- `app/api/aria/resources/[resourceId]/versions/[resourceVersionId]/content/route.ts`
- `data/aria/generated/rag-contracts/v1/{retrieval-request,retrieval-response,retrieval-error,internal-identity-envelope,servable-corpus-index-v1,servable-corpus-manifest-v1}.json`
- `scripts/aria/import-rag-contracts.ts`
- `lib/aria/curriculum.ts`, `lib/aria/rag.ts`, `lib/aria/resources.ts`
- `__tests__/lib/aria/rag-engine-client.test.ts`
- `__tests__/integration/aria-rag-contract.test.ts`
- `__tests__/api/aria.resources.content.route.test.ts`
- `package.json`

**MINIMAL IMPLEMENTATION**

Consommer le Registry C05a et importer byte-identical l'index et les manifests C03b. `servable-corpus-index.lock.json` contient le digest de l'index, le Registry digest, le digest actif, N/N-1 avec `retireAt` et le chemin digest-addressé de chacun ; chaque manifeste est vérifié contre son nom/hash. C05b **complète sans réécrire l'entrée bootstrap** le `contracts.lock.json` créé par C05a avec package SemVer, `$id`, SHA-256 et producer commit des six schemas runtime autoritaires copiés une seule fois sous `generated/rag-contracts/v1`; une fixture de signature commune prouve Python↔Node. Aucun type HTTP n'est réécrit à la main. Nexus déclare seulement `courseKey + pedagogicalMode + agentRole → corpusId`; le client `/search/v2` exige le digest et valide ResourceVersion/hash/chunkId/locator/corpusVersion/manifest. Une citation candidate doit être un sous-ensemble exact des hits du **Turn courant** sur `resourceId/resourceVersionId/contentSha256/chunkId/locator/corpusId/corpusVersionId/manifestSha256`, pas seulement appartenir au manifeste. L'identité interne signée autorise un replay **read-only** seulement pour le même hash de requête pendant 30 s ; tout conflit de scope/manifest ou signature expirée est refusé, sans nouveau store de replay. Les routes resources passent par `application/resources/public.ts`, jamais Prisma/fs/access directs ; le contenu exige **resourceId + resourceVersionId** et ownership/visibility/course. La qualification de faisabilité retient le mécanisme Node/Linux sans dépendance native : racine et segments ouverts par descripteur avec `O_NOFOLLOW`, descente via `/proc/<pid>/fd`, vérification `lstat/realpath/device/inode`, puis `fstat` avant/après lecture bornée. Hash et MIME portent sur les octets lus depuis ce descripteur ; tous les FDs sont fermés avant de diffuser le **snapshot immuable**. Symlink, remplacement concurrent, changement d'identité/taille ou échec de fermeture échoue fermé, avant `Content-Disposition` sûr. Scope académique non représenté échoue. Supprimer mappings et faux `hasResources`.

**MIGRATION IMPACT**

Pas de Prisma ; migration des constantes TypeScript vers registres JSON stricts.

**SECURITY IMPACT**

Refuser path/source/hash absent, citation hors manifeste, digest inconnu, scope académique non représentable et ressource non visible. `RAG_BFF_SERVICE_TOKEN` et la signature interne ne quittent jamais le serveur.

**PEDAGOGICAL IMPACT**

Une capability est `DECLARED/CONFIGURED/AVAILABLE/UNAVAILABLE` selon une preuve, jamais selon une string.

**REGRESSION TESTS**

- [ ] `npm run aria:manifest:check`
- [ ] Ressource MEN sans artefact vérifiable refusée ; manifest inconnu/incompatible/N-2 refusé ; N/N-1 acceptés pendant leur fenêtre.
- [ ] Parent/final symlink, remplacement concurrent, environnement non-Linux, mauvais fstat/hash/taille/MIME, owner/visibility/course et version retirée sont refusés sans fuite de chemin ; le hash porte sur les octets du FD vérifié et le stream diffuse leur snapshot immuable après fermeture.

**EXIT CRITERIA**

`RESOURCE_IDENTITY_SOURCES_OF_TRUTH=1`, `RAG_DOCUMENT_IDENTITY_SOURCES_OF_TRUTH=1`, routes resources dans le bounded context et aucun binding physique authoré dans Nexus.

## Task 8 — C05c `test(aria): establish hermetic TDD lanes before schema work`

**RED TEST**

- [ ] Depuis C05b, lancer `npm run test:aria:db -- --runTestsByPath __tests__/database/aria-test-harness-preflight.test.ts` et `npm run test:aria:integration -- --runTestsByPath __tests__/integration/aria-test-harness-preflight.test.ts`.

**EXPECTED FAILURE**

Les scripts/configs/wrapper n'existent pas encore ; aucun RED DB/concurrency ultérieur ne peut être exécuté en sécurité.

**FILES TO CHANGE**

- `package.json`
- `jest.aria.unit.config.js`, `jest.aria.api.config.js`, `jest.aria.integration.config.js`
- `jest.aria.db.config.js`, `jest.aria.concurrency.config.js`, `jest.aria.sse.config.js`
- `scripts/aria/run-disposable-db-suite.sh`
- `__tests__/database/aria-test-harness-preflight.test.ts`
- `__tests__/integration/aria-test-harness-preflight.test.ts`

**MINIMAL IMPLEMENTATION**

Créer avant C06 les scripts `test:aria:unit`, `test:aria:api`, `test:aria:integration`, `test:aria:db`, `test:aria:concurrency` et `test:aria:sse`. Chaque config exige au moins un test, n'a aucun recouvrement avec une autre lane et refuse `passWithNoTests`. Le wrapper DB valide une URL PostgreSQL jetable allowlistée, fixe `DATABASE_URL/TEST_DATABASE_URL`, migre, sérialise les lanes DB et garantit teardown par trap ; aucun test `.real` ne passe par la config integration. C16 étendra ce harness avec migrations/backfills/coverage/E2E/gates, mais aucun commit C06–C15 ne dépendra d'un script futur.

**MIGRATION IMPACT**

Aucune migration ni fixture métier ; le preflight utilise une base vide jetable et ne modifie jamais une cible externe.

**SECURITY IMPACT**

Refuse localhost/port/database hors allowlist, production/staging et URL absente ; les credentials ne sont pas affichés.

**PEDAGOGICAL IMPACT**

Aucun comportement produit ; rend le cycle RED reproductible avant chaque changement.

**REGRESSION TESTS**

- [ ] Lane vide, overlap `.real`, URL non allowlistée et teardown sur échec font échouer les preflights attendus.

**EXIT CRITERIA**

Les six commandes ciblées existent et exécutent leurs lanes exactes ; tous les RED des commits suivants sont runnable sans dépendre de C16.

## Task 9 — C06 `feat(aria): add turn lifecycle expansion and safe legacy backfills`

**RED TEST**

- [ ] Écrire puis lancer sur DB jetable `npm run test:aria:db -- --runTestsByPath __tests__/database/aria-turn-migration.test.ts __tests__/db/aria-course-backfill.real.test.ts __tests__/db/aria-legacy-backfills.real.test.ts`.

**EXPECTED FAILURE**

Pas de Turn, pas d'unicité active/idempotente, `courseKey` nullable sans état de quarantaine et lifecycle porté par Message.

**FILES TO CHANGE**

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_aria_turn_lifecycle_expand/migration.sql`
- `scripts/aria/audit-legacy-data.ts`
- `scripts/aria/backfill-conversation-context.ts`
- `scripts/aria/backfill-conversation-turns.ts`, `scripts/aria/run-backfills.ts`
- `__tests__/database/aria-turn-migration.test.ts`
- `__tests__/db/aria-course-backfill.real.test.ts`
- `__tests__/db/aria-legacy-backfills.real.test.ts`

**MINIMAL IMPLEMENTATION**

Ajouter `AriaConversationTurn`, status exact, actor/subject/useCase/clientRequestId/fingerprint, sequence, executionToken, heartbeat/lease, `cancellationRequestedAt/cancellationRequestedByActorId`, academic snapshot, policy/metadata et relation messages. Contraindre mécaniquement : uniques référencées Conversation `(id,studentId)` et Turn `(id,conversationId)`, FK composite Turn subject→conversation student, FK composite message→Turn de la même conversation, unique `(turnId,turnRole)`, unique exact `(actorUserId,subjectStudentId,useCase,clientRequestId)`, unique `(conversationId,sequence)`, CHECK runtime fingerprint/token/lease, et **unique index partiel** `WHERE status IN ('PENDING','RUNNING')` par conversation. Ajouter `ACTIVE/LEGACY_CONTEXT_UNRESOLVED` avec CHECK : tout runtime `ACTIVE` a `courseKey`; les nulls historiques sont read-only. Ajouter citation `resourceId/resourceVersionId/contentSha256/chunkId/locator/corpusId/corpusVersionId/manifestSha256`, `AriaEntitlementScope`, FK nullable `Entitlement.sourceSubscriptionId → Subscription.id ON DELETE SET NULL` + unique, préférences v1, `AriaFeedback.updatedAt` et `RECOVER_ARIA_TURN` outbox.

Ajouter aussi `AriaDataMigrationRun` et `AriaDataMigrationRowAudit`. Le Run scelle migration, mode, source snapshot/digest, compteurs, statut et timestamps. Chaque RowAudit a `(runId,sourceType,sourceId)` unique, sourceFingerprint, classification, target table/IDs et before-image **strictement allowlistée sans contenu de message/PII**. Les rows créées par B2–B4 portent `migrationRunId` quand le modèle cible l'autorise ; sinon le RowAudit cible une clé composite et le rollback CAS exige encore le sourceFingerprint. `ARCHIVED_NON_RESUMABLE`/`MANUAL_REVIEW_REQUIRED` sont donc persistés et interrogés par M2, pas seulement loggés.

Backfills C06 dry-run/apply/verify : résolution course uniquement par skill canonique globalement unique, Resource ID dont le Registry prouve l'invariance de cours entre versions, ou Academic Map + sujet donnant un candidat unique ; les 27 familles de raw skill IDs collisionnelles et toute ressource/version non prouvable sont `MANUAL_REVIEW_REQUIRED`. Créer des Turns `LEGACY_IMPORT` terminaux en ordonnant `(createdAt,id)` ; PENDING/STREAMING, messages orphelins/système et groupes ambigus deviennent `ARCHIVED_NON_RESUMABLE`, jamais de paire inventée. Les IDs/sequence legacy sont dérivés par hash stable. Aucun default grade/course.

**MIGRATION IMPACT**

M1 expand non destructive dans #200. Pendant la compatibilité pré-cutover, les anciens binaires peuvent encore écrire `AriaMessage.status` **uniquement sur leurs messages legacy sans turnId**. Pour tout message lié à un Turn, le trigger DB est l'unique projection `Turn.status → AriaMessage.status` et refuse un write indépendant. Ordre obligatoire : M1 → déployer le nouveau binaire génération désactivée → drainer/prouver zéro ancien writer → activer canonical writer → seulement alors B1/B2 et trafic Turn. Le rollback vers l'ancien binaire n'est autorisé qu'avant drainage/cutover et avant tout message lié ; après, kill-switch + recovery + fix-forward. `AriaMessage.feedback` et `AriaConversation.subject` restent legacy read-only dans le nouveau binaire. M2 contract est une vague post-déploiement séparée après guards exacts.

**SECURITY IMPACT**

Scripts dry-run par défaut, logs agrégés sans contenu/email, `--apply` explicite, DB cible validée et production jamais touchée sans autorisation distincte.

**PEDAGOGICAL IMPACT**

Aucun ancien Maths Première/Terminale/STMG n'est approximé ; l'ambiguïté reste visible.

**REGRESSION TESTS**

- [ ] Première/Terminale/Seconde Maths, sujet unsupported, null legacySubject et absence de niveau par défaut.
- [ ] Migration atomique sur DB vide/fixture legacy ; scripts de backfill idempotents/reprenables, zéro double Turn, rollback logique possible.

**EXIT CRITERIA**

M1 passe sur DB vide et clone anonymisé ; les rapports backfill classent chaque ligne en résolue ou quarantinée, sans perte. Les garanties FK/CHECK/index sont prouvées sur PostgreSQL réel.

## Task 10 — C07 `feat(aria): enforce canonical actor subject and entitlement context`

**RED TEST**

- [ ] Lancer les tests rouges : `npm run test:unit -- --runInBand __tests__/lib/aria/context.test.ts __tests__/lib/aria/access.test.ts __tests__/api/aria.auth.route.test.ts __tests__/api/aria.curriculum.route.test.ts`.
- [ ] Lancer le RED du thread `npm run test:aria:integration -- --runTestsByPath __tests__/integration/aria-application.test.ts` et exiger `THREAD_NO_CHAT_REACHES_MODEL` avec provider count zéro.
- [ ] Lancer sur DB jetable `npm run test:aria:db -- --runTestsByPath __tests__/db/aria-entitlement-backfill.real.test.ts __tests__/db/aria-conversation-context-integrity.real.test.ts`.

**EXPECTED FAILURE**

Le contexte accepte override, reconstruit `ariaSubjects` deux fois, ignore certains grants et laisse `hasChat=false` atteindre le modèle.

**FILES TO CHANGE**

- `lib/aria/application/conversation/build-context.ts`
- `lib/aria/application/conversation/public.ts`
- `lib/aria/kernel/actor-subject.ts`
- `lib/aria/kernel/entitlements.ts`
- `lib/aria/kernel/errors.ts`
- `lib/entitlement/types.ts`, `lib/entitlement/engine.ts`
- `lib/aria/context.ts`, `lib/aria/access.ts`
- `app/api/aria/curriculum/route.ts`
- `scripts/aria/backfill-entitlements.ts`
- `__tests__/api/aria.auth.route.test.ts`
- `__tests__/db/aria-conversation-context-integrity.real.test.ts`

**MINIMAL IMPLEMENTATION**

Résoudre actor depuis session, subject=self, entitlement générique `aria_access` et `AriaEntitlementScope` depuis **tous** les grants actifs/date-valides ; les scopes de sources distinctes s'unissent, mais ne peuvent jamais rendre académiquement pertinent ou chat-capable un cours qui ne l'est pas. Chaque Subscription produit au plus un Entitlement source : ACTIVE→ACTIVE, INACTIVE→SUSPENDED, CANCELLED→REVOKED, EXPIRED→EXPIRED, dates conservées. `ALL` devient GLOBAL ; courseKey explicite reste COURSE ; alias Maths/NSI/STMG ne devient scope que si Academic Map + capability donnent exactement un cours, sinon manual review. Malformed/unknown ne donne aucun grant. Valider conversation, skill/resource demandé **et** persisté, owner/visibility/version. Retourner un contexte opaque non constructible par route.

**MIGRATION IMPACT**

Consomme le schéma scope C06. Ordre de release : M1 → backfill → job read-only legacy/canonique sur chaque bénéficiaire → divergence zéro → déploiement du runtime canonique ; aucune double lecture commerciale dans les requêtes live. Toute divergence du legacy « newest ACTIVE » avec l'union canonique bloque le cutover et exige assainissement de donnée, jamais une approximation.

**SECURITY IMPACT**

Ferme override student, direct orchestrator bypass, cross-course conversation/skill/resource et entitlement incomplet.

**PEDAGOGICAL IMPACT**

Le contexte exact cours/grade/pathway est snapshoté sans inventer candidat libre/LVA/LVB.

**REGRESSION TESTS**

- [ ] Feature-key legacy migrée, course-key, STMG explicite et global access.
- [ ] Session absente et rôles PARENT/COACH/ADMIN refusés par l'envelope auth stable sur toutes les routes ; global/course grant ne contourne ni academic relevance ni `hasChat=false`.
- [ ] Extension/révocation/date du parent Entitlement modifie l'accès sans statut dupliqué dans le scope ; contrainte global/course, `sourceSubscriptionId` unique et deux exécutions concurrentes/répétées du backfill prouvées en DB réelle.
- [ ] Cours non chat, conversation inconnue, mismatch étudiant/cours, skill/ressource demandés ou déjà persistés cross-course.

**EXIT CRITERIA**

Un seul builder entitlement et une seule boundary d'autorisation ; aucune route ne reconstruit le contexte.

## Task 11 — C08 `feat(aria): reserve idempotent conversation turns`

**RED TEST**

- [ ] Lancer `npm run test:aria:db -- --runTestsByPath __tests__/db/aria-turn-reservation.real.test.ts __tests__/concurrency/aria-turn-concurrency.real.test.ts`.

**EXPECTED FAILURE**

Deux retries/double-clics créent plusieurs messages/appels et les réponses peuvent s'entrelacer.

**FILES TO CHANGE**

- `lib/aria/domain/conversation/turn-state.ts`
- `lib/aria/application/conversation/ports.ts`
- `lib/aria/infrastructure/prisma/conversation-repository.ts`
- `lib/aria/application/conversation/reserve-turn.ts`
- `lib/aria/application/conversation/claim-turn.ts`
- `lib/aria/transport/contracts.ts`
- `app/api/aria/chat/route.ts`
- `components/ui/aria-chat.tsx`, `components/ui/aria-widget.tsx` (adaptation transitoire, sans fallback)
- `__tests__/lib/aria/turn-state.test.ts`
- `__tests__/db/aria-turn-reservation.real.test.ts`
- `__tests__/concurrency/aria-turn-concurrency.real.test.ts`

**MINIMAL IMPLEMENTATION**

TX1 verrouille/résout la conversation, refuse unknown/mismatch, calcule sequence, crée Turn `PENDING`, user message, assistant placeholder et watchdog dans la même transaction. Le watchdog a une clé unique `aria-turn-watchdog:<turnId>`, payload `{turnId}`, `availableAt=leaseExpiresAt`. Une transaction courte CAS `PENDING→RUNNING` ajoute `executionToken`, heartbeat et lease avant tout réseau. Même clé/fingerprint terminale rejoue le résultat persisté ; même clé active retourne `202 TURN_IN_PROGRESS` avec le même turnId/status/retryAfter sans provider ; fingerprint différent retourne `409 IDEMPOTENCY_CONFLICT` ; autre clé active retourne `409 CONVERSATION_BUSY`. Traiter P2002 par relecture/classification.

Introduire dès ce commit le contrat minimal route/client `clientRequestId` UUID obligatoire et le propager dans les deux composants encore présents, sans ID serveur par défaut. Le refactor transport complet reste C13.

**MIGRATION IMPACT**

Utilise M1 sans autre migration.

**SECURITY IMPACT**

La clé est scopée actor+subject+useCase et ne permet ni lecture cross-student ni changement de payload.

**PEDAGOGICAL IMPACT**

Empêche les réponses intercalées et les doubles interventions.

**REGRESSION TESTS**

- [ ] Même clientRequestId deux fois : un Turn, une paire de messages.
- [ ] Deux clés concurrentes : une réservation, une 409 ; conversations différentes parallèles.
- [ ] Deux créations de nouvelle conversation avec la même clé : une seule conversation ; rollback TX1 après première écriture ; FK cross-student/course/Turn/message refusées.

**EXIT CRITERIA**

Le test concurrent réel prouve `MODEL_INVOCATION_COUNT` encore nul après réserve, un seul watchdog et au plus un Turn PENDING/RUNNING par conversation. Tous les commits suivants restent verts avec le clientRequestId strict.

## Chunk 2 — Policies, transports, frontend et release gates

## Task 12 — C09 `feat(aria): resolve pedagogical retrieval and prompt policies`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/pedagogical-policy.test.ts __tests__/lib/aria/retrieval-policy.test.ts __tests__/lib/aria/history-budget.test.ts __tests__/lib/aria/prompt.test.ts`.
- [ ] Lancer `npm run test:aria:db -- --runTestsByPath __tests__/db/aria-history-window.real.test.ts`.

**EXPECTED FAILURE**

Le prompt applique une règle globale, le RAG dépend du cours seul et l'historique prend un nombre fixe.

**FILES TO CHANGE**

- `data/aria/pedagogical-policies.v1.json`
- `lib/aria/kernel/global-safety-policy.ts`
- `lib/aria/domain/pedagogy/pedagogical-mode.ts`
- `lib/aria/domain/retrieval/policy.ts`
- `lib/aria/domain/conversation/history-budget.ts`
- `lib/aria/infrastructure/prisma/conversation-repository.ts`
- `lib/aria/application/conversation/build-prompt.ts`
- `lib/aria/prompt.ts`, `lib/aria/rag.ts`
- `__tests__/db/aria-history-window.real.test.ts`

**MINIMAL IMPLEMENTATION**

Déclarer tous les modes, n'activer que les policies livrées, composer safety × role × mode × subject. Résoudre `NO_MODEL/GENERAL_CHAT/OPTIONAL_GROUNDING/GROUNDED_REQUIRED/RESOURCE_GROUNDED_REQUIRED` depuis mode/cours/resource/role/visibility/capabilities. Distinguer NOT_CONFIGURED/NO_RESULTS/RUNTIME_UNAVAILABLE/SUCCESS. Le repository lit les Turns COMPLETED en `(createdAt DESC,id DESC)` ; le budgeter déterministe sélectionne le suffixe pertinent puis le renverse chronologiquement. La fixture de 15 messages, calibrée à dix messages, doit rendre les dix plus récents sans figer « 10 » comme architecture permanente.

**MIGRATION IMPACT**

Aucune DB ; format de policy versionné.

**SECURITY IMPACT**

Injection/safety restent globales ; resource grounding limite strictement les versions autorisées.

**PEDAGOGICAL IMPACT**

WORKED_EXAMPLE peut montrer une solution ; GUIDED_PRACTICE suit une progression d'indices. Aucune règle universelle « jamais la réponse ».

**REGRESSION TESTS**

- [ ] 15+ messages : test unitaire du budget et test PostgreSQL réel reproduisant l'ancien `ASC + take`, fenêtre des dix plus récents sous la fixture budgetée, ordre chronologique.
- [ ] RAG quatre états, optional explicite, required fail-closed, resource mismatch.

**EXIT CRITERIA**

Un seul prompt builder/retrieval pipeline et métadonnées policy/RAG toujours observables.

## Task 13 — C10 `feat(aria): harden provider-neutral model gateway and public errors`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/gateway.test.ts __tests__/lib/aria/model-policy.test.ts __tests__/lib/aria/public-errors.test.ts`.

**EXPECTED FAILURE**

Timeout non fiable, fallback credential `ollama`, modèle unique et messages internes exposables.

**FILES TO CHANGE**

- `data/aria/model-policies.v1.json`
- `lib/aria/infrastructure/model/config.ts`
- `lib/aria/infrastructure/model/policy.ts`
- `lib/aria/infrastructure/model/gateway.ts`
- `lib/aria/kernel/errors.ts`
- `lib/aria/application/public-error.ts`
- `lib/aria/gateway.ts`, `lib/aria/errors.ts`
- `__tests__/lib/aria/gateway.test.ts`, `__tests__/lib/aria/public-errors.test.ts`

**MINIMAL IMPLEMENTATION**

Sélectionner par vision/reasoning/structured/tool/context/latency/coût. Config hosted/local explicite : hosted exige une vraie key, local exige provider + base URL explicites. Combiner signal caller et timeout interne avec ordre déterministe, listeners/timer toujours nettoyés. Mapper USER_CANCELLED, MODEL_TIMEOUT, PROVIDER_UNAVAILABLE et configuration INTERNAL vers la matrice publique versionnée : neuf erreurs métier, deux conflits 409 et résultat 202, chacun limité à sa phase. Fallback seulement équivalent/autorisé et tracé.

**MIGRATION IMPACT**

Aucune DB ; variables d'environnement documentées sans secret.

**SECURITY IMPACT**

Erreurs publiques stables, logs structurés redacted avec requestId ; aucun endpoint/path/email/payload provider au navigateur.

**PEDAGOGICAL IMPACT**

Pas de downgrade silencieux vers un modèle moins capable.

**REGRESSION TESTS**

- [ ] Fake timers timeout, abort avant/pendant timeout, cleanup listeners/timer, provider 5xx, hosted sans vraie key, local sans provider/base URL, capability mismatch et fallback équivalent explicite.
- [ ] Table paramétrée couvrant chaque code dans les seules phases autorisées ; capture logger prouve requestId présent et redaction path/email/account/endpoint/payload/key/stack côté client **et** serveur.

**EXIT CRITERIA**

Seul le gateway importe les SDK providers et toutes les issues sont typées/observables.

## Task 14 — C11 `feat(aria): execute and finalize one canonical conversation pipeline`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/run-conversation.test.ts __tests__/lib/aria/persistence.test.ts`.
- [ ] Lancer `npm run test:aria:db -- --runTestsByPath __tests__/db/aria-turn-finalization.real.test.ts __tests__/db/aria-turn-cancel.real.test.ts __tests__/concurrency/aria-turn-terminal-races.real.test.ts` ; `THREAD_CANCEL_PERSISTED_ERROR` doit être rouge avant le fix.

**EXPECTED FAILURE**

Deux flows génération/persistance, RAG downgrade et status Message mutable ; cancellation devient ERROR.

**FILES TO CHANGE**

- `lib/aria/application/conversation/run-conversation.ts`
- `lib/aria/application/conversation/cancel-turn.ts`
- `lib/aria/application/conversation/cancellation-registry.ts`
- `lib/aria/application/conversation/result-events.ts`
- `lib/aria/infrastructure/prisma/conversation-repository.ts`
- `lib/aria/application/conversation/public.ts`
- `lib/aria/core.ts`, `lib/aria/orchestration.ts`
- supprimer `lib/aria.ts`, `lib/aria-streaming.ts` et les wrappers `generateAriaResponse*`/`saveAriaConversation` après portage des tests utiles
- `__tests__/lib/aria/run-conversation.test.ts`
- `__tests__/lib/aria/persistence.test.ts`
- `__tests__/db/aria-turn-finalization.real.test.ts`
- `__tests__/db/aria-turn-cancel.real.test.ts`
- `__tests__/concurrency/aria-turn-terminal-races.real.test.ts`

**MINIMAL IMPLEMENTATION**

Orchestrer exactement contexte → réserve/claim → retrieval → prompt → gateway → TX2. Accumuler le buffer en mémoire. Avant TX2, normaliser les hits du Turn et refuser toute citation qui n'est pas leur sous-ensemble exact sur `resourceId/resourceVersionId/contentSha256/chunkId/locator/corpusId/corpusVersionId/manifestSha256`, même si elle existe ailleurs dans le manifeste. TX2 compare `status=RUNNING + executionToken`, puis écrit atomiquement contenu, citations, metadata, état terminal, watchdog et projection legacy par trigger. `done/onComplete` ne part qu'après commit. Un échec TX2 laisse le Turn récupérable, émet une alerte structurée et ne lance aucune seconde terminalisation indépendante. Supprimer ici le pipeline `saveAriaConversation` et tous les wrappers test-only afin que la métrique pipeline=1 soit vraie dès C11.

L'annulation produit une commande explicite : elle vérifie ownership et le clientRequestId. Si le Turn est `PENDING`, une transaction CAS pose actor/timestamp, effectue immédiatement `PENDING→CANCELLED`, projette le placeholder Message et complète le watchdog. Si le claim concurrent gagne, le cancel relit `RUNNING`, pose idempotemment `cancellationRequestedAt`, signale le contrôleur local et est observé au heartbeat DB par un autre process. Un terminal se rejoue sans mutation. Une simple déconnexion SSE détache le transport mais n'annule pas le Turn ; cela permet un retry avec la même clé. L'action « Arrêter » appelle la commande, attend l'acceptation, puis ferme le reader.

**MIGRATION IMPACT**

Utilise les champs Turn/citation M1 ; aucun nouveau schéma.

**SECURITY IMPACT**

Aucun direct caller ne contourne le contexte ; les metadata provider sensibles sont filtrées.

**PEDAGOGICAL IMPACT**

Le résultat conserve mode/policy/grounding exacts et ne crée aucune Evidence/mastery.

**REGRESSION TESTS**

- [ ] Idempotent retry complet : `MODEL_INVOCATION_COUNT=1`.
- [ ] hasChat=false : 0 model ; cancel : Turn CANCELLED ; RAG required unavailable : 0 model.
- [ ] `PENDING→CANCELLED` atomique complète watchdog/projection ; course claim contre cancel : exactement un gagnant, et le perdant relit/applique la sémantique RUNNING/terminale sans ERROR.
- [ ] Citation manifest-valid mais absente des hits de ce Turn : TX2 refusée, Turn récupérable et alerte structurée.
- [ ] Assert transaction close avant RAG/provider, rollback TX2 sur insertion citation, CAS token winner unique et stale token après recovery refusé.

**EXIT CRITERIA**

`ARIA_GENERATION_PIPELINES=1`, `ARIA_RETRIEVAL_PIPELINES=1`, `ARIA_PERSISTENCE_PIPELINES=1`, `ARIA_PROMPT_BUILDERS=1`.

## Task 15 — C12 `feat(aria): recover stale turns independently of requests`

**RED TEST**

- [ ] Lancer `npm run test:aria:db -- --runTestsByPath __tests__/db/aria-turn-recovery.real.test.ts __tests__/concurrency/aria-turn-terminal-races.real.test.ts` puis le test scheduler fake timers.

**EXPECTED FAILURE**

Seule une nouvelle requête déclenche un cleanup et des messages restent STREAMING.

**FILES TO CHANGE**

- `lib/aria/infrastructure/jobs/recovery-worker.ts`
- `lib/aria/infrastructure/jobs/recovery-scheduler.ts`
- `lib/aria/infrastructure/jobs/fenced-claim.ts`
- `scripts/aria/drain-turn-recovery-outbox.ts`
- `instrumentation.ts`
- `package.json`
- `__tests__/lib/aria/recovery-scheduler.test.ts`
- `__tests__/db/aria-turn-recovery.real.test.ts`
- `__tests__/concurrency/aria-turn-terminal-races.real.test.ts`

**MINIMAL IMPLEMENTATION**

Étendre les primitives JobOutbox lease/SKIP LOCKED avec un claim clôturé : TX job-only claim/commit, puis TX recovery qui verrouille Turn→Job et revérifie owner/token ; aucun verrou Job n'est conservé pendant l'acquisition du Turn. En production, les writes Turn sont refusées au startup si le worker n'est pas activé. Heartbeat borné à 10 s et stale 60 s repousse atomiquement lease Turn + `availableAt` du watchdog sous le même ordre Turn→Job. Terminalisation normale annule/complète le watchdog dans TX2. Le worker traite d'abord `PENDING + cancellationRequestedAt → CANCELLED`; seulement sans demande d'annulation, il applique CAS stale `PENDING|RUNNING + executionToken → ERROR/EXECUTION_INTERRUPTED`. Après le seuil d'alerte, un watchdog reste retryable tant que son Turn est actif ; jamais `FAILED_FINAL`/quarantaine permanente. Supprimer `recoverStuckStreamingMessages()` et ses catches dès ce commit.

**MIGRATION IMPACT**

Utilise `RECOVER_ARIA_TURN` ajouté en M1.

**SECURITY IMPACT**

Payload outbox contient IDs/version seulement, jamais prompt/conversation/PII.

**PEDAGOGICAL IMPACT**

Une interruption est visible comme échec récupérable, jamais présentée comme réponse complète.

**REGRESSION TESTS**

- [ ] Recovery sans requête, PENDING crash, heartbeat récent concurrent au claim, claim-worker versus heartbeat sans deadlock sur PostgreSQL réel, deux workers SKIP LOCKED, finalization failure, stale execution token et watchdog au seuil toujours retryable.
- [ ] Aucun write par token ; bounded heartbeat vérifié.

**EXIT CRITERIA**

`STUCK_STREAMING_MESSAGE_RECOVERY=PASS` sur DB réelle et arrêt/restart scheduler testé.

## Task 16 — C13 `feat(aria): expose strict SSE JSON and history transports`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/sse.test.ts __tests__/api/aria.chat.route.test.ts __tests__/api/aria.conversations.route.test.ts`.

**EXPECTED FAILURE**

Chat accepte subject/course absent, history utilise subject/oldest 20, SSE schema/parser incomplets et raw errors.

**FILES TO CHANGE**

- `lib/aria/transport/contracts.ts`
- `lib/aria/transport/sse.ts`
- `lib/aria/transport/json.ts`
- `lib/aria/sse.ts`, `lib/aria/contracts.ts`
- `app/api/aria/chat/route.ts`
- `app/api/aria/turns/[turnId]/cancel/route.ts`
- `app/api/aria/conversations/route.ts`
- `app/api/aria/conversations/[conversationId]/messages/route.ts`
- `app/api/aria/profile/route.ts`
- `app/api/aria/feedback/route.ts`

**MINIMAL IMPLEMENTATION**

Schémas `.strict()` discriminés ; courseKey/clientRequestId obligatoires, aucun subject/studentId/grade/entitlement/unknown. Le contexte et la réservation précèdent `Response` et appliquent la matrice publique d'`ARIA_V1.md` : erreurs validation/access/not-found et conflits restent JSON pré-stream ; le même Turn actif retourne 202 sans stream. Après `start`, seuls RAG/MODEL/INTERNAL peuvent émettre exactement un terminal `error`; `done` porte COMPLETED/CANCELLED. Un terminal retry est rejoué depuis la DB sans modèle. SSE et JSON consomment le même résultat applicatif avec parité metadata.

Le parser unique gère UTF-8, event splits, multi-event, CRLF, heartbeat explicite, flush final, Content-Type et AbortSignal. Ajouter la mutation stricte `POST /api/aria/turns/[turnId]/cancel` ; ownership et clientRequestId sont vérifiés, la déconnexion réseau seule ne change aucun état.

History sépare deux endpoints : `GET /conversations?courseKey` liste les conversations par `(updatedAt DESC,id DESC)` ; `GET /conversations/{id}/messages` page les messages par `(createdAt DESC,id DESC)`. Les curseurs opaques portent les deux valeurs, chaque page messages est chronologique, et le client **préfixe** les pages plus anciennes. Le DTO message contient courseKey, conversationId, turnId, messageId, role, content, Turn status, citations, feedback canonique et createdAt. Les conversations `LEGACY_CONTEXT_UNRESOLVED` sont lisibles séparément mais non reprenables ; la reprise choisit la conversation reprenable la plus récente du cours.

**MIGRATION IMPACT**

Contrat HTTP breaking assumé : aucun caller runtime subject prouvé.

**SECURITY IMPACT**

Toutes mutations strictes ; erreurs redacted ; payload SSE runtime-validé.

**PEDAGOGICAL IMPACT**

History et citations restent attachés au bon cours et à la bonne policy.

**REGRESSION TESTS**

- [ ] Invalid JSON/shape/unknown event, fragmented UTF-8/event, multiples/chunk, flush, abort.
- [ ] Unknown field/studentId injection 400 ; unknown conversation 404 ; busy 409.
- [ ] Timestamps égaux sans perte/doublon ; pre-stream HTTP versus post-start terminal ; un seul terminal ; Content-Type SSE ; JSON/SSE metadata identiques.

**EXIT CRITERIA**

`ARIA_SSE_PARSERS=1`, `SSE_RUNTIME_SCHEMA_VALIDATION=PASS`, `ARIA_HISTORY_PRIMARY_CONTEXT=COURSE_KEY`.

## Task 17 — C14 `feat(aria): canonicalize feedback and learning preferences`

**RED TEST**

- [ ] Lancer `npm run test:unit -- --runInBand __tests__/lib/aria/feedback.test.ts __tests__/lib/aria/profile.test.ts __tests__/api/aria.feedback.route.test.ts __tests__/api/aria.profile.route.test.ts`.
- [ ] Lancer `npm run test:aria:db -- --runTestsByPath __tests__/concurrency/aria-feedback-concurrency.real.test.ts __tests__/db/aria-feedback-profile-backfill.real.test.ts`.

**EXPECTED FAILURE**

Feedback double-écrit/non atomique ; uiPreferences sans borne ; selectedCourseKeys gate l'accès.

**FILES TO CHANGE**

- `lib/aria/application/feedback/public.ts`
- `lib/aria/infrastructure/prisma/feedback-repository.ts`
- `lib/aria/application/profile/public.ts`
- `lib/aria/domain/profile/preferences.ts`
- `lib/aria/infrastructure/prisma/profile-repository.ts`
- `lib/aria/feedback.ts`, `lib/aria/profile/service.ts`
- `scripts/aria/backfill-feedback-profile.ts`
- `__tests__/concurrency/aria-feedback-concurrency.real.test.ts`
- `__tests__/db/aria-feedback-profile-backfill.real.test.ts`
- routes/tests feedback/profile associés

**MINIMAL IMPLEMENTATION**

Faire un upsert atomique AriaFeedback. Aucune écriture applicative ni trigger ne met à jour `AriaMessage.feedback`; si un champ legacy DTO subsiste, il est dérivé à la lecture depuis `AriaFeedback`, et history joint la table canonique. Le backfill upsert l'ancien booléen avant désactivation de ses readers/writers.

Le profil utilise un discriminant réel `version: 1` et un PUT de remplacement complet strict : `pinnedCourseKeys`, `focusedCourseKey|null`, `courseOrder`, `showCitations`. Pins/focus/order peuvent être vidés explicitement, les doublons sont rejetés, toutes les clés doivent appartenir à l'Academic Map courant, et `courseOrder` peut être partiel (le reste suit l'ordre Academic Map). Quand le cursus change, le read model filtre les préférences devenues hors map sans détruire silencieusement la valeur stockée ; le prochain PUT réécrit l'état valide. Defaults : pins/order vides, focus null, showCitations true. `SETUP_REQUIRED` uniquement pour configuration réellement manquante.

**MIGRATION IMPACT**

Consomme M1 puis exécute ici le backfill feedback/profile dry-run/apply/verify ; zéro conversion silencieuse de selected→pins.

**SECURITY IMPACT**

Ownership message/student vérifié ; erreurs DB visibles ; aucune settings bag/injection.

**PEDAGOGICAL IMPACT**

Le cockpit reflète les cours réels ; les préférences ne peuvent les masquer.

**REGRESSION TESTS**

- [ ] Feedback duplicate/idempotent, DB error, cross-student message.
- [ ] Deux upserts concurrents réels sur `(messageId,studentId)` donnent une ligne et une valeur terminale déterministe.
- [ ] Unknown preference/studentId rejetés, pin invalide rejeté, ordre/focus réellement consommés.

**EXIT CRITERIA**

`ARIA_FEEDBACK_SOURCES_OF_TRUTH=1`, erreurs persistance non avalées, profil strict versionné.

## Task 18 — C15 `feat(aria): consolidate one authenticated product chat engine`

**RED TEST**

- [ ] Lancer les tests composants/reachability : `npm run test:unit -- --runInBand __tests__/components/aria/chat-panel.test.tsx __tests__/architecture/aria-frontend-boundary.test.ts`.

**EXPECTED FAILURE**

Deux moteurs JSON, cours hardcodés, fallback Terminale Maths, aucun client SSE/history/curriculum.

**FILES TO CHANGE**

- `lib/aria/client.ts`
- `components/aria/AriaChatPanel.tsx`
- `components/aria/useAriaConversation.ts`
- `components/aria/AriaChatLauncher.tsx`
- `components/aria/AriaMarketingDemo.tsx`
- `__tests__/components/aria/chat-panel.test.tsx`
- `__tests__/components/aria/chat-panel.a11y.test.tsx`
- `__tests__/components/aria/chat-markdown-security.test.tsx`
- `__tests__/components/aria/use-aria-conversation.test.tsx`
- `app/dashboard/eleve/page.tsx`
- `app/plateforme-aria/page.tsx`
- supprimer `components/ui/aria-chat.tsx`, `aria-widget.tsx`, `aria-feedback.tsx`, `aria-comparison.tsx`
- supprimer `lib/aria/legacy-adapter.ts` après portage des seuls tests backfill vers `scripts/aria/legacy-context-resolver.ts`

**MINIMAL IMPLEMENTATION**

Un client navigateur appelle curriculum/history/profile/feedback/chat SSE et conserve clientRequestId lors d'un retry. Sur 202, il affiche « réponse en cours », attend un retryAfter borné et répète la commande byte-identical jusqu'au replay terminal ou timeout client ; fermeture/changement de cours stoppe la reprise, sans nouvel ID. Panel authentifié unique ; launcher dashboard thin wrapper. Il affiche tous les cours Academic Map et leur état ; seuls `hasChat && entitled` sont sélectionnables. Sélection initiale : focusedCourseKey disponible, sinon premier disponible, sinon état vide explicite — jamais de fallback. Un changement de cours détache le stream, rejette les events tardifs par generation token, puis charge l'historique du nouveau cours. Le Dialog assure focus initial/trap/retour, Escape, `aria-modal`, `aria-live` non verbeux, `aria-busy`, labels et raisons disabled. Le renderer interdit HTML brut/`dangerouslySetInnerHTML`/`rehype-raw`, allowliste liens/citations canoniques et bloque `javascript:`, `data:` et images distantes. La page publique est statique et n'appelle aucun `/api/aria/**`. Supprimer adapters subject et APIs test-only restantes.

**MIGRATION IMPACT**

Aucune DB ; rupture frontend interne contrôlée.

**SECURITY IMPACT**

Pas de provider/model/studentId dans le client ; abort sur fermeture/changement cours ; erreurs publiques seulement.

**PEDAGOGICAL IMPACT**

Un historique/course cohérent, citations affichées selon préférence, aucune matière inventée.

**REGRESSION TESTS**

- [ ] Thread widget sans fallback/hasChat disabled ; 14 tests composants nommés (reachability, curriculum, sélection/empty/disabled, retry 202, IDs, changement/abort/events tardifs/détachement, Dialog/live, Markdown/citations, feedback 2xx).

**EXIT CRITERIA**

`ARIA_CHAT_FRONTEND_ENGINES=1`, `ACTIVE_SUBJECT_BASED_CHAT_CLIENTS=0`, `ARIA_ORPHAN_COMPONENTS=0`.

## Task 19 — C16 `test(aria): enforce architecture integrity and release evidence`

**RED TEST**

- [ ] Lancer les nouveaux gates avant implémentation : `npm run test:aria:architecture && npm run aria:integrity && npm run aria:coverage:check && npm run aria:evaluate:check`.

**EXPECTED FAILURE**

Scripts/tests/coverage/golden set absents et imports/mappings legacy encore détectés.

**FILES TO CHANGE**

- `__tests__/architecture/aria-application-boundary.test.ts`
- `__tests__/architecture/aria-provider-boundary.test.ts`
- `__tests__/architecture/aria-persistence-boundary.test.ts`
- `__tests__/architecture/aria-lifecycle-feedback-boundary.test.ts`
- `__tests__/architecture/aria-manifest-boundary.test.ts`
- `__tests__/architecture/aria-frontend-boundary.test.ts`
- `__tests__/architecture/aria-contract-boundary.test.ts`
- `__tests__/architecture/aria-docs-coverage-boundary.test.ts`
- `scripts/aria/check-integrity.ts`, `scripts/aria/generate-coverage.ts`, `scripts/aria/evaluate.ts`
- `scripts/aria/{run-disposable-db-suite.sh,run-backfills.ts}`, `__tests__/fixtures/aria-legacy-backfill.sql`
- `scripts/github/assert-pr-review-state.mjs`
- `scripts/e2e/aria-fixture-provider.ts`
- `data/aria/academic-profile-requirements.v1.json`
- `data/aria/evaluation/conversation-policy.v1.schema.json`
- `data/aria/evaluation/conversation-policy.v1.jsonl`
- `data/aria/evaluation/conversation-policy.v1.review.json`
- `data/aria/evaluation/conversation-e2e.v1.json`
- `lib/aria/evaluation/contracts.ts`
- `__tests__/lib/aria/evaluation-contract.test.ts`
- `docs/_generated/aria-academic-capability-coverage.v1.json`
- `docs/stack-closure/ZERO_DEBT_LEDGER.json`
- `e2e/auth/aria.chat.spec.ts`, `e2e/auth/student-aria.spec.ts`, `e2e/auth/student-dashboard.spec.ts`
- `e2e/auth/aria.responsive-a11y.spec.ts`, `e2e/auth/aria.security.spec.ts`, `e2e/auth/aria.runtime-quality.spec.ts`
- `e2e/helpers/aria-personas.ts`, `e2e/helpers/assert-clean-aria-page.ts`
- `e2e/public/aria-platform.spec.ts`
- `e2e/candidate-diagnostic.spec.ts`, `e2e/real/coach-resource-student.spec.ts`
- `e2e/helpers/credentials.ts`, `scripts/seed-e2e-db.ts`
- `docker-compose.e2e.yml`, `scripts/run-e2e-ephemeral.sh`
- `playwright.config.e2e.ts`
- `scripts/testing/check-zero-test-debt.mjs`
- supprimer `e2e/QUARANTINE.md`
- `jest.integration.config.js`
- `jest.aria.coverage.config.js`
- `package.json`, `.github/workflows/ci.yml`

**MINIMAL IMPLEMENTATION**

Ajouter scans AST/imports, scripts integrity/coverage/eval, golden set strict human-reviewable et jobs CI. Le schéma, le corpus JSONL et l'artifact de revue sont trois fichiers distincts ; chaque cas a ID, task/mode/course/grade, contexte autorisé, policy attendue, fixture provider/RAG, rubric atomique, provenance et reviewer. Un digest lie ces trois fichiers et `reviewStatus != APPROVED` interdit le gate go-live, sans empêcher les tests de schéma déterministes. Le drift guard extrait et compare exhaustivement les 7 `GradeLevel`, 8 `AcademicTrack`, 5 `StmgPathway`, chaque profil du catalogue et les dimensions LVA/LVB, candidature, session et mode de scolarisation. Il produit séparément états/compteurs représentation et capability, sans 100 % implicite.

Ajouter un provider modèle + RAG fixture hermétique dans la stack E2E : chunks/delays/barrière RUNNING contrôlables, manifeste/digest/citations valides, token/signature vérifiés, démarrage impossible sans `E2E_DISPOSABLE_STACK=1`. Les personas Terminale Maths, Première Maths, NSI, STMG no-chat, incomplete-profile et not-entitled sont seedés immuablement ; aucun test ne modifie le grant d'un persona partagé. Les lifecycle E2E traversent le vrai backend/DB et ne sont pas mockés par `page.route()`.

Étendre le wrapper DB livré par C05c : conserver son allowlist/teardown et ajouter `--migrations`, `--backfills` et le lifecycle E2E. Le mode backfill charge la fixture legacy puis exécute audit→apply→verify avec les mêmes URLs exportées. Les scripts `package.json` finaux ont les mappings exacts du Chunk 5 : `aria:enum-drift`, `test:integration:disposable`, `test:aria:{unit,api,integration,db,concurrency,sse,architecture,coverage,e2e:desktop,e2e:mobile,a11y,migrations,backfills}`, `aria:{test-plan:check,coverage:check,integrity,security,reachability,manifest:check,manifest:runtime-check,performance:check,evaluate:check,evaluate,artifact:check,smoke:production-artifact,review-gate}`, `test:zero-debt` et `typecheck:aria-scripts`. Chaque lane Jest pointe vers une config non chevauchante ; `test:integration:disposable` mappe le wrapper `--integration`, DB/concurrency/migration/backfill passent aussi par le wrapper ; desktop/mobile/a11y passent par la stack E2E hermétique ; les autres appellent les scripts listés dans §29. `aria:backfills` reste le runner interne mais aucune commande de validation ne l'exécute hors wrapper.

Nexus possède uniquement l'évaluation conversation end-to-end et référence `ragSuiteFingerprint` sans copier ni éditer les cas RAG. Le corpus #200 couvre 19 cas nommés : six contrats de base, non-approximation STMG, worked example, resource-grounded, required/optional NO_RESULTS et unavailable, injections utilisateur/document, safety mineur, hallucination hors source, candidat libre non représentable et langue obligatoire non représentable. Le mode fixture eval est hermétique ; le mode provider produit `.artifacts` et reste un gate go-live pédagogique distinct. Le Playwright ARIA paramètre les quatre viewports requis dans les specs, utilise `trace: retain-on-failure`, et toute console error/pageerror/hydration warning/request failure/API ARIA 5xx inattendue échoue. Seule la requête SSE dont URL, turnId et generation token correspondent exactement à un Stop/close/course-change déclenché par le test peut finir en `net::ERR_ABORTED` : l'attente est enregistrée avant l'action et consommée une fois ; tout autre `requestfailed` échoue. Un script GitHub calcule les threads non résolus et vérifie que les reviews Codex/security portent le `headRefOid` exact.

**MIGRATION IMPACT**

Aucune nouvelle DB ; M1/backfills sont vérifiés sur DB jetable et clone anonymisé avant rollout.

**SECURITY IMPACT**

Gates bloquent direct provider/Prisma/RAG/prompt imports, raw errors, student injection, writes legacy et silent catches correctness-relevant.

**PEDAGOGICAL IMPACT**

Golden set couvre exactitude, grounding, niveau, intervention/hints, retenue de notation, STMG et injection ; correction complète reste ARIA-G avant activation.

**REGRESSION TESTS**

- [ ] Les cinq tests threads sont verts : widget fallback, history/backfill, newest history budget, hasChat=false, cancel=CANCELLED.
- [ ] Tous les IDs atomiques de la matrice ci-dessous, les 26 scénarios E2E et les 19 goldens sont verts ; le gate compare le registre aux IDs réellement découverts.

**EXIT CRITERIA**

Tous gates locaux/CI verts, nouveau HEAD poussé, fresh Codex + security review sans finding réel, cinq threads prouvés/résolus, aucun approval humain demandé encore.

## Chunk 3 — Migrations, inventaires de régression et commandes initiales

## 17. Migration, backfill et rollback

### Bindings des cinq threads ouverts

- `THREAD_WIDGET_COURSE_FALLBACK` (`ARIA-B-R008`) dans `__tests__/components/aria/chat-panel.test.tsx` : sans course disponible, aucun fallback/default et aucun POST ; RED avant C15.
- `THREAD_LEGACY_HISTORY_NULL_COURSE` (`ARIA-B-R014`…`R018`) dans `__tests__/db/aria-course-backfill.real.test.ts` : null ambigu classé non reprenable, jamais Maths ; RED avant C06.
- `THREAD_HISTORY_NEWEST_MESSAGES` (`ARIA-B-R019`/`R020`) dans `__tests__/db/aria-history-window.real.test.ts` : fixture 15, dix plus récents sous budget puis ordre chrono ; RED avant C09.
- `THREAD_NO_CHAT_REACHES_MODEL` (`ARIA-B-R031`) dans `__tests__/integration/aria-application.test.ts` : `hasChat=false`, provider count zéro ; RED avant C07.
- `THREAD_CANCEL_PERSISTED_ERROR` (`ARIA-B-R066`) dans `__tests__/db/aria-turn-cancel.real.test.ts` : RUNNING→CANCELLED, jamais ERROR ; RED avant C11.

Chaque thread reste ouvert jusqu'au test nommé vert sur le HEAD poussé ; la réponse GitHub cite ID, commande, artifact et SHA exact avant résolution.

### M1 — expand dans PR #200

`aria_turn_lifecycle_expand` est additive : tables Turn, scope et audit de migration, relations nullable legacy, contraintes/index actifs, outbox type, citation identities, préférences v1 et context state. Pour un message lié à un Turn, un trigger DB projette uniquement `Turn.status → AriaMessage.status` et empêche sa mutation indépendante. Avant drainage, l'ancien binaire peut encore écrire seulement ses messages legacy `turnId IS NULL`; les backfills de liaison attendent le drainage prouvé. `AriaMessage.feedback` n'est jamais projeté/écrit par le nouveau binaire : les reads dérivent depuis `AriaFeedback`. Les nouvelles writes sont strictes ; les anciennes lignes restent lisibles.

### Backfills opérationnels

1. `conversation-context` après C06 : vérifier les courseKeys existants ; résoudre les nulls uniquement par resource/skill/candidat académique unique ; sinon `LEGACY_CONTEXT_UNRESOLVED`.
2. `conversation-turns` après C06 et drainage des anciens writers : importer le lifecycle historique vers des Turns terminaux.
3. `entitlements` après C07 : convertir Subscription/feature/course/STMG/global en Entitlement canonique + `AriaEntitlementScope`, comparer décisions legacy/canonique et basculer seulement à équivalence.
4. `feedback-profile` après C14 : booléen vers AriaFeedback ; selectedCourseKeys vers préférence uniquement si intention prouvée.

Chaque script possède `--audit`, `--apply`, `--verify`, idempotence, reprise et sortie agrégée sans PII. `AriaDataMigrationRun/RowAudit` persistent digest, classification, target refs et before-images allowlistées ; ils permettent reprise, rollback CAS et distinction M2 entre archive autorisée et donnée simplement oubliée.

Commande de preuve locale unique : `npm run test:aria:backfills`; le wrapper démarre la cible jetable, exporte les URLs validées, charge la fixture, appelle successivement `aria:backfills -- --audit`, `--apply`, `--verify`, puis teardown. La production exige une autorisation de déploiement séparée.

### M2 — contract, vague ultérieure distincte

Créer seulement après soak M1 + nouveau binaire + rapports zéro legacy actif. Guard SQL : **zéro conversation runtime `LEGACY_CONTEXT_UNRESOLVED` ou courseKey null** ; chaque historique non reprenable/null/unlinked doit avoir un `AriaDataMigrationRowAudit` APPROVED dont sourceFingerprint correspond encore, sinon blocker ; zéro assistant runtime sans Turn, paire runtime incomplète, Turn actif sans lease/watchdog, divergence/projection ou write legacy. Alors seulement valider les CHECK, rendre courseKey non-null pour le périmètre runtime et supprimer `AriaMessage.status`, `AriaMessage.feedback`, `AriaConversation.subject`/fallback projection. Ne jamais inclure M1 et M2 dans le même déploiement de production.

### Rollback

- Après M1 mais avant drainage/cutover et avant tout message lié : l'ancien binaire ignore l'expand et peut être redéployé.
- Dès drainage/cutover ou première liaison de message : **aucun rollback vers `1149572`**, même avant trafic externe ; kill-switch génération, recovery actif et fix-forward.
- Après le premier Turn runtime : **aucun rollback vers `1149572`**. Activer le kill-switch des nouvelles générations, maintenir le recovery worker actif et fix-forward ; ne jamais réactiver l'ancien writer Message.
- Après M2 : fix-forward ou restauration DB validée ; aucune down migration destructive automatique.
- RAG : Nexus revient d'abord au lock N-1 ; RAG conserve manifest/corpus/binding N-1 pendant la fenêtre. Digest absent = fail closed.

## 18. Tests de régression atomiques planifiés — 99

Chaque nom de test porte son ID. `aria:integrity` compare cet exact-set aux IDs découverts ; un ID absent, dupliqué ou non enregistré échoue. `ARIA-B-R001`…`ARIA-B-R006` et `ARIA-B-R014`…`ARIA-B-R018` sont `BACKFILL_ONLY` et ne justifient aucun adapter subject runtime.

1. `ARIA-B-R001` Première Maths + grade explicite ; 2. `ARIA-B-R002` Terminale Maths explicite ; 3. `ARIA-B-R003` Seconde Maths comportement explicite ; 4. `ARIA-B-R004` legacy subject unsupported ; 5. `ARIA-B-R005` aucun default grade ; 6. `ARIA-B-R006` null legacySubject ne devient pas Maths ; 7. `ARIA-B-R007` JSON course sans legacySubject ne devient pas Maths ; 8. `ARIA-B-R008` widget sans fallback Terminale ; 9. `ARIA-B-R009` chat subject rejeté ; 10. `ARIA-B-R010` history subject rejeté.

11. `ARIA-B-R011` conversation course mismatch ; 12. `ARIA-B-R012` conversation student mismatch ; 13. `ARIA-B-R013` unknown conversation ; 14. `ARIA-B-R014` backfill par resourceVersion exact ; 15. `ARIA-B-R015` backfill par skill exact ; 16. `ARIA-B-R016` backfill candidat académique unique ; 17. `ARIA-B-R017` backfill ambigu quarantiné ; 18. `ARIA-B-R018` courseKey existant invalide signalé ; 19. `ARIA-B-R019` 15+ messages les plus récents sous budget ; 20. `ARIA-B-R020` ordre prompt chronologique.

21. `ARIA-B-R021` historique complet paginé ; 22. `ARIA-B-R022` timestamps égaux sans perte/doublon ; 23. `ARIA-B-R023` cross-course skill ; 24. `ARIA-B-R024` cross-course resource ; 25. `ARIA-B-R025` personal resource wrong owner ; 26. `ARIA-B-R026` feature entitlement migré ; 27. `ARIA-B-R027` course scope entitlement ; 28. `ARIA-B-R028` STMG explicite ; 29. `ARIA-B-R029` global entitlement ; 30. `ARIA-B-R030` academic relevant non entitled.

31. `ARIA-B-R031` hasChat=false modèle=0 ; 32. `ARIA-B-R032` pin/focus/order ne gate pas ; 33. `ARIA-B-R033` SETUP_REQUIRED réel seulement ; 34. `ARIA-B-R034` RAG NOT_CONFIGURED ; 35. `ARIA-B-R035` RAG NO_RESULTS ; 36. `ARIA-B-R036` RAG RUNTIME_UNAVAILABLE required ; 37. `ARIA-B-R037` OPTIONAL general chat explicite ; 38. `ARIA-B-R038` RESOURCE_GROUNDED_REQUIRED ; 39. `ARIA-B-R039` manifestSha256 mismatch ; 40. `ARIA-B-R040` citation identity/hash mismatch.

41. `ARIA-B-R041` réponse RAG hors manifeste ; 42. `ARIA-B-R042` scope académique non représentable ; 43. `ARIA-B-R043` provider timeout ; 44. `ARIA-B-R044` user cancellation ; 45. `ARIA-B-R045` provider unavailable ; 46. `ARIA-B-R046` provider config missing ; 47. `ARIA-B-R047` fallback capability-equivalent seulement ; 48. `ARIA-B-R048` public redaction path/endpoint ; 49. `ARIA-B-R049` public redaction email/provider payload ; 50. `ARIA-B-R050` unknown write field.

51. `ARIA-B-R051` studentId injection ; 52. `ARIA-B-R052` gradeLevel injection ; 53. `ARIA-B-R053` academicTrack injection ; 54. `ARIA-B-R054` entitlement injection ; 55. `ARIA-B-R055` clientRequestId absent ; 56. `ARIA-B-R056` clientRequestId non-UUID ; 57. `ARIA-B-R057` même ID → model count 1 ; 58. `ARIA-B-R058` même ID/fingerprint différent ; 59. `ARIA-B-R059` autre ID conversation busy ; 60. `ARIA-B-R060` deux créations de conversation même ID.

61. `ARIA-B-R061` rollback TX1 après write partielle ; 62. `ARIA-B-R062` rollback TX2 sur citation ; 63. `ARIA-B-R063` CAS finalization winner unique ; 64. `ARIA-B-R064` stale executionToken refusé ; 65. `ARIA-B-R065` aucun réseau en transaction ; 66. `ARIA-B-R066` cancel explicite persisté CANCELLED ; 67. `ARIA-B-R067` déconnexion SSE ne cancel pas ; 68. `ARIA-B-R068` feedback duplicate/idempotent ; 69. `ARIA-B-R069` feedback DB error visible ; 70. `ARIA-B-R070` deux upserts feedback identiques concurrents → une ligne.

71. `ARIA-B-R071` terminalization DB error récupérable ; 72. `ARIA-B-R072` stale RUNNING recovery autonome ; 73. `ARIA-B-R073` stale PENDING recovery autonome ; 74. `ARIA-B-R074` heartbeat concurrent au claim ; 75. `ARIA-B-R075` watchdog au seuil reste retryable ; 76. `ARIA-B-R076` SSE JSON invalide ; 77. `ARIA-B-R077` SSE wrong payload shape ; 78. `ARIA-B-R078` SSE unknown event ; 79. `ARIA-B-R079` SSE UTF-8 fragmenté ; 80. `ARIA-B-R080` SSE event fragmenté.

81. `ARIA-B-R081` SSE multiple events/chunk ; 82. `ARIA-B-R082` SSE CRLF ; 83. `ARIA-B-R083` SSE heartbeat explicite ; 84. `ARIA-B-R084` SSE final decoder flush ; 85. `ARIA-B-R085` SSE parser abort ; 86. `ARIA-B-R086` Content-Type SSE validé ; 87. `ARIA-B-R087` exactement un terminal après start ; 88. `ARIA-B-R088` erreur pre-stream HTTP versus post-start event ; 89. `ARIA-B-R089` parité résultat/metadata JSON–SSE ; 90. `ARIA-B-R090` cancel endpoint strict/ownership.

91. `ARIA-B-R091` public BAD_REQUEST ; 92. `ARIA-B-R092` public COURSE_NOT_FOUND ; 93. `ARIA-B-R093` public NOT_ENROLLED ; 94. `ARIA-B-R094` public NOT_ENTITLED ; 95. `ARIA-B-R095` public UNSUPPORTED ; 96. `ARIA-B-R096` public CONVERSATION_NOT_FOUND, tous HTTP JSON pré-stream uniquement ; 97. `ARIA-B-R097` RAG_UNAVAILABLE ; 98. `ARIA-B-R098` MODEL_UNAVAILABLE ; 99. `ARIA-B-R099` INTERNAL_ERROR, vérifiés en JSON et en terminal SSE seulement lorsque leur phase l'autorise. R058/R059 couvrent les deux 409.

## 19. E2E planifiés — 26

Les IDs `E001`…`E026` de la matrice de qualification couvrent les six personas, login/chat, cours, contexte profond/citation, history/reload, retry, concurrence, cancel, feedback, RAG/timeout, accès cross-student/cross-course, page publique et qualité runtime. Les viewports exacts sont 390×844, 768×1024, 1366×768 et 1440×900. Aucun E2E ARIA n'utilise `page.route()` pour remplacer le backend, assertion permissive, skip, persona mutable partagé ou dépendance externe non provisionnée.

## 20. Tests d'architecture planifiés — 12

1. Routes/components → barrels applicatifs publics seulement.
2. SDK provider → gateway seulement.
3. Prisma writes → repositories propriétaires seulement.
4. Turn lifecycle et feedback legacy non modifiables ; aucune catch silencieuse correctness-relevant.
5. Une source capability/resource/corpus ; aucun binding physique Nexus hors snapshot généré/adaptor.
6. Un moteur frontend et un parser SSE ; reachability/orphans prouvés.
7. Core courseKey obligatoire ; schémas stricts ; aucune injection student/subject/grade.
8. Docs, coverage séparée, manifests, golden set et commandes restent versionnés/cohérents.
9. Registre requirement→evidence exhaustif et zéro skip/todo/focus/quarantaine/ignore ARIA.
10. Reachability AST/runtime build : dead/orphan/zombie/chat engine/parser zéro.
11. Aucun catalogue de cours, default grade/course ou adapter subject runtime.
12. Privacy/telemetry/performance budgets restent dans leurs ports et configs canoniques.

## 21. Commandes exactes de validation finale

### Baseline et Prisma

```bash
git merge-base --is-ancestor 1149572f5bf85b43bc10c870cb4fd81b336f7f56 HEAD
npx prisma validate
npx prisma generate
```

### Targeted unit

```bash
npm run test:unit -- --runInBand __tests__/lib/aria __tests__/components/aria
```

### API

```bash
npm run test:unit -- --runInBand __tests__/api/aria.chat.route.test.ts __tests__/api/aria.conversations.route.test.ts __tests__/api/aria.curriculum.route.test.ts __tests__/api/aria.feedback.route.test.ts __tests__/api/aria.profile.route.test.ts __tests__/api/aria.resources.route.test.ts
```

### Integration

```bash
npm run test:integration:disposable -- __tests__/integration/aria-rag-contract.test.ts __tests__/integration/aria-application.test.ts
```

### Real DB

```bash
npm run test:aria:db
npm run test:aria:backfills
```

### E2E

```bash
npm run test:aria:e2e:desktop
npm run test:aria:e2e:mobile
npm run test:aria:a11y
npm run test:e2e:ephemeral
```

### Static/build/integrity

```bash
npm run typecheck
npm run lint
npm run build
npm run aria:manifest:check
npm run aria:manifest:runtime-check
npm run aria:coverage:check
npm run aria:evaluate:check
npm run aria:evaluate -- --mode fixture
npm run aria:integrity
npm run test:aria:architecture
```

### Full local matrix

```bash
npm run test:unit -- --runInBand
npm run test:integration:disposable
npm run test:aria:db
npm run test:e2e:ephemeral
npm run verify
```

### RAG companion

```bash
ARIA_NEXUS_WORKTREE="$(git rev-parse --show-toplevel)"
: "${ARIA_RAG_WORKTREE:?Set ARIA_RAG_WORKTREE to the clean companion worktree}"
: "${ARIA_RAG_PR_NUMBER:?Set ARIA_RAG_PR_NUMBER to the companion PR}"
test -z "$(git -C "$ARIA_RAG_WORKTREE" status --porcelain)"
git -C "$ARIA_RAG_WORKTREE" merge-base --is-ancestor ffc1bae31e57a23e0e9dca7c4a7da66270c24552 HEAD
ARIA_RAG_EXPECTED_SHA="$(jq -r '.producer.commit' data/aria/rag/servable-corpus-index.lock.json)"
test "$(git -C "$ARIA_RAG_WORKTREE" rev-parse HEAD)" = "$ARIA_RAG_EXPECTED_SHA"
(
cd "$ARIA_RAG_WORKTREE"
ARIA_RAG_REPOSITORY="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"; test "$(gh pr view "$ARIA_RAG_PR_NUMBER" --repo "$ARIA_RAG_REPOSITORY" --json headRefOid --jq .headRefOid)" = "$ARIA_RAG_EXPECTED_SHA"
python -m pytest packages/contracts/tests/test_servable_corpus_manifest.py packages/contracts/tests/test_schema_export.py -q
python packages/contracts/scripts/export_schemas.py --output packages/contracts/schema --check
make -C services/rag-engine lint
make -C services/rag-engine typecheck
make -C services/rag-engine test
gh pr checks "$ARIA_RAG_PR_NUMBER" --repo "$ARIA_RAG_REPOSITORY" --watch --fail-fast=false
)
```

### GitHub, fresh Codex reviews et CI

```bash
cd "$ARIA_NEXUS_WORKTREE"; test -z "$(git status --porcelain)"
FINAL_HEAD="$(git rev-parse HEAD)"
git push origin "$FINAL_HEAD:$(git branch --show-current)"
test "$(gh pr view 200 --json headRefOid --jq .headRefOid)" = "$FINAL_HEAD"
gh pr comment 200 --body '@codex review'
gh pr comment 200 --body '@codex security review'
gh pr checks 200 --watch --fail-fast=false
npm run aria:review-gate -- --pr 200 --head "$FINAL_HEAD" --require-codex --require-security --open-threads 0 --wait --timeout 1800
```

Après les réponses Codex, relancer `gh pr view 200 --json headRefOid` et vérifier que chaque revue cible exactement ce SHA. Répondre/résoudre chaque thread seulement avec le nom du test vert et son evidence CI. Ne demander `abenrhouma`/`adammeg` qu'après ces gates et uniquement sur le HEAD final.

## 22. Résumé de plan

```text
IMPLEMENTATION_PLAN_VERSION=ARIA_B_TDD_V2_QUALIFICATION
BASELINE_SHA=1149572f5bf85b43bc10c870cb4fd81b336f7f56
PLANNED_COMMITS=19_TOTAL_15_NEXUS_4_RAG
PLANNED_MIGRATIONS=2_WAVES_M1_EXPAND_IN_PR200_M2_POST_ROLLOUT_CONTRACT
PLANNED_BACKFILLS=4
PLANNED_ARCHITECTURE_TESTS=12
LEGACY_REGRESSION_IDS=99_NOT_A_QUALIFICATION_METRIC
PLANNED_E2E=26
CRITICAL_REQUIREMENTS=64
CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=0
OPEN_PRODUCT_DECISIONS=0
```

`OPEN_PRODUCT_DECISIONS=0` concerne le scope PR #200 : ses contrats sont décidés. Les décisions de modèle explicitement affectées à ARIA-C/D/E/F/G restent différées à leurs lots et ne doivent pas être implémentées ou approximées dans #200.

## Chunk 4 — Qualification exhaustive requirement → evidence

## 23. Registre de preuves planifié

Le nombre de tests n'est jamais une preuve d'exhaustivité. La matrice §24 est l'autorité : `scripts/aria/check-test-traceability.ts` comparera ses 64 requirements à `data/aria/testing/aria-b-evidence.v1.json`, aux noms de tests découverts et aux rapports JUnit/Playwright. Un ID absent, non exécuté, dupliqué ou sans résultat attendu fait échouer `aria:test-plan:check`.

Les compteurs ci-dessous désignent des **cas nommés atomiques**, pas des assertions ni des variants cachés :

```text
PLANNED_UNIT=64
PLANNED_API=20
PLANNED_INTEGRATION=24
PLANNED_REAL_DB=20
PLANNED_ARCHITECTURE=12
PLANNED_E2E=26
PLANNED_PEDAGOGICAL_GOLDEN_CASES=19
```

### 23.1 Unit cases `U001`–`U064`

- `U001`–`U010`, `__tests__/lib/aria/{actor-subject,context,access}.test.ts` : forged target, cross-student, cross-course, unknown/unsupported, no/course/global/stale entitlement, invalid Academic Map.
- `U011`–`U015`, `__tests__/lib/aria/context.test.ts` : skill correct/wrong, resource correct/wrong, personal owner future-safe.
- `U016`–`U025`, `__tests__/lib/aria/{turn-state,reserve-turn,run-conversation}.test.ts` : new/resume/unknown/nullable legacy, legal terminal states, every forbidden terminal transition, competing finalizers, cancel distinct from error.
- `U026`–`U030`, `__tests__/lib/aria/{history-budget,run-conversation}.test.ts` : latest suffix, chronological order, equal timestamps, deterministic budget, retry-after-disconnect.
- `U031`–`U041`, `__tests__/lib/aria/{retrieval-policy,rag-manifest,run-conversation}.test.ts` : SUCCESS, NO_RESULTS, NOT_CONFIGURED, RUNTIME_UNAVAILABLE, RAG timeout, invalid manifest, version mismatch, missing ResourceVersion, optional/required grounding, NO_CHAT.
- `U042`–`U048`, `__tests__/lib/aria/{gateway,model-policy}.test.ts` : config, unavailable, timeout, cancellation, capability mismatch, authorized fallback, no silent fallback.
- `U049`–`U057`, `__tests__/lib/aria/sse.test.ts` : event/UTF-8 fragmentation, multi-event, JSON/payload malformed, unknown event, flush, mid-stream error, abort.
- `U058`–`U064`, `__tests__/lib/aria/{public-errors,feedback,telemetry,performance-budget}.test.ts` : public mapping/redaction client+log, feedback ownership/idempotence/DB propagation, telemetry sans PII et budgets déterministes.

### 23.2 API cases `A001`–`A020`

Chaque ID correspond à un test nommé (les variantes d'une table restent visibles dans le reporter) : `A001` auth envelope + forged subject ; `A002` unknown course ; `A003` unsupported/`hasChat=false`; `A004` no entitlement ; `A005` explicit course entitlement ; `A006` global entitlement avec academic guard ; `A007` stale entitlement ; `A008` invalid map/curriculum overlay ; `A009` conversation/skill/resource owner-course-version guard ; `A010` unknown conversation no-create ; `A011` chat strict unknown/student/grade/track/entitlement injection ; `A012` profile strict preferences ; `A013` new/same-key replay ou 202 même Turn ; `A014` idempotency fingerprint conflict ; `A015` conversation busy ; `A016` cancel owner + matching clientRequestId ; `A017` feedback owner/upsert ; `A018` history courseKey/cursor ; `A019` public code/status/phase + SSE error envelope ; `A020` rate/message/payload bounds. Fichiers : `__tests__/api/aria.{auth,write-contracts,chat,conversations,curriculum,feedback,profile,resources}.route.test.ts`.

### 23.3 Integration cases `I001`–`I024`

Chaque ID correspond à un test nommé : `I001` pipeline unique/new ; `I002` resume exact ; `I003` retry disconnect/idempotency ; `I004` NO_CHAT model=0 ; `I005` requested+stored authorized context ; `I006` RAG SUCCESS ; `I007` NO_RESULTS ; `I008` NOT_CONFIGURED ; `I009` RUNTIME_UNAVAILABLE ; `I010` RAG TIMEOUT ; `I011` invalid manifest/version ; `I012` missing/mismatched ResourceVersion ; `I013` OPTIONAL_GROUNDING ; `I014` GROUNDED_REQUIRED ; `I015` STMG NO_CHAT/non-approximation ; `I016` model configuration/provider unavailable ; `I017` model timeout/cancel/authorized fallback ; `I018` JSON/SSE parity/runtime schemas ; `I019` CAS finalization/core DB failure ; `I020` feedback/profile persistence + secondary warning ; `I021` prompt/RAG injection and output sanitation ; `I022` telemetry/public+server redaction ; `I023` query/TTFT/latency/buffer/write budgets ; `I024` cross-repo contract/eval fingerprint compatibility. Fichiers : `__tests__/integration/aria-{application,rag-contract,model-gateway,persistence,security,observability,performance}.test.ts`.

### 23.4 Real PostgreSQL cases `D001`–`D020`

- `D001` same clientRequestId concurrent ; `D002` two independent Turns same conversation ; `D003` two finalizers ; `D004` TX1 rollback ; `D005` TX2 citation rollback.
- `D006` unknown conversation no-create ; `D007` composite owner/course/Turn FKs ; `D008` latest history ; `D009` keyset tie ; `D010` persisted skill/resource/version/owner disagreement.
- `D011` stale heartbeat ; `D012` scheduler without next request ; `D013` no permanent RUNNING ; `D014` cancel/worker/heartbeat/finalizer races (`THREAD_CANCEL_PERSISTED_ERROR`) ; `D015` feedback concurrent upsert.
- `D016` M1 replay empty+legacy ; `D017` conversation-context/turn backfill exact counts ; `D018` entitlement mapping/concurrent rerun ; `D019` feedback/profile conflict/rerun ; `D020` M2 readiness blocks dirty data then passes clean fixture.

Fichiers : `__tests__/db/aria-{turn-reservation,turn-finalization,turn-cancel,turn-recovery,history-window,conversation-context-integrity,legacy-backfills,entitlement-backfill,feedback-profile-backfill,contract-readiness}.real.test.ts` et `__tests__/concurrency/aria-{turn-concurrency,turn-terminal-races,feedback-concurrency}.real.test.ts`. Tous passent exclusivement par le wrapper PostgreSQL jetable serial.

### 23.5 Architecture cases `H001`–`H012`

Application boundary ; provider boundary ; persistence owners ; lifecycle/feedback SSoT ; manifest/resource/corpus SSoT ; frontend engine/SSE parser ; strict courseKey/contracts ; docs/academic coverage ; test-config/traceability/zero-skip ; reachability/dead/orphan ; hardcoded/default/legacy callers ; privacy/telemetry/performance boundaries.

### 23.6 E2E cases `E001`–`E026`

1. Terminale Maths login→chat ; 2. Première Maths ; 3. NSI ; 4. STMG `hasChat=false` ; 5. profil incomplet ; 6. cours non entitled ; 7. course switching ; 8. skill/resource deep context + citation ; 9. history/reload ; 10. retry disconnect same ID ; 11. busy 409 ; 12. cancel ; 13. feedback ; 14. RAG unavailable ; 15. model timeout ; 16. forged cross-student ; 17. cross-course conversation ; 18. 390×844 ; 19. 768×1024 ; 20. 1366×768 ; 21. 1440×900 ; 22. keyboard/focus/live announcements ; 23. Markdown/XSS/exfiltration ; 24. 500 deltas/late events/Stop responsiveness ; 25. zero console/pageerror/hydration/network errors ; 26. public static demo sans appel chat.

Les personas `ariaTerminaleMaths`, `ariaPremiereMaths`, `ariaNsi`, `ariaStmgNoChat`, `ariaIncompleteProfile`, `ariaNotEntitled` sont seedés et immuables. Les quatre viewports vérifient overflow, composer, cours, streaming, stop, timeout, RAG unavailable, citations, reload, feedback, clavier, focus, annonces screen-reader, console et hydratation.

### 23.7 Golden pédagogique `P001`–`P019`

`data/aria/evaluation/conversation-policy.v1.{schema.json,jsonl,review.json}` et `__tests__/integration/aria-pedagogical-golden.test.ts` portent des cas stricts et revus : `P001` guided hint ; `P002` concept explanation ; `P003` methodology ; `P004` réponse directe sans tentative ; `P005` tentative fournie/check-my-work ; `P006` question programme groundée ; `P007` STMG sans approximation ; `P008` worked example ; `P009` resource-grounded ; `P010` required NO_RESULTS ; `P011` required unavailable ; `P012` optional NO_RESULTS ; `P013` optional unavailable ; `P014` injection utilisateur ; `P015` injection document RAG ; `P016` safety mineur ; `P017` hallucination hors source ; `P018` candidat libre non représentable ; `P019` langue obligatoire non représentable. Fixture provider déterministe : policies distinctes, aucune règle safety universelle « never full answer », citation supportée, cours/niveau exacts et aucune approximation STMG→SES. Le futur `aria:evaluate --mode provider` reste un gate modèle réel séparé.

### 23.8 Production smoke cases `S001`–`S010`

Chaque smoke est non destructif et attaché au HEAD/artifact exact : `S001` chat product fixture/transport ; `S002` curriculum + build/reachability ; `S003` auth/academic/entitlement fail-closed ; `S004` Resource Registry/RAG index N/N-1/digest ; `S005` Turn schema/reservation/finalization ; `S006` watchdog/telemetry terminal states ; `S007` DB query/history/performance budgets ; `S008` public et server error redaction ; `S009` feedback/profile read-write fixture ; `S010` quatre viewports/a11y/console/hydration. Le smoke production artifact n'appelle ni provider public ni donnée réelle d'élève et n'écrit pas en production.

## 24. Matrice exhaustive requirement → test

`N/A` n'est accepté qu'avec la preuve alternative indiquée. Les tests négatifs sont des IDs nommés, jamais une assertion implicite dans un happy path.

| REQUIREMENT_ID | REQUIREMENT | RISK | UNIT_TEST | API_TEST | INTEGRATION_TEST | REAL_DB_TEST | E2E_TEST | ARCHITECTURE_TEST | NEGATIVE_TEST | PRODUCTION_SMOKE | EXPECTED_RESULT |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CR-001 | Une façade/pipeline conversationnel | P0 double génération | U016 | A013 | I001 | D003 | E001 | H001 | H001 direct import | S001 | génération/retrieval/prompt/persistence = 1 |
| CR-002 | Core courseKey, zéro subject/default | P0 mauvais cours | U004/U005 | A002/A003 | I001 | D006 | E004 | H007/H011 | R001–R010 | S002 | aucun grade/course implicite |
| CR-003 | Actor/subject=self, cible forgée refusée | P0 fuite mineur | U001 | A001 | I005 | D007 | E016 | H007 | forged studentId | S003 | cible client impossible |
| CR-004 | Academic Map valide et cours suivi | P0 contexte faux | U010 | A008 | I005 | D007 | E005 | H008 | map invalide/academic irrelevant | S003 | fail closed |
| CR-005 | Cours connu/supporté/hasChat | P0 model interdit | U004/U005 | A002/A003 | I004/I015 | N/A: manifest+I | E004 | H005/H011 | hasChat=false model=0 | S002 | UNSUPPORTED, zéro modèle |
| CR-006 | Entitlement générique + scopes/date | P0 bypass commercial | U006–U009 | A004–A007 | I005 | D018 | E006 | H001 | stale/global sans academic | S003 | un builder, union sources valides |
| CR-007 | Conversation owner/course/not-found | P0 cross-student | U002/U003/U018 | A009/A010 | I002 | D006/D007 | E016/E017 | H003 | unknown ne crée rien | S003 | reprise exacte seulement |
| CR-008 | Skill course exact demandé/persisté | P0 prompt contaminé | U011/U012 | A009 | I005 | D010 | E008 | H007 | stored/request mismatch | S003 | mismatch rejeté |
| CR-009 | Resource version/course/owner/visibility | P0 fuite document | U013–U015 | A009 | I005/I012 | D010 | E008 | H005 | stale/wrong owner/version | S004 | version canonique seule |
| CR-010 | Mutations strictes + message borné | P0 injection/DoS | U001 | A011/A012/A020 | I021 | N/A: route schemas | E016 | H007 | unknown/student/grade/entitlement | S003 | 400/413 stable |
| CR-011 | Turn.status lifecycle SSoT | P0 état divergent | U020–U025 | A016 | I001 | D003/D005 | E012 | H004 | writers Message interdits | S005 | une source lifecycle |
| CR-012 | Idempotency même key = un provider | P0 double coût | U026 | A013/A014 | I003 | D001 | E010 | H007 | fingerprint différent 409 | S005 | model count=1 |
| CR-013 | Un Turn actif/conversation | P0 réponses interlacées | U024 | A015 | I001 | D002 | E011 | H004 | deux keys concurrentes | S005 | un gagnant, 409 |
| CR-014 | Transactions courtes, aucun réseau | P0 locks | U064 | N/A: infra | I023 | D004/D005 | E024 | H003/H012 | adapter réseau dans TX | S006 | TX fermées avant I/O |
| CR-015 | Finalisation CAS atomique | P0 double terminal | U021–U024 | A016 | I019 | D003/D005 | E012 | H004 | stale token/citation fail | S005 | un finalizer gagne |
| CR-016 | Cancel explicite, disconnect ≠ cancel | P0 état ERROR faux | U025/U030 | A016 | I003/I017 | D014 | E010/E012 | H004 | cancel/finalize race | S005 | CANCELLED ou replay |
| CR-017 | Recovery autonome | P0 RUNNING permanent | U064 | N/A: worker | I020 | D011–D014 | E015 | H003/H012 | aucun next request | S006 | stale devient terminal |
| CR-018 | History prompt récent/budgeté | P1 réponse hors contexte | U026–U029 | A018 | I002 | D008 | E009 | H007 | ancien ASC+take | S007 | suffixe récent chrono |
| CR-019 | History complet/keyset stable | P1 perte/doublon | U028 | A018 | I002 | D009 | E009 | H007 | timestamps égaux | S007 | aucune perte/doublon |
| CR-020 | Retrieval résolu task/course/resource/role | P0 downgrade | U031–U041 | A003 | I006–I015 | N/A: policy pure+I | E008 | H005 | course-only resolver | S004 | plan versionné exact |
| CR-021 | États RAG distincts, downgrade explicite | P0 hallucination | U031–U034 | A019 | I006–I009/I013 | N/A: metadata DB D005 | E014 | H005 | required unavailable model=0 | S004 | statut persisté/visible |
| CR-022 | RAG timeout observable | P0 hang | U035 | A019 | I010 | N/A: fixture network | E014 | H012 | timeout ≠ no-results | S004 | RAG_UNAVAILABLE typé |
| CR-023 | Resource→Version/hash→manifest→citation | P0 fausse source | U036–U038 | A019 | I011/I012 | D010 | E008 | H005 | citation/hash hors manifest | S004 | chaîne immutable exacte |
| CR-024 | Contrat RAG cross-repo/digest/order | P0 registries divergents | U036/U037 | N/A: BFF internal | I024 | N/A: deux repos/CI | E008 | H005 | digest/version incompatible | S004 | fail closed, RAG puis Nexus |
| CR-025 | Provider config explicite | P0 faux credential | U042 | A019 | I016 | N/A: config | E015 | H002 | hosted/local incomplet | S008 | INTERNAL sûr, aucun call |
| CR-026 | Timeout/cancel/unavailable modèle | P0 hang/erreur brute | U043–U045 | A019 | I016/I017 | N/A: fixture provider | E012/E015 | H002 | abort-vs-timeout race | S008 | cause interne distincte |
| CR-027 | Capability model/fallback contrôlé | P0 modèle inadéquat | U046–U048 | N/A: server policy | I017 | N/A: policy | E015 | H002 | fallback non équivalent | S008 | aucun downgrade silencieux |
| CR-028 | Codes/status/phases publics stables | P0 contrat cassé | U058 | A019 | I018 | N/A: serializer | E014/E015 | H007 | pre-stream encodé SSE | S001 | matrice ARIA_V1 respectée |
| CR-029 | Redaction client + logs | P0 PII/secrets | U058 | A019 | I022 | N/A: logger capture | E025 | H012 | path/email/account/key/stack | S008 | détail absent, requestId présent |
| CR-030 | Un parser SSE + validation runtime | P0 protocole divergent | U049–U057 | A019 | I018 | N/A: parser pure | E024 | H006 | JSON/shape/event malformé | S001 | erreur protocol typée |
| CR-031 | Stream terminal/parité/abort | P0 stream incohérent | U049–U057 | A013/A019 | I018 | D005 | E010/E012/E024 | H006 | late/duplicate terminal | S001 | un terminal post-commit |
| CR-032 | AriaFeedback SSoT/idempotent | P0 double vérité | U060/U061 | A017 | I020 | D015/D019 | E013 | H004 | legacy write/cross-owner | S009 | une ligne canonique |
| CR-033 | DB failures visibles + warnings secondaires | P0 succès mensonger | U062 | A017 | I020 | D005/D015 | E013 | H003/H004 | silent catch/badge PII | S006 | core fail, badge warn structuré |
| CR-034 | Profil pin/focus/order non-gating | P1 cours masqué | U029 | A012 | I005 | D019 | E005/E007 | H007 | selected→pins ambigu | S003 | Academic Map reste vérité |
| CR-035 | Un moteur frontend/cours dynamiques | P0 UX divergente | U063 | A008 | I001 | N/A: frontend+H | E001/E007/E026 | H006/H010/H011 | six-course/default subject | S002 | panel unique, launcher thin |
| CR-036 | UI stream/stop/history/citation/feedback | P1 parcours cassé | U063 | A013/A016/A018 | I018 | N/A: covered API+E2E | E007–E015 | H006 | late event/feedback avant 2xx | S001 | flows déterministes |
| CR-037 | Quatre viewports sans overflow | P1 mobile inutilisable | U063 | N/A: UI | N/A: E2E viewport | N/A: E2E | E018–E021 | H006 | faible hauteur/safe area | S010 | composer accessible |
| CR-038 | Clavier/focus/annonces/a11y | P0 accessibilité | U063 | N/A: UI | N/A: axe/E2E | N/A: E2E | E018–E022 | H006 | focus perdu/live spam | S010 | axe 0 violation serious/critical |
| CR-039 | Zéro console/hydration/network error | P1 défaut runtime | U063 | N/A: UI | N/A: E2E | N/A: E2E | E025 | H006 | permissive fallback | S010 | toute erreur échoue |
| CR-040 | Global safety ≠ task pedagogy | P0 pédagogie fausse | U064 | N/A: policy server | I021/P001–P005/P008 | N/A: fixture | E001 | H001 | never-answer global | S001 | policies composables |
| CR-041 | Golden conversation #200 | P0 qualité non testée | U064 | N/A: fixture | P001–P019 | N/A: deterministic fixture | E001/E008 | H008 | citation/niveau/policy incorrect | S001 | 19 rubrics passent |
| CR-042 | Aucun STMG→SES | P0 approximation programme | U040 | A003 | I015/P007 | N/A: fixture | E004 | H005/H008 | corpus/policy SES | S004 | fail closed ou exact STMG |
| CR-043 | Chat brut STUDENT_PRIVATE | P0 confidentialité | U002 | A009 | I021 | D007 | E016 | H012 | parent/coach read | S003 | aucun accès implicite |
| CR-044 | Prompt injection RAG neutralisée | P0 policy hijack | U040 | N/A: server | I021/P014/P015 | N/A: fixture | E023 | H012 | doc demande secret/tool | S004 | policy système intacte |
| CR-045 | Markdown/XSS/exfiltration sûrs | P0 code navigateur | U063 | N/A: UI | I021 | N/A: DOM fixture | E023 | H006 | html/js/data/image remote | S010 | aucune exécution/requête |
| CR-046 | Rate/concurrency/longueur | P0 abus/coût | U064 | A020 | I001 | D002 | E011 | H007 | dépassement/flood | S003 | 429/413/409 stables |
| CR-047 | Télémétrie structurée sans PII | P0 incidents invisibles | U064 | A019 | I022 | D005/D014 | E025 | H012 | ERROR/CANCEL/TIMEOUT manquant | S006 | champs requis, contenu absent |
| CR-048 | Query budget/no N+1/history borné | P1 saturation DB | U064 | N/A: internal | I023 | D008/D010 | E024 | H012 | 1 vs 100 entities | S007 | count constant, budgets verts |
| CR-049 | TTFT/RAG/total + zéro write/token | P1 latence/charge | U064 | N/A: internal | I023 | D005/D014 | E024 | H012 | 500 deltas | S006 | métriques séparées/bornées |
| CR-050 | Zéro skip/todo/focus/quarantaine/ignore | P0 faux vert | N/A: policy script | N/A | N/A: static H009 | N/A: static | E025 | H009 | raw tokens + ignored lanes | S010 | neuf compteurs = 0 |
| CR-051 | Couverture critique 100%, ARIA ≥95% | P0 branches non prouvées | U001–U064 | A001–A020 | I001–I024 | D001–D020 | N/A: coverage Jest | H009 | exclusions/ignore pragmas | S010 | seuils bloquants |
| CR-052 | Imports/frontières mécaniques | P0 bypass | N/A: static | N/A | N/A: AST H001–H004 | N/A: constraints | N/A: architecture-only gate | H001–H004 | route→Prisma/provider | S002 | import interdit échoue CI |
| CR-053 | Dead/orphan/duplicate/hardcode/default zéro | P1 dette cachée | N/A: static | N/A | N/A: build graph H010 | N/A | E026 | H006/H010/H011 | adapters test-only | S002 | dix métriques zéro |
| CR-054 | M1 expand additive/replayable | P0 migration casse prod | N/A: SQL test | N/A | N/A: DB D016 | D016 | N/A: migration | H003/H009 | DB vide/legacy/replay | S005 | aucune data backfill dans M1 |
| CR-055 | M2 séparé et guardé | P0 data loss | N/A: readiness | N/A | N/A: DB D020 | D020 | N/A: future deploy | H009 | DROP avec blockers | S005 | contract refuse dirty state |
| CR-056 | Backfill conversation-context exact | P0 mauvais cours | U004/U011–U015 | N/A | N/A: DB D017 | D017 | N/A: migration | H011 | raw collision/ambiguous | S005 | 3 classes, zéro suppression |
| CR-057 | Backfill conversation-turns exact | P0 faux historique | U019/U020 | N/A | N/A: DB D017 | D017 | E009 | H004 | pending/orphan/equal time | S005 | grouping/hash/count exacts |
| CR-058 | Backfill entitlements exact | P0 accès perdu/gagné | U006–U009 | A004–A007 | I005 | D018 | E006 | H001 | malformed/multi-source | S003 | equivalence ou cutover bloqué |
| CR-059 | Backfill feedback/profile exact | P0 préférence inventée | U060/U061 | A017 | I020 | D019 | E013 | H004/H007 | canonical conflict/auto select | S009 | canonical wins, pins non inférés |
| CR-060 | Docs/ops/reviews/HEAD exact | P0 preuve stale | N/A: documentation | N/A | N/A: H008/H009 | N/A: release gate | N/A: release gate | H008/H009 | stale review/open thread | S001–S010 | artefacts du HEAD exact |
| CR-061 | Provenance/capability fondée sur preuve | P0 faux corpus | U036–U038 | A008 | I024 | D010 | E008 | H005 | MEN sans artifact/string-only | S004 | FALSE_RESOURCE_PROVENANCE=0 |
| CR-062 | Coverage academic map ≠ capability | P1 100% trompeur | U010 | A008 | I005 | N/A: generated matrix | E005 | H008 | candidat/LVA-LVB claimed | S002 | métriques séparées, NOT_PROVEN |
| CR-063 | Contrats C–G extensibles sans implémentation | P1 redesign futur | N/A: docs only | N/A | N/A: H008 justifie | N/A: future lots | N/A: future lots | H008 | roadmap présenté implemented | S002 | FUTURE_LOT explicite |
| CR-064 | Éval logicielle ≠ qualité pédagogique | P0 greenwashing | U064 | N/A | P001–P019/I024 | N/A: fixture | E001/E008 | H008/H009 | suite non revue/digest mismatch | S004 | gates séparés et fingerprintés |

Ainsi `CRITICAL_REQUIREMENTS=64` et `CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=0`. Le check compte les lignes `CR-*`, interdit une cellule preuve inconnue et exige une justification `N/A:` lorsque integration et E2E ne sont pas applicables.

## 25. Politique zéro test debt et couverture

### 25.1 Baseline honnête et état cible

Le scan brut à `1149572` trouve 3 `test.skip(condition)` exécutables dans `e2e/candidate-diagnostic.spec.ts` et `e2e/real/coach-resource-student.spec.ts`, plus 4 tokens skip, 1 todo, 1 xit et 1 test.only dans les sondes du checker lui-même. Les configs Playwright ignorent aussi des lanes. Ce n'est pas un PASS.

C16 supprime les skips conditionnels en seedant student/second-coach et fait échouer le preflight si une fixture manque ; retire les ignores/quarantaine correspondants et réécrit les sondes du checker sans tokens bruts interdits. Le scanner AST couvre tous les fichiers suivis sous `app/`, `components/`, `lib/`, `__tests__/`, `tests/` si présent, `e2e/` et `scripts/`, sans exclure son propre fichier.

```text
TEST_SKIP_COUNT=0
TEST_TODO_COUNT=0
XIT_COUNT=0
XDESCRIBE_COUNT=0
FIT_COUNT=0
FDESCRIBE_COUNT=0
TEST_ONLY_COUNT=0
QUARANTINED_TEST_COUNT=0
IGNORED_ARIA_TEST_COUNT=0
```

`scripts/testing/check-zero-test-debt.mjs` échoue sur `.skip`, `.todo`, xit/xdescribe/fit/fdescribe, test/describe/it.only, Playwright `testIgnore` couvrant ARIA, Jest path ignore couvrant un test ARIA, assertion permissive et marqueur quarantine. Une dépendance non provisionnée fait échouer le job ; elle ne transforme jamais un test en skip.

### 25.2 Coverage gate

Créer `jest.aria.coverage.config.js` avec `collectCoverageFrom` exhaustif sur tout `lib/aria/**/*.ts`, `app/api/aria/**/*.ts`, `components/aria/**/*.tsx` et les wrappers authentifiés finaux. Les seules non-sources sont `.d.ts` et données/schémas générés non exécutables ; aucun `.ts/.tsx` ARIA, repository, route, branche d'erreur, script de migration/backfill ou pragma ignore n'est exclu. Les lanes DB restent séparées pour sérialisation, pas exclues de la matrice de preuve.

| Scope | Lines | Functions | Branches |
| :--- | ---: | ---: | ---: |
| Authorization/context | 100 % | 100 % | 100 % |
| Conversation lifecycle/state machine | 100 % | 100 % | 100 % |
| Idempotency/concurrency application code | 100 % | 100 % | 100 % |
| SSE protocol/parser | 100 % | 100 % | 100 % |
| Retrieval policy | 100 % | 100 % | 100 % |
| Public error serializer | 100 % | 100 % | 100 % |
| Feedback ownership | 100 % | 100 % | 100 % |
| Course/resource/skill guards | 100 % | 100 % | 100 % |
| ARIA-B global | ≥95 % | ≥95 % | ≥95 % |

Statements suivent aussi un plancher ARIA-B de 95 %. `collectCoverageFrom` inclut `scripts/aria/**/*.ts` en plus de `lib/aria`, routes et composants ; les scripts migration/backfill sont instrumentés dans leur lane DB, sans exclusion opportuniste. `aria:coverage` combine unit/API/integration instrumentés et la couverture V8 collectée dans les runners DB ; `aria:coverage:check` fusionne les artifacts puis applique seuil global et seuils par fichier. `tsconfig.aria-scripts.json` et `typecheck:aria-scripts` ajoutent le gate statique, sans remplacer la couverture runtime. `jest.integration.config.js` ne matche plus `*.real.test.ts`; ces tests restent exclusivement serial dans `jest.config.db.js` via le wrapper.

## 26. Migrations et backfills entièrement spécifiés

Les comptes de fixture sont exacts ; les comptes production ne sont jamais devinés. `--audit` produit un manifeste `{sourceSnapshotSha256,total,deterministic,archived,manual,noOp,targetRows}`. `--apply --expect-manifest <sha>` refuse tout changement de compte/source ; `--verify` exige l'égalité exacte et `total=deterministic+archived+manual+noOp`. Toute donnée ambiguë en production crée le seul gate permis : revue de données, sans suppression.

### 26.1 Vagues de migration

| NAME | SOURCE_SCHEMA | TARGET_SCHEMA | PRECONDITION | ROW_SELECTION | DETERMINISTIC_RULE | AMBIGUOUS_CASE | DRY_RUN_COMMAND | EXPECTED_COUNTS | POSTCONDITION | ROLLBACK | DATA_LOSS_RISK |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| M1 `aria_turn_lifecycle_expand` | migration `20260829220000_aria_core_models` : conversation nullable, message status/feedback indépendants | 4 tables : Turn, EntitlementScope, DataMigrationRun, DataMigrationRowAudit ; context/link/citation/prefs/watchdog/trigger/index/FK/CHECK | baseline appliquée ; backup/clone ; old writers seulement sur messages non liés | DDL seulement, aucune ligne backfillée | migration transactionnelle, idempotent replay sur DB vide et fixture legacy ; trigger cible turnId non-null | aucune donnée transformée ; DDL conflict bloque | `npm run test:aria:migrations -- --wave M1 --dry-run` | newTables=4, newRows=0 ; colonnes/FK/check/index=exact schema snapshot | ancien binaire avant cutover ; nouveau writer désactivé ; audit prêt | avant drainage/message lié, redeploy ancien ; ensuite fix-forward, pas de down | LOW, additive |
| M2 `aria_conversation_legacy_contract` | M1 + backfills + zéro ancien writer | courseKey NOT NULL runtime ; drop subject/message status+feedback/selectedCourseKeys legacy selon guards | soak ; audit sha approuvé ; readiness zéro ; backup restaurable | DDL sur colonnes legacy uniquement | `aria:contract:verify` vérifie chaque guard avant DROP | toute ligne null/unresolved/unlinked/divergente ou préférence non adjudiquée bloque | `npm run test:aria:migrations -- --wave M2 --dry-run` | dirty fixture=6 blockers/0 DROP ; clean fixture=0 blocker/schema contract exact | aucun reader/writer legacy, archive audit conservée | fix-forward ou restore validé ; jamais avec M1 | HIGH si guard contourné, donc fail closed |

M2 reste une vague ultérieure hors déploiement #200. `scripts/aria/verify-contract-readiness.ts` et `D020` sont néanmoins livrés/testés dans #200. `selectedCourseKeys` n'est supprimé que lorsque chaque valeur non vide est soit explicitement remplacée par preferences v1, soit conservée dans l'artifact d'audit et classée manual/archived ; aucune intention n'est inférée.

### 26.2 Quatre backfills

| NAME | SOURCE_SCHEMA | TARGET_SCHEMA | PRECONDITION | ROW_SELECTION | DETERMINISTIC_RULE | AMBIGUOUS_CASE | DRY_RUN_COMMAND | EXPECTED_COUNTS fixture | POSTCONDITION | ROLLBACK | DATA_LOSS_RISK |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| B1 `conversation-context` | AriaConversation courseKey/subject/skillId/resourceId | contextState + courseKey + RowAudit class/before-image | M1 ; Resource Registry/skills digest pinés | toutes conversations, sans modifier messages | courseKey valide ; skill unique ; Resource ID invariant ; sinon Academic Map+sujet candidat unique | raw skill collision, ressource non prouvée, plusieurs/zéro candidats → MANUAL/ARCHIVED persisté | `npm run aria:backfills -- conversation-context --audit` | total=12, deterministic=5, archived=4, manual=3, deleted=0 | ACTIVE a courseKey ; chaque source a RowAudit | rollback CAS depuis before-image si fingerprint inchangé | NONE, zéro overwrite ambigu |
| B2 `conversation-turns` | messages sans Turn, status, timestamps | LEGACY_IMPORT terminal Turns + links + migrationRunId/RowAudit | B1 ; anciens writers drainés/cutover irréversible | messages `(conversationId,createdAt,id)` | paire user→assistant complète ; terminal exact ; IDs/sequence hash stable | PENDING/STREAMING/orphelin/groupe ambigu → ARCHIVED/MANUAL RowAudit, jamais paire inventée | `npm run aria:backfills -- conversation-turns --audit` | messages=24 : linked=16/Turns=8, archived=4, manual=4, deleted=0 | runtime liés ; legacy non liés ont classification persistée | unlink/delete targets du run puis restore before-image par CAS | NONE, source messages immuables |
| B3 `entitlements` | Subscription status/dates/ariaSubjects + grants | Entitlement/source + scopes + migration provenance | M1 ; registry produit versionné | toutes Subscriptions/grants ARIA | status/date exact ; ALL/global ; course exact ; alias candidat unique ; union sources | malformed/unknown/multiple/divergence → MANUAL RowAudit, aucun grant | `npm run aria:backfills -- entitlements --audit` | selected=12, entitlements=8, scopes=11, noOp=2, manual=2, duplicates=0 | divergence=0 avant cutover ; chaque target traçable | supprimer targets du run/restaurer before-images par CAS | LOW ; fail closed, aucun droit silencieux |
| B4 `feedback-profile` | Message.feedback + Feedback + selectedCourseKeys/uiPreferences | Feedback + prefs v1 + migration provenance | C14 ; reader canonique | feedback non-null ; profils legacy | canonical gagne ; insert absent ; selected vide→defaults ; aucun nonempty→pins | conflict/unknown/nonempty → MANUAL RowAudit, legacy conservé | `npm run aria:backfills -- feedback-profile --audit` | feedback=10/new=6/equal=2/conflict=2 ; profiles=6/deterministic=2/manual=4/inferredPins=0/deleted=0 | double writer off ; prefs strictes ; targets traçables | delete inserts du run/restaure before-images par CAS | NONE, canonical jamais écrasé |

Classes communes : `DETERMINISTIC_BACKFILL`, `ARCHIVED_NON_RESUMABLE`, `MANUAL_REVIEW_REQUIRED`. Les commandes production utilisent un clone anonymisé puis une fenêtre autorisée ; le runner refuse host/db hors allowlist et n'accepte jamais `--apply` sans digest d'audit.

## 27. Matrices frontend, sécurité, RAG et exploitation

### 27.1 Frontend et accessibilité

`AriaChat` (public) et `AriaWidget` (dashboard) sont deux moteurs actifs à la baseline ; `aria-feedback` et `aria-comparison` sont orphelins. C15 les remplace par `AriaChatPanel` + `useAriaConversation`; le dashboard garde seulement `AriaChatLauncher`, `/plateforme-aria` rend `AriaMarketingDemo` statique et les quatre anciens composants sont supprimés. Le browser utilise le parser SSE canonique ; les cours viennent exclusivement de `/api/aria/curriculum`.

| Viewport | Layout/overflow | Composer/course | Stream/failures | A11y/runtime |
| :--- | :--- | :--- | :--- | :--- |
| 390×844 | `100dvh`, safe-area, zéro overflow horizontal | visible au clavier, cours/raison disabled lisibles | delta, stop, timeout/RAG error | focus trap/return, live/busy, axe, console/hydration zéro |
| 768×1024 | panel/tablet borné | composer toujours atteignable | citation/history/reload | clavier complet, labels/pressed/describedby |
| 1366×768 | faible hauteur sans masquer footer | cours + composer visibles | 500 deltas, Stop réactif | late events ignorés, aucune duplication |
| 1440×900 | layout desktop déterministe | focus/course stable | feedback après 2xx | capture/axe, aucune requête externe |

Le rendu message utilisateur reste texte. Le Markdown assistant n'active jamais HTML brut ; liens `https` canoniques seulement, images distantes/data/javascript interdites, citations créées uniquement depuis ResourceVersion validée. `aria-live` annonce phase/terminal sans relire chaque delta.

### 27.2 Sécurité/privacy négative

Les cases `U/A/I/D/E/H` couvrent explicitement : conversation `STUDENT_PRIVATE`; studentId/entitlement/grade/track forgés ; cross-student/course ; RAG prompt injection ; XSS/Markdown/event handlers/protocoles ; resource owner/version ; rate et mono-concurrence ; longueur message ; public/log redaction. PARENT/COACH/ADMIN sont refusés par l'envelope route élève. Les logs usuels ne contiennent aucun prompt/message/email/account ID ; les artifacts d'échec E2E utilisent des données fixture uniquement.

### 27.3 Resource/RAG cross-repo

```text
Nexus owner: data/aria/resources.v1.json
  Resource.resourceId
    → immutable ResourceVersion.resourceVersionId + contentSha256
      → export resourceRegistryVersion/resourceRegistrySha256
RAG owner: packages/contracts/schema/servable-corpus-manifest-v1.json
  schemaVersion=1, package SemVer, manifestVersion + manifestSha256
    → corpusVersion indexed resourceVersionIds
Nexus generated lock: data/aria/rag/servable-corpus-index.lock.json
  → active + N/N-1 digests/retireAt → manifests/<manifestSha256>.json
    → citation.resourceVersionId/contentSha256/chunkId/locator/corpusVersionId/manifestSha256
```

Le RAG ne possède que `corpusId→collection`; Nexus seul possède `courseKey+mode+role→corpusId`. C02 versionne/exporte les schemas avec SemVer/`$id`/digest/commit, C03a exporte l'inventory gouverné, C05a scelle le Registry, C03b publie l'index N/N-1 et les manifests immuables, puis C05b importe contrats et lock byte-identical. RAG déploie N en conservant N-1 jusqu'au `retireAt` publié ; Nexus preflight compare package/schema/Registry/manifest digests puis déploie. Incompatibilité, N-2, ressource manquante ou digest actif différent = capability UNAVAILABLE et `RAG_UNAVAILABLE`, jamais ancienne collection ou modèle non-groundé implicite.

### 27.4 Performance et observabilité

`I023`, `D008/D010/D014` et `E024` mesurent : contexte ≤8 queries et count constant 1→100 entities ; p95 warm ≤150 ms ; history keyset ≤50 Turns/64 KiB ; mutation ≤8 KiB et message ≤1 500 caractères ; RAG `topK=8`, max 20, réponse ≤256 KiB et timeout 5 s ; sortie/buffer modèle ≤64 KiB ; first-token timeout 15 s ; total 30 s ; replay client ≤60 s avec backoff 500 ms→5 s ; overhead fixture p95 ≤250 ms ; zéro DB write/token ; heartbeat ≤1/10 s. Les seuils sont configs/gates techniques internes, pas métriques produit exposées.

Chaque START/RETRIEVAL/MODEL/FINALIZE/ERROR/CANCELLED/TIMEOUT/RECOVERY porte `requestId`, turnId, conversationId, courseKey, task/mode, ragStatus, modelPolicy opaque, latencyClass et finalState. Ces identifiants restent dans les logs corrélés ; les métriques utilisent seulement des labels bornés et jamais turnId/conversationId. Le test logger refuse tout champ brut sensible ; badge/best-effort failure produit warning `{requestId,operation}` et n'altère pas le Turn canonique.

## 28. Audit final dead/orphan/duplicate/hardcode

`scripts/aria/check-reachability.ts` construit l'import graph TS/TSX, inclut imports statiques/dynamiques, barrels, route composition, tests et build Next, puis scanne `app/ components/ lib/ __tests__/ tests/ scripts/`. Il interdit les adapters conservés pour tests, compare exports/consumers et autorise les course keys uniquement dans manifests/fixtures déclarés. Il met à jour et vérifie `docs/stack-closure/ZERO_DEBT_LEDGER.json` avec le HEAD, les entrées runtime/test/script et la classification ACTIVE/DEAD/ORPHAN/LEGACY_COMPAT_REQUIRED ; une ligne stale (dont embedded chat déjà supprimé) échoue.

```text
ARIA_DEAD_CODE=0
ARIA_ORPHANS=0
ARIA_ZOMBIES=0
ARIA_DUPLICATED_CHAT_ENGINES=0
ARIA_DUPLICATED_SSE_PARSERS=0
ARIA_DUPLICATED_RAG_MAPPINGS=0
ARIA_DUPLICATED_ENTITLEMENT_BUILDERS=0
ARIA_HARDCODED_COURSE_LISTS=0
ARIA_IMPLICIT_GRADE_DEFAULTS=0
ARIA_IMPLICIT_COURSE_DEFAULTS=0
```

Chaque métrique sort avec la liste des fichiers inspectés et échoue si l'inventaire est vide. `aria-embedded-chat` reste supprimé ; `aria-chat`, `aria-widget`, `aria-feedback`, `aria-comparison`, legacy adapter et wrappers generate/save disparaissent après portage des seules fixtures utiles.

## 29. Fichiers de qualification et scripts à livrer dans C16

- `data/aria/testing/aria-b-evidence.v1.json`, `scripts/aria/check-test-traceability.ts` ;
- `jest.aria.coverage.config.js`, `tsconfig.aria-scripts.json`, `scripts/aria/check-coverage.ts` ;
- `scripts/testing/check-zero-test-debt.mjs`, suppression `e2e/QUARANTINE.md`, provisionnement des lanes conditionnelles ;
- `scripts/aria/check-reachability.ts`, `scripts/aria/check-integrity.ts`, `scripts/aria/check-runtime-manifest.ts` ;
- `scripts/aria/verify-contract-readiness.ts`, `scripts/aria/test-migrations.ts`, `scripts/aria/run-backfills.ts`, wrapper DB jetable ;
- `scripts/aria/check-production-artifact.ts`, `scripts/aria/check-security.ts`, `scripts/aria/check-performance.ts` ;
- `docs/stack-closure/ZERO_DEBT_LEDGER.json` et migration/suppression des scripts encore `subject` (`mega-e2e-aria`, `test-aria-entitlements`) ;
- configs Jest/Playwright/CI sans recouvrement DB, ignore ARIA, retry E2E ou assertion permissive.

Les scripts exposent les commandes exactes du Chunk 5 et sont eux-mêmes testés/typecheckés. Le check de traçabilité prouve `CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE=0`; il ne déduit jamais l'exhaustivité d'un nombre brut de tests ou d'une approbation d'agent.

## Chunk 5 — Matrice finale de commandes reproductibles

Les scripts ci-dessous sont créés et testés par C16. Ils refusent une lane vide, un fichier ignoré, une DB non jetable, un artifact d'un autre HEAD ou un manifeste d'un autre digest. Aucun `--passWithNoTests`, skip, retry Playwright, `|| true` ou filtre permissif n'est autorisé.

```bash
set -euo pipefail
ARIA_NEXUS_WORKTREE="$(git rev-parse --show-toplevel)"
cd "$ARIA_NEXUS_WORKTREE"
git merge-base --is-ancestor 1149572f5bf85b43bc10c870cb4fd81b336f7f56 HEAD

# enum drift et traçabilité requirement → evidence
npm run aria:enum-drift
npm run aria:test-plan:check

# ARIA targeted unit, API, integration, real DB, concurrency, SSE, architecture
npm run test:aria:unit
npm run test:aria:api
npm run test:aria:integration
npm run test:aria:db
npm run test:aria:concurrency
npm run test:aria:sse
npm run test:aria:architecture

# couverture critique 100 % et périmètre ARIA-B ≥95 %
npm run test:aria:coverage
npm run aria:coverage:check

# E2E desktop/mobile, accessibilité et qualité pédagogique déterministe
npm run test:aria:e2e:desktop
npm run test:aria:e2e:mobile
npm run test:aria:a11y
npm run aria:evaluate:check
npm run aria:evaluate -- --mode fixture

# suites complètes
npm run test:unit -- --runInBand
npm run test:integration:disposable
npm run test:e2e:ephemeral

# statique, build, sécurité et zéro dette de tests
npm run typecheck
npm run typecheck:aria-scripts
npm run lint
npm run build
npm run aria:security
npm run test:zero-debt

# dead/orphan/duplicate/hardcode et architecture applicative
npm run aria:reachability
npm run aria:integrity

# contrat RAG/resource et performance
npm run aria:manifest:check
npm run aria:manifest:runtime-check
npm run aria:performance:check

# replay M1/M2, backfills dry-run exacts et artifact de production
npm run test:aria:migrations
npm run test:aria:backfills
npm run aria:artifact:check
npm run aria:smoke:production-artifact

# dépôt RAG compagnon propre, contrat/manifeste/évaluation et CI
: "${ARIA_RAG_WORKTREE:?Set ARIA_RAG_WORKTREE to a clean companion worktree}"
: "${ARIA_RAG_PR_NUMBER:?Set ARIA_RAG_PR_NUMBER to the companion PR}"
test -z "$(git -C "$ARIA_RAG_WORKTREE" status --porcelain)"
git -C "$ARIA_RAG_WORKTREE" merge-base --is-ancestor ffc1bae31e57a23e0e9dca7c4a7da66270c24552 HEAD
ARIA_RAG_EXPECTED_SHA="$(jq -r '.producer.commit' data/aria/rag/servable-corpus-index.lock.json)"
test "$(git -C "$ARIA_RAG_WORKTREE" rev-parse HEAD)" = "$ARIA_RAG_EXPECTED_SHA"
(
  cd "$ARIA_RAG_WORKTREE"
  python -m pytest packages/contracts/tests/test_servable_corpus_manifest.py packages/contracts/tests/test_resource_registry_bootstrap.py packages/contracts/tests/test_internal_identity_vectors.py packages/contracts/tests/test_schema_export.py -q
  python packages/contracts/scripts/export_schemas.py --output packages/contracts/schema --check
  python -m pytest services/rag-engine/tests/test_resource_registry_bootstrap_inventory.py services/rag-engine/tests/test_servable_corpus_manifest.py services/rag-engine/tests/test_servable_corpus_index.py services/rag-engine/tests/test_retrieval_v2_contract.py services/rag-engine/tests/test_eval_manifest_binding.py -q
  python -m pytest services/rag-engine/tests/integration/test_resource_registry_bootstrap_inventory_pg.py services/rag-engine/tests/integration/test_servable_corpus_manifest_pg.py -q
  make -C services/rag-engine lint
  make -C services/rag-engine typecheck
  make -C services/rag-engine test
  ARIA_RAG_REPOSITORY="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
  test "$(gh pr view "$ARIA_RAG_PR_NUMBER" --repo "$ARIA_RAG_REPOSITORY" --json headRefOid --jq .headRefOid)" = "$ARIA_RAG_EXPECTED_SHA"
  gh pr checks "$ARIA_RAG_PR_NUMBER" --repo "$ARIA_RAG_REPOSITORY" --watch --fail-fast=false
)

# fresh Codex review/security review et tous les checks GitHub sur le HEAD exact
cd "$ARIA_NEXUS_WORKTREE"
test -z "$(git status --porcelain)"
FINAL_HEAD="$(git rev-parse HEAD)"
git push origin "$FINAL_HEAD:$(git branch --show-current)"
test "$(gh pr view 200 --json headRefOid --jq .headRefOid)" = "$FINAL_HEAD"
gh pr comment 200 --body '@codex review'
gh pr comment 200 --body '@codex security review'
gh pr checks 200 --watch --fail-fast=false
npm run aria:review-gate -- --pr 200 --head "$FINAL_HEAD" --require-codex --require-security --open-threads 0 --wait --timeout 1800
```
