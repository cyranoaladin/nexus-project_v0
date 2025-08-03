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
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@auth/prisma-adapter|next-auth)/)',
  ],
};

module.exports = createJestConfig(customJestConfig);
