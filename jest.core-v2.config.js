const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Dedicated, isolated Jest project for Core v2 (foundation §23). Deliberately
// does NOT reuse jest.setup.js / jest.integration.config.js: those carry
// Core v1 app concerns (rate-limit env, OpenAI key, jsdom/Next polyfills)
// that Core v2 — a plain Node/Postgres foundation with no runtime wiring —
// has no reason to depend on. Requires CORE_V2_DATABASE_URL to point at a
// disposable PostgreSQL database; never DATABASE_URL, never production.
const customJestConfig = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/core-v2/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
  testTimeout: 30_000,
  // All Core v2 test files share ONE disposable Postgres database and each
  // resets it in beforeEach — running test FILES in parallel would race
  // truncate-vs-insert across files. Force serial execution; individual
  // tests within a file remain ordinary Jest (still fast, this suite is
  // small by design).
  maxWorkers: 1,
};

module.exports = createJestConfig(customJestConfig);
