const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-db',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/__tests__/database/aria-*.test.ts',
    '<rootDir>/__tests__/db/aria-*.real.test.ts',
  ],
  maxWorkers: 1,
  testTimeout: 30_000,
  passWithNoTests: false,
});
