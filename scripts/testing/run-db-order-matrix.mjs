#!/usr/bin/env node

import { createRequire } from 'module';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const {
  DEFAULT_SEED,
  EXPECTED_DB_SUITES,
  orderedSuitePaths,
} = require('./db-order-sequencer.cjs');

const EXPECTED_MIGRATIONS = 88;
const EXPECTED_TESTS = 211;
const JEST_LANE_TIMEOUT_MS = 5 * 60_000;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(rootDir, '.env.test') });
const migrateOnly = process.argv.includes('--migrate-only');

function fail(message) {
  process.stderr.write(`DB order matrix failed: ${message}\n`);
  process.exit(1);
}

function resolveLocalComposeDatabaseUrl() {
  const compose = spawnSync(
    'docker',
    [
      'compose', '-f', 'docker-compose.test.yml', 'exec', '-T', 'postgres-test',
      'sh', '-c',
      'printf "postgresql://%s:%s@127.0.0.1:5434/%s?schema=public" "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$POSTGRES_DB"',
    ],
    { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  if (compose.status !== 0 || !compose.stdout) {
    fail('could not resolve the local disposable database configuration');
  }
  return compose.stdout;
}

const databaseUrl = process.env.TEST_DATABASE_URL
  || process.env.DATABASE_URL
  || (process.env.DB_MATRIX_USE_LOCAL_COMPOSE === '1' ? resolveLocalComposeDatabaseUrl() : undefined);

if (process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
  fail('NEXUS_DISPOSABLE_POSTGRES must equal 1');
}
if (!databaseUrl) fail('TEST_DATABASE_URL or DATABASE_URL is required');
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '');
if (
  parsedDatabaseUrl.protocol !== 'postgresql:'
  || !['127.0.0.1', 'localhost'].includes(parsedDatabaseUrl.hostname)
  || !/^nexus_disposable_(?:[a-z0-9]+_)*test$/.test(databaseName)
) {
  fail('database URL is not a local disposable PostgreSQL database');
}

if (migrateOnly) {
  const prismaBin = path.join(rootDir, 'node_modules/.bin/prisma');
  const migration = spawnSync(prismaBin, ['migrate', 'deploy'], {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (migration.status !== 0) fail(`migration setup exited with ${migration.status}`);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
async function appliedMigrationCount() {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::integer AS count
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  return rows[0]?.count;
}

const migrationCountBefore = await appliedMigrationCount();
if (migrationCountBefore !== EXPECTED_MIGRATIONS) {
  await prisma.$disconnect();
  fail(`expected ${EXPECTED_MIGRATIONS} applied migrations, received ${migrationCountBefore}`);
}
await prisma.$disconnect();
if (migrateOnly) {
  process.stdout.write(`DB_MIGRATIONS_APPLIED_ONCE=${migrationCountBefore}\n`);
  process.exit(0);
}

const jestBin = require.resolve('jest/bin/jest');
const sequencerPath = path.join(rootDir, 'scripts/testing/db-order-sequencer.cjs');
const resultDir = mkdtempSync(path.join(tmpdir(), 'nexus-db-order-matrix-'));
const lanes = [
  { mode: 'normal', seed: DEFAULT_SEED },
  { mode: 'reverse', seed: DEFAULT_SEED },
  { mode: 'seeded', seed: DEFAULT_SEED },
];

try {
  for (const { mode, seed } of lanes) {
    const resultFile = path.join(resultDir, `${mode}.json`);
    const run = spawnSync(
      process.execPath,
      [
        jestBin,
        '--config', 'jest.config.db.js',
        '--runInBand',
        '--ci',
        '--no-cache',
        '--testSequencer', sequencerPath,
        '--runTestsByPath',
        ...EXPECTED_DB_SUITES,
        '--json',
        `--outputFile=${resultFile}`,
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          TEST_DATABASE_URL: databaseUrl,
          DB_TEST_ORDER: mode,
          DB_TEST_SEED: String(seed),
        },
        stdio: 'inherit',
        timeout: JEST_LANE_TIMEOUT_MS,
      }
    );
    if (run.error?.code === 'ETIMEDOUT') {
      fail(`${mode} lane timed out after ${JEST_LANE_TIMEOUT_MS}ms`);
    }
    if (run.status !== 0) fail(`${mode} lane exited with ${run.status}`);

    const result = JSON.parse(readFileSync(resultFile, 'utf8'));
    const actualOrder = result.testResults.map(({ name }) =>
      path.relative(rootDir, name).split(path.sep).join('/')
    );
    const expectedOrder = orderedSuitePaths(mode, seed);
    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
      fail(`${mode} execution order differed from the deterministic plan`);
    }
    if (
      result.numTotalTestSuites !== EXPECTED_DB_SUITES.length
      || result.numPassedTestSuites !== EXPECTED_DB_SUITES.length
      || result.numFailedTestSuites !== 0
      || result.numTotalTests !== EXPECTED_TESTS
      || result.numPassedTests !== EXPECTED_TESTS
      || result.numFailedTests !== 0
    ) {
      fail(
        `${mode} totals drifted: suites=${result.numPassedTestSuites}/${result.numTotalTestSuites}, `
        + `tests=${result.numPassedTests}/${result.numTotalTests}`
      );
    }
    process.stdout.write(`DB_MATRIX_${mode.toUpperCase()}=PASS (${EXPECTED_DB_SUITES.length} suites, ${EXPECTED_TESTS} tests)\n`);
  }
} finally {
  rmSync(resultDir, { recursive: true, force: true });
}

const finalPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const migrationRows = await finalPrisma.$queryRaw`
  SELECT COUNT(*)::integer AS count
  FROM "_prisma_migrations"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
`;
await finalPrisma.$disconnect();
if (migrationRows[0]?.count !== migrationCountBefore) {
  fail(`migration history changed during matrix: ${migrationCountBefore} -> ${migrationRows[0]?.count}`);
}

process.stdout.write(`DB_MIGRATIONS=${migrationCountBefore}->${migrationRows[0]?.count}\n`);
process.stdout.write('FULL_DB_RUNNER_ONE_FRESH_DB=PASS\nORDER_INDEPENDENCE=PASS\n');
