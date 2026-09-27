# Core v2 Candidat Libre RAG Identity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an explicit Core v2 `CANDIDAT_LIBRE` schooling status and resolve it to the production RAG candidate identity without inferring it from generic `INDIVIDUAL` data.

**Architecture:** Extend the canonical Prisma enum additively with migration 0021; keep legacy/historical values untouched. Validate and display the new value only on existing authorized Core v2 staff enrollment create/edit paths, and map persisted enrollment status in the production-shaped RAG resolver. Verify the mapping and audience policy with unit, database migration, and disposable Core-v2-only identity tests.

**Tech Stack:** Prisma/PostgreSQL, TypeScript, Zod, Jest, Playwright/disposable E2E.

---

## Files to inspect/change

- `core-v2/prisma/schema.prisma` and `core-v2/prisma/migrations/0021_core_v2_candidat_libre_schooling_status/migration.sql`: Core v2 enum and additive migration only.
- `lib/aria/infrastructure/rag/production-academic-identity.ts`: authoritative persisted-status mapping.
- `lib/core-v2/services/enrollment.ts`, `app/api/v2/staff/enrollments{,/[id]/academic-map}/route.ts`, and `lib/core-v2/aria/conversation-context.ts`: persisted status validation and propagation into the canonical ARIA compatibility context.
- `components/dashboard/core-v2/{StudentsSection,EnrollmentCard,EnrollmentSummary}.tsx` and `components/dashboard/core-v2/api.ts`: staff create/edit/read form fields, retaining current RBAC.
- `__tests__/lib/aria/production-academic-identity.test.ts` and focused Core v2 enrollment tests: status mapping and rejection of arbitrary values.
- `e2e/auth/core-v2-aria-foundation.spec.ts` (or the existing disposable fixture helper): Core-v2-only persisted enrollment identity against production resolver-shaped code; no provider call.

## Chunk 1: Explicit status mapping and migration

- [ ] Add failing resolver tests for `SCHOOL_ENROLLED`, `CANDIDAT_LIBRE`, `INDIVIDUAL`, absent status, and incompatible audience.
- [ ] Verify the tests fail against current behavior.
- [ ] Add enum value to the Core v2 schema and additive SQL enum migration; do not update existing rows.
- [ ] Map only persisted `CANDIDAT_LIBRE` to `libre`; keep all unknown/unqualified states null.
- [ ] Regenerate Prisma clients and run focused resolver tests plus Prisma validation.

## Chunk 2: Authorized Core v2 enrollment forms and validation

- [ ] Add failing service/API tests proving canonical `CANDIDAT_LIBRE` is accepted and arbitrary strings are rejected.
- [ ] Add a French status selector to existing Core v2 staff enrollment create/edit forms and show the persisted value in staff enrollment summary.
- [ ] Extend the existing enrollment input schema; do not add a new route or broaden permissions.
- [ ] Run focused enrollment tests and TypeScript.

## Chunk 3: Disposable Core-v2-only identity proof

- [ ] Extend a disposable E2E/API fixture with only Core v2 user, student, annual enrollment (`CANDIDAT_LIBRE`), real grant, and compatible course.
- [ ] Assert production-shaped resolver returns a non-null identity with `candidat='libre'` and compatible audience/scope, without any model/provider call.
- [ ] Assert no V1 User/Student rows exist for that persona and incompatible corpus audience still fails closed.
- [ ] Run targeted disposable E2E/API and migration rehearsal against a fresh copy.

## Chunk 4: Qualification and PR

- [ ] Run Prisma validate, migration deploy on disposable DB, and schema/migration drift check.
- [ ] Run Core v2, ARIA identity, architecture, TypeScript, lint, coverage, targeted E2E, and production build.
- [ ] Create targeted PR #321 from `fix/core-v2-candidat-libre-rag-identity`; request fresh automated and human reviews.
- [ ] Merge only after all required checks and approvals succeed; record exact merge and main SHAs.
