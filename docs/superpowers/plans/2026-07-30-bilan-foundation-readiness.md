# Bilan foundation readiness implementation plan

> **For Codex:** Follow test-driven development for every behavior change and
> preserve PostgreSQL/pgvector integration coverage.

**Goal:** Make PR #87 technically merge-ready without weakening security,
rewriting migrations or mixing the assessment engine into the foundation.

**Architecture:** Repair stale database fixtures against the current Prisma
contract, remediate reachable dependency risks first, and keep any residual
tooling risk behind an owner-approved, expiry-bound, exact-head decision.

**Base:** `053868b3237cd6cb89916255626720672a945330`

---

## Task 1: Restore the Student factory contract

**Files:**

- Create: `__tests__/db/test-database-factory.test.ts`
- Modify: `__tests__/setup/test-database.ts`

1. Add a real-DB regression test that creates a student through the shared
   factory and asserts the persisted canonical `gradeLevel`.
2. Run the isolated test against migrated PostgreSQL and record the missing
   `gradeLevel` failure.
3. Supply the smallest valid canonical default while preserving explicit
   overrides.
4. Run the isolated test again.

## Task 2: Remove the legacy pgvector column contract

**Files:**

- Modify: `__tests__/db/aria-pgvector.test.ts`
- Modify: `prisma/seed.ts`

1. Use the existing failing pgvector integration test as the red proof.
2. Insert only into columns present after
   `20260421083000_remove_embedding_legacy_column`.
3. Align the seed with the same schema contract.
4. Run the pgvector test against the real extension.

## Task 3: Verify the full database layer

1. Apply all 52 migrations to a fresh PostgreSQL/pgvector database with
   `prisma migrate deploy`.
2. Run `npm run test:db` with the same service contract as CI.
3. If a distinct failure becomes visible, diagnose it before changing an
   expectation and add a focused red regression test.
4. Run migration fresh and upgrade paths.
5. Write `docs/audits/2026-07-30-global-db-test-repair.md`.

## Task 4: Remediate dependency risks

**Files:**

- Modify as justified: `package.json`
- Modify mechanically: `package-lock.json`
- Create: `docs/security/2026-07-30-dependency-risk-report.md`
- Create if residual: `docs/security/2026-07-30-dependency-risk-decision-request.md`

1. Refresh machine-readable `audit`, production audit, outdated and dependency
   graph evidence.
2. Confirm each vulnerable path with `npm explain` and current registry
   metadata.
3. Patch the direct production dependency `mathlive`, then run its targeted
   tests, typecheck and build.
4. Test compatible patch/minor upgrades for tooling without forcing
   incompatible `brace-expansion` majors.
5. Inspect `.next/standalone` for vulnerable production dependencies.
6. Document corrected and residual risks, runtime reachability, expiry,
   compensating controls and removal plan.
7. Leave approver identity and approval decision blank.

## Task 5: Execute foundation gates

1. Run unit, integration, DB, E2E and Playwright suites.
2. Run pedagogy Python and TypeScript verification and compare corpus hashes.
3. Run lint, typecheck, build, Prisma validate/generate and repository security.
4. Run `npm audit` in full and production modes.
5. Confirm no test deletion, secret, public corpus copy, generated tracked
   artifact or feature-flag activation.
6. Write `docs/audits/2026-07-30-bilan-foundation-readiness.md`.

## Task 6: Prove reproducibility and publish the stacked draft

1. Commit focused database, dependency and documentation changes.
2. Check out the final SHA in a new detached clean worktree.
3. Run `npm ci` and repeat the essential gates.
4. Push without force.
5. Open a draft PR targeting
   `integration/bilan-pre-rentree-canonical-20260729`.
6. If a SHA-bound decision remains, publish the exact final head SHA in the PR
   metadata for owner action; do not create an approval or edit a secret.
7. Do not merge, deploy, migrate production or activate a feature flag.
