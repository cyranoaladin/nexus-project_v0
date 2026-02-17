/**
 * Jest Configuration — Real DB Integration Tests
 *
 * These tests run against a real PostgreSQL instance (docker-compose.test.yml).
 * They use Prisma directly (no mocks) to verify:
 *   - migrate deploy on a fresh DB
 *   - assessment submit → domain_scores insertion (canonical)
 *   - result API → cohort stats + percentile
 *   - FK constraints
 *   - LLM_MODE=off behavior
 *
 * Usage:
 *   docker compose -f docker-compose.test.yml up -d
 *   DATABASE_URL=postgresql://nexus_user:test_password_change_in_real_prod@localhost:5434/nexus_test \
 *     npx jest --config jest.config.db.js --runInBand
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  displayName: 'DB Integration Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/db/**/*.(test|spec).(js|ts)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.db.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@auth/prisma-adapter|next-auth|uuid|@paralleldrive/cuid2)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/.next/standalone/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  maxWorkers: 1,
  testTimeout: 30000,
};

module.exports = createJestConfig(customJestConfig);
