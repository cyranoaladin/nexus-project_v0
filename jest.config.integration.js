const { createDefaultPreset } = require('ts-jest');
const tsJestTransformCfg = createDefaultPreset().transform;

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.spec.(ts|tsx|js)', '**/*.integration.test.(ts|tsx|js)'],
  transform: { ...tsJestTransformCfg },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/lib/**/*.test.(ts|tsx)', '**/__tests__/api/**/*.test.(ts|tsx)'],
  setupFiles: ['./__tests__/setup/dotenv-config.ts'],
  setupFilesAfterEnv: ['./jest.setup.integration.js', './__tests__/setup/test-database.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
