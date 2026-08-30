const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-unit',
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/lib/aria/**/*.test.ts',
    '<rootDir>/__tests__/components/aria/**/*.test.ts?(x)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/lib/aria/sse.test.ts',
    '\\.real\\.test',
  ],
  passWithNoTests: false,
});
