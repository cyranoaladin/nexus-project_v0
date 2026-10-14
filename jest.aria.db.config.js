const { createAriaJestConfig } = require('./jest.aria.shared');

const resolveJestConfig = createAriaJestConfig({
  displayName: 'aria-db',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/jest.setup.aria.real-db.js',
  ],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/database/aria-*.test.ts',
    '<rootDir>/__tests__/db/aria-*.real.test.ts',
  ],
  maxWorkers: 1,
  testTimeout: 30_000,
  passWithNoTests: false,
});
// The real encrypted cookie regressions load Auth.js and its ESM dependencies.
// next/jest adds a blanket node_modules ignore; replace it after resolution.
module.exports = async () => ({
  ...(await resolveJestConfig()),
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|jose|oauth4webapi|preact|preact-render-to-string)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|jose|oauth4webapi|preact|preact-render-to-string)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
});
