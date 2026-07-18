# Pré-rentrée 2026 v5 Canonical Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the six-document public Pré-rentrée 2026 package, accessible HTML companions, social visuals, audit evidence, and legally blocked private dossier structure from one validated canonical publication snapshot.

**Architecture:** A TypeScript compiler reads and validates repository sources, derives publication-ready values, and emits one Zod/JSON-Schema-validated snapshot. A Python/WeasyPrint orchestrator receives only that snapshot for business data, renders into a temporary directory, runs content/PDF/accessibility/visual gates, and atomically publishes `outputs-v5-canonical/` while suppressing private PDFs when approved terms are absent.

**Tech Stack:** TypeScript 5, `tsx`, Zod 3, Jest 29, Python 3.12, pytest 9, WeasyPrint 68.1, Pillow 12.3, pypdf 6.11, BeautifulSoup 4.12, jsonschema 4.26, qrcode 7.4, OpenCV 4.13, Poppler, ImageMagick.

---

## File map

- `scripts/pre-rentree/publication-snapshot-schema.ts`: runtime and static snapshot contract.
- `scripts/pre-rentree/publication-snapshot.schema.json`: portable renderer/audit contract.
- `scripts/pre-rentree/publication-sources.ts`: explicit source resolution, loading, hashing, and legal state.
- `scripts/pre-rentree/publication-derivations.ts`: pure schedule, pricing, labels, claims, and publication-mode logic.
- `scripts/pre-rentree/build-publication-snapshot.ts`: CLI composition and atomic snapshot write.
- `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`: TypeScript source-of-truth contracts.
- `scripts/pre-rentree/audit_v4.py`: v4 input manifest and PDF claim extraction/classification.
- `scripts/pre-rentree/document_model.py`: Python snapshot validation and immutable model helpers.
- `scripts/pre-rentree/document_templates.py`: semantic public HTML and blocked private structural HTML.
- `scripts/pre-rentree/document_assets.py`: fonts, logos, QR, social PNGs, rasterization.
- `scripts/pre-rentree/document_renderer.py`: WeasyPrint PDF conversion from HTML.
- `scripts/pre-rentree/document_audit.py`: artifact, content, accessibility, visual, and manifest gates.
- `scripts/pre-rentree/generate_documents.py`: only document-build orchestrator.
- `scripts/pre-rentree/templates/document.css`: shared print/screen CSS and subject palette.
- `scripts/pre-rentree/requirements.lock`: pinned Python build dependencies.
- `scripts/pre-rentree/tests/`: focused Python tests.
- `package.json`: snapshot build/test commands only; no production runtime change.
- `outputs-v5-canonical/`: generated public, private-block, sources, and audit tree.

## Chunk 1: Provenance and publication snapshot

### Task 1: Install and verify the isolated baseline

**Files:**
- Read: `package-lock.json`
- Read: `AGENTS.md`
- Create later: `outputs-v5-canonical/AUDIT/baseline-test-status.json`

- [ ] **Step 1: Confirm the isolated commit and pristine v4 directory**

Run:

```bash
git rev-parse origin/main
git status --short
sha256sum ../outputs/*.pdf ../outputs/generate_all_pdfs.py ../outputs/essentiel.html
```

Expected: `origin/main` is exactly `a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0`; only approved local planning commits exist; v4 files are readable and outside the repository.

- [ ] **Step 2: Install repository dependencies without changing the lockfile**

Run:

```bash
npm ci
```

Expected: exit 0 and no `package-lock.json` change.

- [ ] **Step 3: Run the relevant pre-existing campaign baseline**

Run:

```bash
npm test -- --runInBand --runTestsByPath \
  __tests__/campaigns/pre-rentree-2026.test.ts \
  __tests__/campaigns/pre-rentree-2026-structure.test.ts \
  __tests__/campaigns/pre-rentree-2026-public-claims.test.ts
```

Expected: all selected suites pass. If they do not, record the exact pre-existing failures before continuing.

### Task 2: Define the publication contract

**Files:**
- Create: `scripts/pre-rentree/publication-snapshot-schema.ts`
- Create: `scripts/pre-rentree/publication-snapshot.schema.json`
- Create: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`

- [ ] **Step 1: Write the failing schema test**

Test a minimal invalid object and require rejection for missing `sourceRepoSha`, `campaign`, `packs`, `modules`, `legal`, `contact`, and `approvedPublicClaims`. Test that the full compiled fixture accepts exactly 12 modules and 60 sessions.

```ts
expect(() => PublicationSnapshotSchema.parse({})).toThrow();
expect(snapshot.modules).toHaveLength(12);
expect(snapshot.modules.flatMap((module) => module.sessions)).toHaveLength(60);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- --runInBand --runTestsByPath __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
```

Expected: FAIL because the schema/compiler exports do not exist.

- [ ] **Step 3: Implement the minimal Zod contract and matching JSON Schema**

Model provenance, campaign, schedule, packs, modules, content, claims, contact, assets, document metadata, and legal publication state. Use strict objects for all public contracts and `z.literal(12)`/array length constraints where the campaign contract is fixed.

- [ ] **Step 4: Re-run and keep the fixture portion failing only for the absent compiler**

Expected: schema rejection test passes; compiler fixture import remains RED.

- [ ] **Step 5: Commit the contract**

```bash
git add scripts/pre-rentree/publication-snapshot-schema.ts scripts/pre-rentree/publication-snapshot.schema.json __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
git commit -m "test: define pre-rentree publication snapshot contract"
```

### Task 3: Implement canonical source loading and derivations

**Files:**
- Create: `scripts/pre-rentree/publication-sources.ts`
- Create: `scripts/pre-rentree/publication-derivations.ts`
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`

- [ ] **Step 1: Add failing source and derivation tests**

Cover:

```ts
expect(sourceVersions).toEqual({campaign: '1.0.0', modules: '2026-pre-rentree-v1', pricing: '2026-2027.2'});
expect(expandedSchedule).toHaveLength(60);
expect(packs.map((p) => [p.price, p.deposit, p.balance])).toEqual([
  [480, 140, 340], [900, 270, 630], [1350, 410, 940], [1800, 540, 1260],
]);
expect(legal.status).toBe('MISSING_APPROVED_COMMERCIAL_TERMS');
expect(legal.contractualDossierPublicationBlocked).toBe(true);
```

Also compare every emitted module/session field to `modules.json` and every schedule slot/date to the campaign source.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL for missing loaders and derivations.

- [ ] **Step 3: Implement explicit-root source loading**

Resolve the repository root from `import.meta.url` or an explicit `--repo-root`, hash file bytes with SHA-256, call existing campaign/module Zod schemas and pricing getters, import `LEGAL`, and treat the campaign-referenced commercial terms file as approved only when it contains machine-readable `status: APPROVED`, terms version, effective date, owner reference, and legal reference.

- [ ] **Step 4: Implement pure derivations**

Expand the schedule, make public room labels, resolve level-specific subject labels, select packs by campaign product IDs, build source-mapped public claims, derive the absolute canonical URL, derive `PRE_REGISTRATION_ONLY`, and expose no teacher IDs, pack IDs, or source status tokens as public copy.

- [ ] **Step 5: Run tests and verify GREEN**

Expected: all snapshot source/derivation assertions pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/pre-rentree/publication-sources.ts scripts/pre-rentree/publication-derivations.ts __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
git commit -m "feat: derive canonical pre-rentree publication data"
```

### Task 4: Build the snapshot CLI atomically

**Files:**
- Create: `scripts/pre-rentree/build-publication-snapshot.ts`
- Modify: `package.json`
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`

- [ ] **Step 1: Add a failing CLI integration test**

Run the CLI into a temporary directory, parse the output, validate it, and assert the source SHA equals the captured `git rev-parse origin/main` while the canonical input SHA hashes match direct byte hashing.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the CLI is absent.

- [ ] **Step 3: Implement the CLI**

Support:

```text
tsx scripts/pre-rentree/build-publication-snapshot.ts \
  --repo-root <path> --output <snapshot.json> --source-repo-sha <sha>
```

Write to a sibling temp file, fsync, rename atomically, and set deterministic JSON formatting.

- [ ] **Step 4: Verify GREEN and build the real snapshot**

Run:

```bash
npm test -- --runInBand --runTestsByPath __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
npx tsx scripts/pre-rentree/build-publication-snapshot.ts \
  --repo-root "$PWD" \
  --source-repo-sha "$(git rev-parse origin/main)" \
  --output generated/pre-rentree-2026-publication.snapshot.json
```

Expected: tests pass and the snapshot validates.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/pre-rentree/build-publication-snapshot.ts generated/pre-rentree-2026-publication.snapshot.json __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts
git commit -m "feat: compile canonical pre-rentree publication snapshot"
```

## Chunk 2: v4 audit and renderer foundations

### Task 5: Capture the v4 provenance manifest and claim matrix

**Files:**
- Create: `scripts/pre-rentree/audit_v4.py`
- Create: `scripts/pre-rentree/tests/test_audit_v4.py`

- [ ] **Step 1: Write failing tests for exact artifact inventory**

Require seven PDF entries, separate generator and Essentiel HTML hashes, canonical source hashes, legal source status, logos, per-page extracted text, required CSV columns, and deterministic claim row ordering.

- [ ] **Step 2: Run and verify RED**

```bash
pytest -q scripts/pre-rentree/tests/test_audit_v4.py
```

Expected: import failure for `audit_v4`.

- [ ] **Step 3: Implement read-only provenance collection**

Use explicit `--v4-root`, `--repo-root`, and `--output` arguments; invoke `pdfinfo` and `pdftotext` without a shell; hash bytes; never inspect `.env`; identify the missing approved terms source factually.

- [ ] **Step 4: Implement claim extraction and classification**

Split text by form-feed page boundaries; record every non-empty public sentence/table row as a claim candidate; classify dates, levels, subjects, labels, slots, rooms, capacity, prices, deposits, balances, programs, deliverables, assessment, materials, qualifications, policies, CTA, privacy, and image rights. Map supported claims to snapshot source paths and unsupported claims to `REMOVED` or `REQUIRES_APPROVED_SOURCE` actions.

- [ ] **Step 5: Verify GREEN**

Expected: tests pass; `V4_ARTIFACT_COUNT=7`; matrix columns and source mappings are complete.

- [ ] **Step 6: Commit**

```bash
git add scripts/pre-rentree/audit_v4.py scripts/pre-rentree/tests/test_audit_v4.py
git commit -m "feat: audit v4 provenance and public claims"
```

### Task 6: Create snapshot-only renderer primitives

**Files:**
- Create: `scripts/pre-rentree/document_model.py`
- Create: `scripts/pre-rentree/document_templates.py`
- Create: `scripts/pre-rentree/templates/document.css`
- Create: `scripts/pre-rentree/tests/test_document_model.py`
- Create: `scripts/pre-rentree/tests/test_document_templates.py`
- Create: `scripts/pre-rentree/requirements.lock`

- [ ] **Step 1: Write failing tests for validation, escaping, amounts, and hardcoding**

Require JSON Schema validation, generic HTML escaping, safe `https`/`mailto`/`tel` URLs, `1\u00a0350` visual grouping, `white-space:nowrap`, semantic `<th scope>`, `lang="fr"`, and absence of campaign prices/dates/contact/session titles from Python/HTML/CSS source.

- [ ] **Step 2: Verify RED**

```bash
pytest -q scripts/pre-rentree/tests/test_document_model.py scripts/pre-rentree/tests/test_document_templates.py
```

- [ ] **Step 3: Implement minimal immutable model helpers**

Load the snapshot, validate against the JSON Schema, expose dictionary access helpers, derive no business facts, and reject unknown top-level fields.

- [ ] **Step 4: Implement generic semantic template primitives**

Create page shell, heading, metadata footer, amount, table, claim block, program module, and form-field helpers. All business text arrives as arguments from the snapshot.

- [ ] **Step 5: Implement deterministic shared CSS**

Use project WOFF2 assets, centralized generic subject CSS variables fed from snapshot classes, non-splitting rows, print margins, page counters, screen focus states, accessible type sizes, and high-contrast monochrome mode.

- [ ] **Step 6: Pin the Python environment**

Record exact versions for WeasyPrint, Pillow, pypdf, BeautifulSoup, jsonschema, qrcode, opencv-python-headless, and pytest.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pytest -q scripts/pre-rentree/tests/test_document_model.py scripts/pre-rentree/tests/test_document_templates.py
git add scripts/pre-rentree/document_model.py scripts/pre-rentree/document_templates.py scripts/pre-rentree/templates/document.css scripts/pre-rentree/tests scripts/pre-rentree/requirements.lock
git commit -m "feat: add snapshot-only document rendering primitives"
```

## Chunk 3: Public and private document models

### Task 7: Render the six accessible public HTML documents

**Files:**
- Modify: `scripts/pre-rentree/document_templates.py`
- Modify: `scripts/pre-rentree/tests/test_document_templates.py`

- [ ] **Step 1: Add failing per-document semantic tests**

Require Essentiel, Planning, three Programmes, and Tarifs filenames; exact module/session text; profile notices; theoretical Physique-Chimie language; no filmed oral; subject abbreviations; grouped amounts; exact CTA; safe pre-registration statements; metadata footer; and source-mapped claim IDs.

- [ ] **Step 2: Verify RED**

Expected: missing document builders.

- [ ] **Step 3: Implement the public builders using snapshot sections only**

Essentiel summarizes canonical audience, dates, method, capacity, materials, CTA, and approved pre-registration notices. Planning builds class/week tables from expanded schedule. Program documents iterate modules by level with no paraphrase. Tarifs iterates packs and uses only approved public modalities.

- [ ] **Step 4: Verify GREEN and blocked terminology**

Scan rendered HTML for the mission blacklist and internal tokens. Require `PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT=0` by comparing rendered `data-claim-id` values with the snapshot claim registry.

- [ ] **Step 5: Commit**

```bash
git add scripts/pre-rentree/document_templates.py scripts/pre-rentree/tests/test_document_templates.py
git commit -m "feat: render accessible canonical public documents"
```

### Task 8: Build the private structural form and fail-closed legal gate

**Files:**
- Modify: `scripts/pre-rentree/document_templates.py`
- Create: `scripts/pre-rentree/tests/test_private_dossier.py`

- [ ] **Step 1: Write failing structure and gate tests**

Require the renamed dossier, cover warning, identifiers, entry profiles, subject/module/date fields, computed pack function, payment fields, safety fields, four separate consent groups, numeric types, radio yes/no controls, explicit names/tab order, and a privacy-notice missing-source block.

Require:

```python
assert snapshot["legal"]["contractualDossierPublicationBlocked"] is True
with pytest.raises(LegalPublicationBlocked):
    render_private_pdf(snapshot)
```

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement the structural HTML form model**

Generate no contractual clauses. Render a clearly marked non-publishable structural source under `SOURCES/HTML/PRIVATE_TEMPLATE/` only. Derive pack display from selected subject count and validate incompatible Première/Terminale selections.

- [ ] **Step 4: Implement the legal gate**

Only enable private PRINT/FILLABLE output if the snapshot carries approved terms metadata and complete privacy notice metadata. Otherwise emit the allowed blocked status and no private PDF.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pytest -q scripts/pre-rentree/tests/test_private_dossier.py
git add scripts/pre-rentree/document_templates.py scripts/pre-rentree/tests/test_private_dossier.py
git commit -m "feat: gate the private confirmation dossier on legal approval"
```

## Chunk 4: Assets, PDF generation, and audits

### Task 9: Add deterministic logos, fonts, QR, and social visuals

**Files:**
- Create: `scripts/pre-rentree/document_assets.py`
- Create: `scripts/pre-rentree/tests/test_document_assets.py`

- [ ] **Step 1: Write failing asset tests**

Require project-owned asset paths, SHA hashes, font identifiers, QR round-trip decoding to snapshot `qrTarget`, 1080×1350 feed, 1080×1920 story, 1080×1350 monochrome flyer, and non-empty alt text backed by snapshot claims.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement asset copy and verification**

Copy with hash verification into the temp build. Generate QR with fixed version/error correction/border and decode it with OpenCV. Generate social PNGs with Pillow using project fonts and the same snapshot model; do not introduce a second content pipeline.

- [ ] **Step 4: Verify GREEN and commit**

```bash
pytest -q scripts/pre-rentree/tests/test_document_assets.py
git add scripts/pre-rentree/document_assets.py scripts/pre-rentree/tests/test_document_assets.py
git commit -m "feat: generate verified document and social assets"
```

### Task 10: Convert HTML to PDF and generate artifact manifests

**Files:**
- Create: `scripts/pre-rentree/document_renderer.py`
- Create: `scripts/pre-rentree/document_audit.py`
- Create: `scripts/pre-rentree/tests/test_document_renderer.py`
- Create: `scripts/pre-rentree/tests/test_document_audit.py`

- [ ] **Step 1: Write failing PDF and manifest tests**

Generate a sample document and require A4 dimensions, metadata, French language marker, embedded project fonts, extractable text, links, page count, QR target, SHA-256, file size, document version, classification, and deterministic manifest sorting.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement WeasyPrint conversion**

Use local file base URLs, fixed metadata and timestamp inputs, no network fetches, and explicit font files. Render the six HTML documents to exact public filenames.

- [ ] **Step 4: Implement content/PDF/accessibility gates**

Use pypdf, `pdfinfo`, `pdffonts`, and BeautifulSoup to verify metadata, dimensions, links, extractable text, document structure, table headers, heading order, language, required footers, blocked terms, no PII fixtures, and no secret-like tokens.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pytest -q scripts/pre-rentree/tests/test_document_renderer.py scripts/pre-rentree/tests/test_document_audit.py
git add scripts/pre-rentree/document_renderer.py scripts/pre-rentree/document_audit.py scripts/pre-rentree/tests
git commit -m "feat: render and audit deterministic public PDFs"
```

### Task 11: Add 200-DPI visual regression evidence

**Files:**
- Modify: `scripts/pre-rentree/document_assets.py`
- Modify: `scripts/pre-rentree/document_audit.py`
- Create: `scripts/pre-rentree/tests/test_visual_audit.py`

- [ ] **Step 1: Write failing raster/contact-sheet tests**

Require one 200-DPI PNG and checksum per PDF page, a contact sheet, v4/v5 comparison sheet where equivalent documents exist, ImageMagick pixel statistics, page geometry checks, and a structured defect list.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement deterministic raster and evidence generation**

Invoke `pdftoppm` without shell expansion. Build contact sheets with Pillow. Record page image SHA-256, dimensions, ink bounding boxes, footer bounds, blank-page score, and v4 difference statistics.

- [ ] **Step 4: Implement conservative automatic defects**

Flag blank pages, missing footer bands, edge-clipped ink, unexpected page dimensions, missing text, split program rows detected by repeated row markers, and failed amount extraction. Do not claim automation proves subjective polish; include a factual manual-review field.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pytest -q scripts/pre-rentree/tests/test_visual_audit.py
git add scripts/pre-rentree/document_assets.py scripts/pre-rentree/document_audit.py scripts/pre-rentree/tests/test_visual_audit.py
git commit -m "feat: produce page-level visual QA evidence"
```

## Chunk 5: Atomic orchestration and final gates

### Task 12: Implement the single atomic build orchestrator

**Files:**
- Create: `scripts/pre-rentree/generate_documents.py`
- Create: `scripts/pre-rentree/tests/test_generate_documents.py`

- [ ] **Step 1: Write failing CLI and cleanup tests**

Require exact CLI syntax, explicit snapshot/output paths, successful public tree, suppressed private PDFs, temp cleanup, failure cleanup, no implicit cwd, and unchanged v4 hashes before/after.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement orchestration**

Create a temp sibling directory; copy snapshot/schema/generator/CSS/tests to `SOURCES/`; create public HTML/PDF/social files; create private block record and structural template source; run v4 audit and all artifact audits; write build/final reports and manifests; fsync; atomically move to the requested output.

- [ ] **Step 4: Verify GREEN**

```bash
pytest -q scripts/pre-rentree/tests/test_generate_documents.py
python scripts/pre-rentree/generate_documents.py \
  --snapshot generated/pre-rentree-2026-publication.snapshot.json \
  --output outputs-v5-canonical
```

- [ ] **Step 5: Commit**

```bash
git add scripts/pre-rentree/generate_documents.py scripts/pre-rentree/tests/test_generate_documents.py
git commit -m "feat: orchestrate atomic canonical document builds"
```

### Task 13: Enforce the complete contractual gate suite

**Files:**
- Modify: `__tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts`
- Modify: `scripts/pre-rentree/tests/test_document_audit.py`
- Modify: `scripts/pre-rentree/tests/test_generate_documents.py`

- [ ] **Step 1: Add failing named-counter assertions**

Require every mission counter and gate key, including module/session mismatches, source mapping, hardcoding, pricing/deposit label, schedule, contact, QR, legal policy, unapproved claims, visual defects, accessibility, manifest completeness, and PDF SHA recording.

- [ ] **Step 2: Verify RED for missing counters**

- [ ] **Step 3: Wire counters to actual evidence**

No counter may be a constant success value. Each is computed from source comparisons, rendered claim inventories, artifact scans, or visual evidence. `CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED` remains true from legal source detection.

- [ ] **Step 4: Verify GREEN**

Run targeted TypeScript and Python suites and inspect the generated final report.

- [ ] **Step 5: Commit**

```bash
git add __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts scripts/pre-rentree/tests
git commit -m "test: enforce canonical publication gates"
```

### Task 14: Fresh final verification and delivery report

**Files:**
- Generate: `outputs-v5-canonical/**`
- Create: `docs/audits/2026-07-18-pre-rentree-2026-v5-canonical.md`

- [ ] **Step 1: Rebuild from a clean v5 output path**

Run the snapshot compiler and orchestrator twice with the same declared build timestamp. Compare semantic PDF hashes and all non-timestamp artifacts; document any unavoidable PDF container variance rather than hiding it.

- [ ] **Step 2: Run focused full verification**

```bash
npm test -- --runInBand --runTestsByPath \
  __tests__/campaigns/pre-rentree-2026-publication-snapshot.test.ts \
  __tests__/campaigns/pre-rentree-2026.test.ts \
  __tests__/campaigns/pre-rentree-2026-structure.test.ts \
  __tests__/campaigns/pre-rentree-2026-public-claims.test.ts
pytest -q scripts/pre-rentree/tests
npm run typecheck
git diff --check
```

Expected: all task-specific tests pass; any unrelated repository baseline failure is recorded exactly.

- [ ] **Step 3: Inspect every generated page**

Open the contact sheets and representative original-resolution raster pages. Record all manual findings in `AUDIT/visual-qa-report.json` and do not set `VISUAL_DEFECT_COUNT=0` without page-by-page evidence.

- [ ] **Step 4: Verify delivery inventory and hashes**

Check exact public filenames, six HTML companions, three social variants, alt text, source snapshot/schema/generator/CSS/tests, audit matrix/diff/QA/accessibility/final reports, and build manifest entries.

- [ ] **Step 5: Write the factual repository audit report**

Use the required 20-section user return format and the repository `AGENTS.md` summary/checklist footer. Separate public owner-review readiness from private legal blocking.

- [ ] **Step 6: Commit all source and audit documentation, but do not push**

```bash
git add docs/audits/2026-07-18-pre-rentree-2026-v5-canonical.md
git commit -m "docs: report canonical pre-rentree v5 build"
```

- [ ] **Step 7: Report the allowed final status**

If all public gates pass, report `PDF_PACKAGE_READY_FOR_OWNER_REVIEW` for the public package and `BLOCKED_BY_LEGAL_TERMS` for the private dossier. Never report ready for distribution while the private dossier is blocked.
