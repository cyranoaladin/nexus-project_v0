/**
 * Jest Configuration — GitHub governance tooling tests (offline only).
 *
 * No live `gh` calls: every test injects a fake gh client into
 * scripts/github/lib/gh.mjs's createGhClient(). See
 * npm run governance:audit:live / governance:snapshot for the real thing.
 *
 * Usage:
 *   npm run test:governance
 */
const customJestConfig = {
  displayName: 'governance',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/governance/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/.worktrees/'],
  maxWorkers: 1,
  testTimeout: 30000,
};

module.exports = customJestConfig;
