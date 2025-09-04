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
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transformIgnorePatterns: [
    '/node_modules/(?!(whatwg-fetch)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/apps/web/lib/minio$': '<rootDir>/tests/mocks/minio.helper.mock.js',
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/app/api/payments/',
    '<rootDir>/lib/scoring/',
    '<rootDir>/lib/aria/orchestrator.ts',
    '<rootDir>/lib/aria/services.ts',
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
    './app/api/aria/chat/route.ts': { branches: 95, functions: 95, lines: 95, statements: 95 },
    './lib/aria/**': { branches: 95, functions: 95, lines: 95, statements: 95 },
    './apps/web/server/bilan/**': { branches: 95, functions: 95, lines: 95, statements: 95 },
    './lib/credits.ts': { branches: 95, functions: 95, lines: 95, statements: 95 },
    './apps/web/server/vector/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './apps/web/lib/storage.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './app/api/rag/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './app/api/bilan/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};

module.exports = createJestConfig(customJestConfig);
