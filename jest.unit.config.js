const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  roots: [
    '<rootDir>/__tests__',
    '<rootDir>/app',
    '<rootDir>/components',
    '<rootDir>/lib',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-fetch.js',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/__mocks__/@prisma/client.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
  ],
  testMatch: [
    '**/__tests__/**/*.test.(js|ts|tsx)',
    '**/*.test.(js|ts|tsx)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/nexus-src/',
    '<rootDir>/e2e/',
    '<rootDir>/__tests__/e2e/',
    '<rootDir>/__tests__/concurrency/',
    '<rootDir>/__tests__/database/',
    '<rootDir>/__tests__/db/',
    '<rootDir>/__tests__/transactions/',
    // Exclude integration/security real DB tests from unit job
    '\\.real\\.test\\.ts$',
    '<rootDir>/__tests__/integration/',
    '<rootDir>/__tests__/security/',
  ],
};

module.exports = createJestConfig(customJestConfig);
