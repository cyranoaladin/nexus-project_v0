const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Companion of jest.core-v2.config.js for the few Core v2 suites that must run
// the REAL Auth.js handlers (`@/auth`): next-auth ships ESM, which the plain
// Core v2 lane deliberately does not transform. Same disposable-database
// rules, same serial execution; only the transform allowlist differs.
// Suites live in __tests__/core-v2-authjs/ so the plain lane never loads them.
const customJestConfig = {
  roots: ['<rootDir>/__tests__/core-v2-authjs'],
  setupFiles: ['<rootDir>/__tests__/setup/core-v2-token-env.js'],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|jose|oauth4webapi)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|jose|oauth4webapi)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/core-v2-authjs/**/*.real.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/', '<rootDir>/.artifacts/'],
  testTimeout: 30_000,
  maxWorkers: 1,
};

const resolveJestConfig = createJestConfig(customJestConfig);

module.exports = async () => ({
  ...(await resolveJestConfig()),
  // next/jest prepends its own node_modules ignore patterns; only replacing
  // the list lets the ESM allowlist take effect (same technique as
  // jest.unit.config.js).
  transformIgnorePatterns: customJestConfig.transformIgnorePatterns,
});
