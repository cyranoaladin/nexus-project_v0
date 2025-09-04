const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/', '<rootDir>/__tests__'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/lib/**/*.test.(ts|tsx)', '**/__tests__/api/**/*.test.(ts|tsx)'],
  setupFiles: ['./__tests__/setup/dotenv-config.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/test-database.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^minio$': '<rootDir>/__tests__/mocks/minio.ts',
    '^@/apps/web/lib/minio$': '<rootDir>/tests/mocks/minio.helper.mock.js',
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/lib/aria/services.ts', // client réseau testé en E2E/intégration
    '<rootDir>/apps/web/server/vector/embeddings.ts', // couvert par tests dédiés/fake ou E2E
    '<rootDir>/apps/web/lib/storage.ts', // accès I/O simulés ailleurs
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
