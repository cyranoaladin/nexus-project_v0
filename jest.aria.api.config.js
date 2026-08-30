const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-api',
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/__tests__/api/aria*.test.ts'],
  passWithNoTests: false,
});
