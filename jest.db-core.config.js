/**
 * Jest Configuration — Core real-database suites (serial)
 *
 * `jest.config.db.js` collects every suite under `__tests__/concurrency`,
 * `__tests__/database`, `__tests__/db` and `__tests__/transactions`. The ARIA
 * half of that set (every `aria-*` file) already runs in CI through the
 * disposable harness lanes `test:aria:db` and `test:aria:concurrency`, which
 * provide a runtime those suites need and a plain jest invocation cannot.
 *
 * The other half — the credit/booking concurrency suites, the schema and
 * migration contracts, the payment rollback suites and, above all, the three
 * `*-delete-restrict.db.test.ts` guards that hold the "real account history
 * must not disappear through a cascade delete" invariant — was collected by no
 * configuration any workflow invoked. It therefore gated nothing.
 *
 * This configuration is that missing half, and `.github/workflows/ci.yml`
 * runs it as a required job. `scripts/testing/check-ci-test-lane-coverage.mjs`
 * proves no suite falls outside every lane again.
 */

const baseConfigFactory = require('./jest.config.db.js');

module.exports = async () => {
  const base = await baseConfigFactory();

  return {
    ...base,
    displayName: 'db-core',
    // Written out rather than hidden behind a constant: the zero-test-debt
    // check reads this initializer as source text, and a guard that inspects
    // an identifier instead of the pattern it stands for inspects nothing.
    testPathIgnorePatterns: [
      ...(base.testPathIgnorePatterns ?? []),
      '<rootDir>/__tests__/(concurrency|database|db)/aria-',
    ],
  };
};
