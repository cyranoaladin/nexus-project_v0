const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-concurrency',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/concurrency/aria-*.test.ts'],
  maxWorkers: 1,
  testTimeout: 30_000,
  passWithNoTests: false,
});
