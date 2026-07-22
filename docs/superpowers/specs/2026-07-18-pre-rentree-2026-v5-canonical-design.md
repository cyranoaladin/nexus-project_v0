# Pré-rentrée 2026 v5 Canonical — Design

## Date

2026-07-18

## Objective

Rebuild the Pré-rentrée 2026 document package from repository sources of truth at an exact `origin/main` commit, with a single validated publication snapshot, one document renderer, accessible HTML companions, reproducible provenance, exhaustive content contracts, and explicit legal publication gating.

This design does not update production, overwrite the local v4 artifacts, push a branch, or publish unapproved contractual terms.

## Baseline

- Canonical repository: `https://github.com/cyranoaladin/nexus-project_v0`
- Source commit captured on 2026-07-18: `a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0`
- Isolated clone: `canonical-repo-a1192c8d`
- Local v4 artifacts remain outside the clone in `../outputs/`.
- Output root inside the clone: `outputs-v5-canonical/`.
- Canonical commercial terms reference in the campaign points to `docs/legal/pre-rentree-2026-commercial-terms-gap-analysis.md`, but that file is absent at the captured commit.

The absent legal source means private contractual PDFs must not be produced. Structural private templates may be implemented and tested, but their publication gate must remain closed.

## Canonical inputs

The compiler reads only repository files and explicit CLI inputs. It must not scrape rendered HTML, Next.js chunks, or production.

Required inputs:

- `data/campaigns/pre-rentree-2026.json`
- `content/pre-rentree-2026/modules.json`
- `data/pricing.canonical.json`, accessed through the repository pricing loader where practical
- `lib/legal.ts`
- the canonical WhatsApp configuration helper and campaign contact configuration
- the campaign-referenced commercial terms file, if it exists and validates as approved
- approved project logos and project-owned font files
- the local v4 generator and seven local v4 PDFs, read-only, for provenance and comparison

## Selected architecture

The implementation uses a TypeScript compiler and a Python renderer.

1. A TypeScript CLI loads and validates campaign, module, pricing, contact, legal, asset, and optional commercial-terms inputs.
2. It derives all display-ready business data and writes one JSON publication snapshot that conforms to a checked-in JSON Schema and runtime Zod schema.
3. A Python orchestrator accepts only the snapshot path and output root for business content. It renders accessible HTML documents, public PDFs, social visuals, and audit files in a temporary build directory.
4. Automated contract, PDF, accessibility, QR, and visual checks run against the temporary build.
5. Successful public outputs are atomically moved into `outputs-v5-canonical/`. A failed gate leaves no partial publishable package and writes a factual blocked result.

The renderer must not import the campaign, modules, pricing, legal, or contact sources directly. The snapshot is its only business-data input.

## Repository layout

The implementation is grouped by responsibility:

- `scripts/pre-rentree/build-publication-snapshot.ts`: CLI entrypoint and snapshot compilation orchestration.
- `scripts/pre-rentree/publication-snapshot-schema.ts`: Zod contract and exported TypeScript types.
- `scripts/pre-rentree/publication-snapshot.schema.json`: portable JSON Schema.
- `scripts/pre-rentree/publication-sources.ts`: explicit path resolution, source loading, hashing, and legal approval detection.
- `scripts/pre-rentree/publication-derivations.ts`: pure schedule, pricing, module, CTA, room-label, and publication-mode derivations.
- `scripts/pre-rentree/audit-v4.py`: read-only v4 PDF extraction and claim-matrix production.
- `scripts/pre-rentree/generate_documents.py`: single public CLI orchestrator.
- `scripts/pre-rentree/document_renderer.py`: rendering functions that receive snapshot objects only.
- `scripts/pre-rentree/document_templates.py`: semantic HTML builders and private structural template.
- `scripts/pre-rentree/document_assets.py`: fonts, logo, QR, social image, and asset verification.
- `scripts/pre-rentree/document_audit.py`: PDF, accessibility, blocked-term, provenance, and manifest checks.
- `scripts/pre-rentree/templates/document.css`: deterministic paged and accessible-screen CSS.
- `scripts/pre-rentree/requirements.lock`: exact Python dependencies used by the document build.
- `__tests__/pre-rentree-publication-snapshot.test.ts`: source and snapshot contracts.
- `scripts/pre-rentree/tests/`: Python renderer, audit, and atomic-build tests.
- `outputs-v5-canonical/`: generated delivery tree, ignored by application imports and not used by production.

## Publication snapshot

The snapshot contains no PII and is sufficient to render every document without consulting another business source.

Required sections:

- provenance: repository SHA, source versions, source paths, and SHA-256 hashes;
- campaign: id, version, school year, timezone, publication mode, canonical URL, dates, no-class dates, and decision deadline;
- levels, entry-level semantics, subjects, label-by-level, public room labels, capacity, blocks, week schedule, and expanded sixty-session schedule;
- academic profiles for Seconde, Première, and Terminale;
- four canonical packs with subject count, hours, price, deposit, balance, and price per hour;
- twelve canonical modules with prerequisites, differentiation, quick assessment, and five verbatim sessions containing title, objective, topics, method, and deliverable;
- campaign method, practical notices, subject materials, public pre-registration claims, CTA, contact, and approved public claims;
- legal source status, terms metadata when approved, private-publication permission, and a precise publication-block reason otherwise;
- approved asset identifiers and font identifiers;
- document metadata shared by all renderers.

Derived values such as balances, expanded dates, display labels, canonical absolute URL, QR target, pack selection from subject count, and publication mode are created in the compiler and tested against their sources. They are not repeated in the renderer.

`PRE_REGISTRATION_ONLY` is a publication-mode derivation from the campaign status, pre-registration feature flag, disabled payment flag, and canonical notices. The internal source token `PRE_REGISTRATION_OPEN` is never exposed in public outputs.

## Public claim policy

Every public assertion must map to a specific canonical JSON or TypeScript source path. The snapshot stores approved public claims as records with stable IDs, text, claim type, and source reference.

Public contractual language is limited to the campaign manifest:

- pre-registration without payment;
- no place reserved;
- no contract formed;
- confirmation after administrative and pedagogical validation;
- applicable conditions communicated before confirmation;
- groups of three to five;
- group-opening decision on 10 August at 18:00.

No detailed cancellation, absence, refund, credit, force-majeure, teacher-unavailability, annual benefit, or general report policy is published unless an approved legal source exists and explicitly supplies it.

The public CTA is compiled as `Se pré-inscrire ou demander un conseil` for this publication package. The snapshot records its campaign source and the owner mission rule that narrows it to a non-transactional public CTA.

## Canonical programs

The twelve program modules are emitted directly from `modules.json`. Session text is HTML-escaped but not editorially paraphrased.

Each module displays:

- title and subtitle;
- prerequisites;
- differentiation;
- quick assessment;
- all five sessions;
- session title, objective, topics, method, and deliverable.

All program brochures also display the approved adaptation notice from the mission:

> Le programme et le niveau des exercices sont adaptés au profil déclaré et à la composition pédagogique du groupe.

The compiler and tests enforce Seconde SNT wording, Première profile distinctions, Terminale retained specialties and maths options, theoretical/methodological Physique-Chimie wording, and the absence of default filmed-oral wording.

## Pricing

The four packs are selected through campaign `packProductIds` and canonical pricing data. The displayed label is `Acompte`, never `Acompte (30 %)`. The compiler verifies price, deposit, balance, total hours, and price per hour before including a pack.

Amounts are represented as integers in the snapshot. Formatting into French grouped amounts is a generic renderer utility tested independently. Each amount is rendered in a non-breaking, no-wrap component.

## Public documents

The public package contains:

- Essentiel;
- Planning;
- Programme Seconde;
- Programme Première;
- Programme Terminale;
- Tarifs;
- social feed, story, black-and-white flyer, and associated alt text.

Each public PDF has an accessible HTML equivalent. All formats use the same renderer and snapshot.

The planning uses a central subject palette and a non-color abbreviation for every subject. It contains tables by entry class and week, with public room labels only.

Programs use a subject band, visible prerequisites and differentiation, a stable hierarchy, a sufficiently wide first column, and non-splitting rows.

Pricing uses the second page for approved pre-registration modalities and avoids an intentionally empty page.

Every public document includes page number, document version, edition date, campaign id, `PUBLIC`, abbreviated repository SHA, canonical URL, and canonical contact.

## Private structural dossier

The source tree includes a confirmation-dossier structure and a prefilled accessible HTML form model. It is labelled:

`Dossier de confirmation d’inscription`

with the cover notice:

`À utiliser uniquement après validation administrative et pédagogique du groupe.`

The model includes dossier identifiers, campaign metadata, student/family identifiers, entry class, canonical profiles, subjects, module IDs, slots, dates, derived pack, canonical amounts, exact due date, payment reference, validator, confirmation status, safety contacts, strictly necessary needs, and four distinct consents.

Pack choice is computed from selected subject count and cannot be independently selected.

The form model uses explicit fields, radio controls for yes/no, numeric fields for monetary values, validation constraints, and an intentional tab order.

The privacy notice model is versioned and has fields for controller, purposes, legal basis and required/optional status, recipients, duration, rights, contact, and version. The compiler does not invent missing privacy policy values.

Because approved commercial terms are absent, the HTML/PDF private render commands must exit with a legal-block status. The delivery manifest records `CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED=true`; no private PDF is placed in `PRIVATE/`.

## Rendering and deterministic build

`python generate_documents.py --snapshot <path> --output <path>` is the only document-generation entrypoint.

The CLI:

- resolves paths from its own file location or explicit arguments, never implicit `process.cwd`;
- validates the snapshot before rendering;
- escapes all untrusted text and validates URLs;
- uses project-owned deterministic fonts;
- creates the QR from the snapshot canonical URL and verifies the decoded target;
- creates all outputs in a temporary sibling directory;
- removes temporary files on failure;
- atomically replaces only the v5 output directory after successful public gates;
- never reads `schedule_data.json` or scraped data;
- fixes creation timestamps through a declared build timestamp/source-date epoch for reproducibility;
- records tool and dependency versions.

The generated tree is:

```text
outputs-v5-canonical/
  PUBLIC/
  PRIVATE/
  SOURCES/
  AUDIT/
```

`PRIVATE/` contains only a blocked-status notice and no PDF while legal approval is missing.

## Baseline and claim audit

The v4 manifest hashes:

- four canonical source families;
- every legal source that exists;
- approved logos and fonts used by v4/v5;
- the v4 generator and separate Essentiel HTML pipeline;
- the seven v4 PDFs.

The exhaustive claim matrix is generated from extracted v4 PDF text plus a maintained claim-classification rule set. Each row records document, page, claim, claim type, canonical source, canonical value, match, severity, and action.

Because automated natural-language classification cannot prove every arbitrary sentence, the build also produces a public claim inventory from the v5 semantic templates. Its count must equal the set of source-mapped snapshot claims. The final `UNMAPPED_PUBLIC_CLAIM_COUNT=0` gate applies to v5 public outputs; unmatched v4 claims remain recorded as removed or corrected findings.

## Testing

Tests are written before implementation behavior using red-green-refactor cycles.

TypeScript contracts verify:

- exact source versions and SHA capture;
- twelve modules and sixty sessions;
- exact module/session field equality;
- expanded schedule equality;
- exact packs, prices, deposits, balances, and hourly rates;
- contact and canonical URL equality;
- legal source state and publication blocking;
- snapshot schema validity;
- source mapping for every public claim.

Python tests verify:

- no business-value literals in renderer/template source;
- HTML escaping and safe URL handling;
- amount formatting and no-wrap markup;
- pack derivation from subject count;
- blocked terminology;
- public/private routing;
- QR generation and decoding;
- temp cleanup and atomic output;
- deterministic repeated builds.

Artifact checks verify:

- PDF metadata, language, fonts, links, QR, pages, dimensions, file size, extractable text, no secrets, and no test PII;
- HTML language, headings, table headers, reading order, links, contrast, minimum type size, selectable text, and form semantics;
- page rasterization at 200 DPI, per-page checksums, contact sheets, comparison with v4, and automated overlap/cutoff heuristics;
- a visual QA report with explicit human-review fields when a defect cannot be decided reliably by automation.

The final package status may be `PDF_PACKAGE_READY_FOR_OWNER_REVIEW` for the public package only. It is never described as ready for distribution while the private dossier is legally blocked.

## Error handling and statuses

The build fails closed for source drift, unknown module IDs, inconsistent sessions, pricing mismatch, schedule mismatch, contact mismatch, missing assets, QR mismatch, unmapped public claims, unapproved contractual claims, reproducibility failure, accessibility failure, or visual failure.

The final report selects one or more allowed statuses and separates public readiness from private blocking. With the current legal source state, `BLOCKED_BY_LEGAL_TERMS` is mandatory for the private dossier even if the public package reaches owner-review quality.

## Non-goals

- No production change or deployment.
- No source scraping.
- No campaign, module, pricing, contact, or legal business value added to renderer code.
- No publication of absent or draft legal terms.
- No push or pull request without owner validation.
- No overwrite or mutation of v4 files.

## Rollback

All implementation work is isolated on a local branch and all generated files are contained in `outputs-v5-canonical/`. Rollback consists of deleting that output directory and abandoning the local branch or detached clone. The original v4 directory is unaffected.
