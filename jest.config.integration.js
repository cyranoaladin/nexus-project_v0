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
};

module.exports = createJestConfig(customJestConfig);
