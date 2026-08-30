# Candidate Living Languages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Arabe, Anglais, Espagnol, Italien, Russe et Allemand as distinct LVA/LVB choices throughout the internal candidate-individual workflow.

**Architecture:** Extend the persisted Prisma enum additively, centralize the supported-language contract in a pure shared helper, and consume it from UI and server validation. Existing diagnostic coverage stays fail-closed: unsupported diagnostic domains produce `NON_EVALUE` rather than invented scores.

**Tech Stack:** Next.js 14, React, TypeScript, Prisma/PostgreSQL, Jest/Testing Library, Playwright.

---

## Chunk 1: Contract and persistence

### Task 1: Add failing contract tests

**Files:**
- Create: `__tests__/lib/exams/languages.test.ts`
- Modify: `__tests__/lib/exams/profile-validation.test.ts`
- Modify: `__tests__/lib/exams/normalize.test.ts`

- [ ] Write tests asserting the exact six-language ordered list, labels, valid distinct pairs, invalid duplicate pairs, and rejection of non-language `Subject` values in LVA/LVB.
- [ ] Run the three targeted Jest files and confirm failures are caused by the missing contract/validation.

### Task 2: Extend the persistent enum

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260830150000_add_candidat_living_languages/migration.sql`
- Create: `lib/exams/languages.ts`
- Modify: `lib/exams/profile-validation.ts`
- Modify: `lib/quotes/profil-candidat.server.ts`
- Modify: `lib/quotes/candidat-individuel-api-schemas.ts` only if route-level validation can reuse the shared contract without duplicating it

- [ ] Add `ARABE`, `ITALIEN`, `RUSSE`, `ALLEMAND` to `Subject`.
- [ ] Add four idempotent `ALTER TYPE "Subject" ADD VALUE IF NOT EXISTS ...` statements only.
- [ ] Implement the canonical language list, French labels, language type guard, exact specialty whitelist and pure pair validator.
- [ ] Apply the language/specialty whitelists and pair validator before create/update persistence, not only during later simulation.
- [ ] Reject `PORTUGAIS`, non-language subjects in LVA/LVB, language subjects in specialties, and duplicate LVA/LVB with stable human-readable issues.
- [ ] Run `prisma generate`, then rerun targeted tests to green.

## Chunk 2: UI and humanized outputs

### Task 3: Add failing UI and output tests

**Files:**
- Modify: `__tests__/components/dashboard/assistante/CandidatIndividuelWorkspace.test.tsx`
- Modify: `__tests__/lib/exams/carte.test.ts`
- Modify: `__tests__/lib/quotes/pdf-adapter.server.test.ts`
- Modify: `__tests__/lib/quotes/public-view.server.test.ts`
- Modify: `__tests__/components/quotes/DevisTokenPage.test.tsx`
- Modify: `__tests__/lib/quotes/diagnostic.test.ts`
- Modify: `__tests__/api/assistante.candidat-individuel.route.test.ts`
- Create or modify: `__tests__/integration/profil-candidat-languages.real.test.ts`

- [ ] Test all six options in both selects.
- [ ] Test duplicate selection blocks continuation/save with a French error.
- [ ] Test Arabic/German/Italian/Russian labels in examination/PDF output.
- [ ] Test new languages remain `NON_EVALUE` when no real diagnostic domain exists.
- [ ] Test create/update route and real persistence reject forged invalid language/specialty payloads before any write.
- [ ] Run targeted tests and confirm expected red failures.

### Task 4: Wire the shared contract through the UI and outputs

**Files:**
- Modify: `components/dashboard/assistante/CandidatIndividuelWorkspace.tsx`
- Modify: `lib/quotes/exam-profile.ts`
- Modify: `lib/quotes/pdf-adapter.ts`
- Modify: `lib/quotes/pdf-adapter.server.ts`
- Modify: `lib/quotes/public-view.server.ts`
- Modify: `lib/quotes/candidat-individuel-staff-view.server.ts`
- Modify: `lib/exams/carte.ts`
- Modify: `lib/stages/public.ts`
- Modify: `app/devis/[token]/page.tsx`

- [ ] Replace local two-language filtering with the canonical six-language options.
- [ ] Disable or reject an LVB matching LVA and display a linked French validation message.
- [ ] Add exhaustive human-readable labels required by the expanded Prisma enum, including existing global maps that compile against `Record<Subject, ...>`.
- [ ] Carry `langueA`/`langueB` through staff/public/PDF profile adapters and render their French labels without internal codes.
- [ ] Render the concrete LVA/LVB labels in the actual family token page, not only in its server view model.
- [ ] Keep diagnostic mapping unchanged except for exhaustive typing.
- [ ] Audit every `Record<Subject, ...>`, switch and subject whitelist after Prisma generation; update only true Prisma `Subject` exhaustiveness sites and never add languages to commercial/specialty catalogues.
- [ ] Run all targeted tests to green.

## Chunk 3: Regression, E2E and release

### Task 5: Add browser regression coverage

**Files:**
- Modify: `e2e/auth/candidat-individuel-pipeline.spec.ts`

- [ ] Run six positive profiles: `ANGLAIS/ALLEMAND`, `ESPAGNOL/ITALIEN`, `ARABE/RUSSE`, `ALLEMAND/ANGLAIS`, `ITALIEN/ESPAGNOL`, `RUSSE/ARABE`.
- [ ] For every pair verify UI selection, POST payload, response, DB value, GET/reload restoration and absence of raw enum text.
- [ ] Generate staff PDFs for the first three pairs; publish the third and verify visible family-page and family-PDF language humanization.
- [ ] Add a seventh negative scenario covering duplicate in both directions, forged duplicate, `PORTUGAIS`, `MATHEMATIQUES` as language and `ARABE` as specialty, with no persistence or simulation.
- [ ] Capture desktop evidence for the language section and keep browser diagnostics at zero app-owned errors.
- [ ] Run the candidate-individual Chromium suite and confirm zero app-owned console errors.

### Task 6: Run release gates

**Files:**
- Modify only if contract expectations require it: `__tests__/architecture/t4-v1-release-freeze.test.ts`

- [ ] Run Prisma generate/validate and verify the migration SQL is exactly four additive enum values with no destructive statement.
- [ ] Run typecheck, lint, unit, DB, integration, V1 freeze, PR180 scanners, forbidden-artifact source scan, production build, artifact audit and candidate E2E.
- [ ] Commit and push the exact release SHA to `origin/release/candidat-individuel-prod` without force-pushing main.

### Task 7: Back up, migrate and deploy production

- [ ] Confirm the active release, SHA, `ACTIVE_INTERNAL`, migration count `87` and exactly one expected pending migration before mutation.
- [ ] Create a timestamped custom-format PostgreSQL dump and validate it with `pg_restore --list` without exposing secrets.
- [ ] Package a new immutable standalone release.
- [ ] Run `prisma migrate deploy`; confirm exactly one migration and the expected post-count `88`.
- [ ] Atomically switch the production symlink, restart only the targeted application process, and verify PM2/user/local/public health/RBAC/no 5xx.
- [ ] Keep `ACTIVE_PUBLIC` unavailable and record the rollback release.
- [ ] Before any rollback after migration, count profiles containing new enum values; use the old release only when the count is zero, otherwise stop and follow the forward-compatible recovery path.
