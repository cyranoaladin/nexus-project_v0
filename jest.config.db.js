/**
 * Jest Configuration — DB Integration Tests (serial)
 *
 * Runs against a real PostgreSQL instance.
 * All DB test suites run serially (maxWorkers: 1) to avoid shared DB contention.
 *
 * Usage:
 *   npm run test:db-integration
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'db-integration',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-fetch.js',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|framer-motion|geist)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|framer-motion|geist)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Without this, Jest's haste-map scans every git worktree under
  // .worktrees/ too and finds N duplicate "@prisma/client" manual mocks
  // with the same haste name — it then non-deterministically resolves
  // @prisma/client to whichever worktree's own node_modules/.prisma/client
  // it happens to pick, which can be missing models this worktree's schema
  // has (e.g. a model added here but not yet regenerated elsewhere).
  // jest.unit.config.js already excludes .worktrees/ for the same reason.
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/.worktrees/',
  ],
  testMatch: [
    '<rootDir>/__tests__/concurrency/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/database/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/db/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/transactions/**/*.test.(js|ts|tsx)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  maxWorkers: 1,
  testTimeout: 30000,
  ...(process.env.DB_TEST_ORDER
    ? { testSequencer: '<rootDir>/scripts/testing/db-order-sequencer.cjs' }
    : {}),
};

module.exports = createJestConfig(customJestConfig);
