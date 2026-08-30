const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-coverage',
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/lib/aria/**/*.test.ts',
    '<rootDir>/__tests__/components/aria/**/*.test.ts?(x)',
    '<rootDir>/__tests__/api/aria*.test.ts',
    '<rootDir>/__tests__/integration/aria-*.test.ts',
    '<rootDir>/__tests__/architecture/aria-*.test.ts',
    '<rootDir>/__tests__/scripts/aria/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['\\.real\\.test'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/lib/aria/**/*.ts',
    '<rootDir>/app/api/aria/**/*.ts',
    '<rootDir>/components/aria/**/*.tsx',
    '<rootDir>/components/aria/**/*.ts',
    '<rootDir>/scripts/aria/**/*.ts',
    '!<rootDir>/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/.artifacts/aria/coverage',
  coverageReporters: ['json-summary', 'text'],
  passWithNoTests: false,
});
