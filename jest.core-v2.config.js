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
  roots: ['<rootDir>/__tests__/core-v2'],
  setupFiles: ['<rootDir>/__tests__/setup/core-v2-token-env.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/core-v2/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/.worktrees/'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/', '<rootDir>/.artifacts/'],
  testTimeout: 30_000,
  // All Core v2 test files share ONE disposable Postgres database and each
  // resets it in beforeEach — running test FILES in parallel would race
  // truncate-vs-insert across files. Force serial execution; individual
  // tests within a file remain ordinary Jest (still fast, this suite is
  // small by design).
  maxWorkers: 1,
};

const resolveJestConfig = createJestConfig(customJestConfig);
module.exports = async () => ({
  ...(await resolveJestConfig()),
  // next/jest prepends its own blanket node_modules ignore pattern, so the ESM
  // allowlist cannot simply be appended. Suites that drive the REAL Auth.js
  // pipeline (cookie -> jwt callback -> session; e.g.
  // http/core-only-session-revocation.test.ts) must be able to load next-auth,
  // @auth/core and their ESM-only dependencies. Same allowlist as
  // jest.unit.config.js; nothing else is transformed.
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|jose|oauth4webapi|preact|preact-render-to-string)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|jose|oauth4webapi|preact|preact-render-to-string)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
});
