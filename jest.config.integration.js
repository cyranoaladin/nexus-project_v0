const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/api/**/*.(test|spec).(js|ts)',
    '**/__tests__/concurrency/**/*.(test|spec).(js|ts)',
    '**/__tests__/transactions/**/*.(test|spec).(js|ts)',
    '**/__tests__/database/**/*.(test|spec).(js|ts)',
    '**/__tests__/middleware/**/*.(test|spec).(js|ts)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@auth/prisma-adapter|next-auth)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/.next/standalone/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // Run integration tests serially to avoid database conflicts
  maxWorkers: 1,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
