const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  // Limiter ce projet aux tests UI uniquement (les tests API/lib sont couverts par les autres projets)
  testMatch: [
    '**/__tests__/ui/**/*.(test|spec).(ts|tsx)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
    // Tests UI complexes couverts en E2E Playwright
    '<rootDir>/__tests__/ui/admin-tests.panel.test.tsx',
    '<rootDir>/__tests__/ui/eleve-ressources.test.tsx',
    '<rootDir>/.next/standalone/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
