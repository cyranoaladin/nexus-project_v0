# Canonical bilan / pre-rentree integration implementation plan

> **For Codex:** Follow test-driven development for every production-code
> change and run the named verification after each task.

**Goal:** Expose the canonical pre-rentree corpus through one validated
server-only boundary and make the bilan catalogue depend on that boundary
without implementing the deferred assessment engine.

**Architecture:** A filesystem-backed adapter under
`lib/pre-rentree/pedagogy/` parses and validates the canonical catalog,
manifest and CPS files. It produces immutable domain definitions and enforces
publication and manual-grading gates. `lib/bilans/catalog` adapts these domain
definitions instead of adapting legacy TypeScript diagnostics.

**Tech stack:** TypeScript, Zod, `yaml`, Node `fs`/`crypto`, Jest, Prisma,
Python/Pytest pedagogical validators.

---

## Task 1: Specify the catalog contract with failing tests

**Files:**

- Create: `__tests__/lib/pre-rentree/pedagogy/catalog.test.ts`
- Create: `__tests__/lib/pre-rentree/pedagogy/manual-grading.test.ts`

1. Add tests for 17 modules, 85 sessions, 17 CPS, 141 nodes, 136 evaluated
   nodes, 408 items and 33 manual responses.
2. Add tests for stable module/session/assessment references and defensive
   immutability.
3. Add negative tests for an unknown ID, `seconde-physique-chimie`, a
   mismatched hash/version, an inconsistent module relationship and public or
   assignment use of `HUMAN_VALIDATION_REQUIRED`.
4. Add tests proving an ungraded short response yields
   `EN_ATTENTE_CORRECTION_MANUELLE`, is not counted false and blocks final
   score, group calibration and final report.
5. Run the tests and confirm they fail because the boundary does not exist.

## Task 2: Implement the server-only pedagogy boundary

**Files:**

- Create: `lib/pre-rentree/pedagogy/types.ts`
- Create: `lib/pre-rentree/pedagogy/schemas.ts`
- Create: `lib/pre-rentree/pedagogy/catalog.ts`
- Create: `lib/pre-rentree/pedagogy/manual-grading.ts`
- Create: `lib/pre-rentree/pedagogy/index.ts`

1. Define `PedagogyCatalog`, `ModuleDefinition`, `SessionDefinition`,
   `AssessmentDefinition`, `AssessmentDefinitionRef`, `ContentVersion` and
   `ContentPublicationStatus`.
2. Define strict Zod schemas for the consumed portions of `modules.json`,
   `manifest.yaml` and CPS files.
3. Load only allowlisted repo-relative source paths, verify SHA-256 hashes,
   validate all cross-file relations and derive counts from the sources.
4. Expose explicit internal-review, assignment and publication lookups with
   fail-closed publication rules.
5. Implement the manual-grading state evaluator and finalization assertions.
6. Run the new tests, typecheck and lint on the new files.

## Task 3: Remove the duplicate default bilan catalog

**Files:**

- Modify: `lib/bilans/catalog/service.ts`
- Delete: `lib/bilans/catalog/fixtures/maths-nsi.v1.ts`
- Modify: `__tests__/lib/bilans/catalog/service.test.ts`

1. Add a failing test proving the default catalog is derived from
   `PedagogyCatalog` and all canonical packs remain unpublished.
2. Preserve dependency injection for validation-focused pack tests.
3. Replace the legacy Maths/NSI adapter with an adapter over the canonical
   boundary and map the canonical immutable reference into existing provenance
   fields.
4. Confirm unsupported selections and review-required selections remain
   distinguishable.
5. Run catalog, lifecycle and provenance tests.

## Task 4: Reconcile persistence and configuration

**Files:**

- Verify: `prisma/schema.prisma`
- Verify: `prisma/migrations/20260729_add_canonical_bilan_requests/migration.sql`
- Modify if needed: `.env.example`

1. Confirm existing attempt provenance can store definition ID, version and
   checksum without copying corpus content.
2. Do not add assessment-engine tables or edit an applied migration.
3. Centralize the existing feature flags and Redis/Upstash variables in
   `.env.example` without values that are secrets.
4. Run fresh and upgrade migration tests, `prisma validate` and
   `prisma generate`.

## Task 5: Document governance, migration and activation

**Files:**

- Create: `docs/adr/006-bilan-pre-rentree-pedagogy-catalog-boundary.md`
- Modify: `docs/campaigns/pre-rentree-2026/pedagogy/SOURCE-OF-TRUTH.md`
- Create: `docs/runbooks/bilan-api-v1-activation.md`
- Create: `docs/audits/2026-07-29-bilan-pre-rentree-coverage-matrix.md`
- Create: `docs/audits/2026-07-29-bilan-canonical-migration-report.md`
- Create: `docs/audits/2026-07-29-bilan-pre-rentree-integration.md`

1. Record the source/state separation, immutable references, publication
   authority and manual-grading gate.
2. Record the complete overlap matrix and every resolution.
3. Record migration compatibility, activation order, rollback and variables.
4. Name every deferred or blocked capability with owner, priority and
   acceptance criterion.

## Task 6: Run complete convergence gates

1. Run targeted bilan API/auth/IDOR/idempotence/rate-limit suites.
2. Run real PostgreSQL intake/magic-link concurrency and migration suites.
3. Run the catalog and manual-grading suites.
4. Run `npm run pre-rentree:pedagogy:verify`, targeted and full Python tests,
   and the TypeScript pre-rentree suite.
5. Run `npm run test -- --runInBand --silent`, `npm run typecheck`,
   `npm run lint`, `npm run build`, `npx prisma validate`,
   `npx prisma generate`, `npm run security:repo` and repository hygiene
   checks.
6. Compare database-suite failures to the documented `origin/main` baseline.
7. Confirm no deleted/disabled tests, tracked generated artifact, public corpus
   file, secret, absolute workstation path or Physique-Chimie Seconde module.

## Task 7: Prove reproducibility and publish the draft

1. Commit focused implementation, documentation and test changes.
2. Check out the final SHA in a new detached temporary worktree.
3. Install dependencies reproducibly and repeat the essential gates.
4. Review the complete diff against `origin/main`.
5. Push the integration branch without force and open a draft PR to `main`.
6. Do not merge, deploy, migrate production or activate a feature flag.
