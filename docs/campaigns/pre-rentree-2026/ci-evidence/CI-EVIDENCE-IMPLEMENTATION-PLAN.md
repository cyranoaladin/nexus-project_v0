# PR #79 — CI evidence implementation plan

## Objective

Produce complete remote CI evidence without weakening Dependency Integrity and
without changing the Stage candidate or Bilan work.

## Steps

1. Capture the baseline DAG and the local PostgreSQL failure inventory.
2. Add source-level workflow contract tests and observe them fail against the
   baseline workflow.
3. Remove transitive `needs` edges from every evidence job.
4. Add an ephemeral PostgreSQL job for the three non-protected real-database
   suites.
5. Add a frozen-public-PDF verification job.
6. Make the final aggregator depend on every required job, run under
   `always()`, and accept only `success`.
7. Validate YAML syntax, the static contract, TypeScript, lockfile immutability,
   the expected audit failure, the path allowlist, and Bilan isolation.
8. Recheck the immutable PR #79 head, push without force, and open a stacked
   Draft PR targeting `release/pre-rentree-2026-public-ready`.
9. Observe the remote jobs to a bounded terminal state, record evidence, and
   leave both pull requests unmerged.

## Verification commands

```bash
npm ci
npx jest --config jest.unit.config.js --runInBand \
  __tests__/ci/pr79-ci-evidence.test.js
npm run typecheck
npm audit --audit-level=high
git diff --exit-code -- package.json package-lock.json
git diff --check
```

The complete npm audit is expected to remain red on the unchanged baseline.
That result is evidence that the dependency gate was not weakened.
