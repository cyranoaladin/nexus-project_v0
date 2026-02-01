const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'Integration Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/api/**/*.(test|spec).(js|ts)',
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
