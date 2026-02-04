const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'Zenflow Tests',
  testEnvironment: 'node',
  testMatch: [
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
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
