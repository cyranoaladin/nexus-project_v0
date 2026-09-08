# Core v2 — design artifacts (not wired into the running app)

This directory holds the **proposed** Core v2 schema (`prisma/schema.prisma` here) for review. It is intentionally **not** referenced by the app's build, `prisma generate`, or any deploy step — the live app continues to use the repository-root `prisma/schema.prisma` exactly as before.

Related:
- `docs/architecture/adr/0001-core-v2-single-source-of-truth.md` — the decision record.
- `docs/audits/core-v2-canonical-architecture.md` — full audit report and mission checklist.
- `scripts/core-v2/generate-roster-candidates.ts` — real, runnable tool that classifies students against genuine contractual 2026-2027 signals (never account-creation recency alone). Read-only; writes nothing to any database.
- `scripts/core-v2/extract-to-core-v2.ts` — design-time skeleton for the eventual one-shot migration extractor. Deliberately throws `NOT_IMPLEMENTED` — it must not run until a roster is explicitly approved and each extraction function is implemented and reviewed separately.
- `__tests__/architecture/core-v2-legacy-guards.test.ts` — CI guards; the schema-shape checks are active today, the future-runtime checks are wired but vacuous until `app/api/v2/**`/`lib/core-v2/**` exist.

Nothing in this directory authorizes a production migration, a database creation, or a data deletion. It is a design/review artifact only.
