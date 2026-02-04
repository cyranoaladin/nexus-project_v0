const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'Unit Tests',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '**/__tests__/lib/**/*.(test|spec).(js|ts|tsx)',
    '**/__tests__/components/ui/**/*.(test|spec).(js|ts|tsx)',
    '**/__tests__/ui/**/*.(test|spec).(js|ts|tsx)',
    '**/tests/**/*.(test|spec).(js|ts|tsx)',
    '**/.zenflow/**/*.(test|spec).(js|ts|tsx)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|glob|chokidar)/)',
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
