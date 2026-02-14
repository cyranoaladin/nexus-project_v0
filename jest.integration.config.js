const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Integration test config - uses real database
const customJestConfig = {
  displayName: 'integration',
  testEnvironment: 'node', // Use node environment for integration tests
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/integration/**/*.(test|spec).(js|ts)',
    '**/*.integration.(test|spec).(js|ts)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
  ],
  // Increase timeout for integration tests (database operations can be slow)
  testTimeout: 30000,
};

module.exports = createJestConfig(customJestConfig);
