const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-integration',
  setupFiles: ['<rootDir>/__tests__/setup/integration-env.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['<rootDir>/__tests__/integration/aria-*.test.ts'],
  testPathIgnorePatterns: ['\\.real\\.test'],
  passWithNoTests: false,
});
