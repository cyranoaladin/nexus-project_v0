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
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/app/api/payments/',
    '<rootDir>/lib/scoring/',
    '<rootDir>/lib/aria/orchestrator.ts',
  ],
  collectCoverageFrom: [
    // Mesurer côté serveur/API et libs, mais exclure les paiements (hors périmètre default)
    'app/api/**/*.ts',
    '!app/api/payments/**',
    'lib/**/*.{ts,tsx}',
    // Exclusions connues de faible valeur pour la couverture globale
    '!lib/aria/services.ts',
    '!lib/aria/orchestrator.ts',
    '!lib/scoring/**',
  ],
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
