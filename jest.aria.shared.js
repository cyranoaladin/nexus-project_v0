const nextJest = require('next/jest');

const createNextJestConfig = nextJest({ dir: './' });

const common = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-fetch.js',
  transformIgnorePatterns: [
    '/node_modules/(?!.pnpm)(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)/)',
    '/node_modules/.pnpm/(?!(next-auth|@auth|framer-motion|geist|lucide-react|@react-pdf|react-pdf)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/.worktrees/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/.worktrees/',
  ],
};

function createAriaJestConfig(overrides) {
  return createNextJestConfig({ ...common, ...overrides });
}

module.exports = { createAriaJestConfig };
