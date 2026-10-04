const { createAriaJestConfig } = require('./jest.aria.shared');

module.exports = createAriaJestConfig({
  displayName: 'aria-sse',
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/lib/aria/sse.test.ts',
    '<rootDir>/__tests__/lib/aria/sse-terminal-drain.test.ts',
    '<rootDir>/__tests__/lib/aria/native-response-reader.test.ts',
  ],
  passWithNoTests: false,
});
