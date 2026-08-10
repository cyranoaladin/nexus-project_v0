const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFiles: ['<rootDir>/__tests__/setup/integration-env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-fetch.js',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/integration/**/*.test.ts',
    '**/__tests__/security/**/*.test.ts',
    '**/*.real.test.ts',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
};

module.exports = createJestConfig(customJestConfig);
