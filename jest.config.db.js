/**
 * Jest Configuration — DB Integration Tests (serial)
 *
 * Runs against a real PostgreSQL instance.
 * All DB test suites run serially (maxWorkers: 1) to avoid shared DB contention.
 *
 * Usage:
 *   npm run test:db-integration
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'db-integration',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-fetch.js',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|framer-motion|geist)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|framer-motion|geist)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/concurrency/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/database/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/db/**/*.test.(js|ts|tsx)',
    '<rootDir>/__tests__/transactions/**/*.test.(js|ts|tsx)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  maxWorkers: 1,
  testTimeout: 30000,
};

module.exports = createJestConfig(customJestConfig);
