import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';
import { assertDisposablePostgresUrl } from '../../__tests__/helpers/disposable-postgres';

let phase = 'target-guard';
async function main(): Promise<void> {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  const target = assertDisposablePostgresUrl(base);
  // Only a positively marked local disposable service may create this fresh DB.
  // Existing databases are never reused, dropped, or reset.
  phase = 'fresh-database-create';
  const db = new PrismaClient({ datasources: { db: { url: base } } });
  try { await db.$executeRaw`CREATE DATABASE nexus_e2e`; }
  finally { await db.$disconnect(); }
  target.pathname = '/nexus_e2e';
  const env = { ...process.env, DATABASE_URL: target.href, TEST_DATABASE_URL: target.href, E2E_DISPOSABLE_STACK: '1' };
  phase = 'empty-schema-deploy';
  const migrate = spawnSync('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], { env, encoding: 'utf8' });
  if (migrate.status !== 0) throw new Error('GOLDEN_FAMILY_SCHEMA_DEPLOY_FAILED');
  console.log('GOLDEN_FAMILY_EMPTY_SCHEMA_DEPLOYED=1');
  phase = 'real-fixture-tests';
  const test = spawnSync('npm', ['run', 'test:golden-family:real', '--', '--ci', '--json', '--silent'], { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const start = test.stdout.indexOf('{"numFailedTestSuites"');
  if (start < 0) throw new Error('GOLDEN_FAMILY_AGGREGATE_MISSING');
  const result: { numPassedTestSuites: number; numFailedTestSuites: number; numPassedTests: number; numFailedTests: number; numPendingTests: number; success: boolean; testResults: Array<{ name: string; status: string }> } = JSON.parse(test.stdout.slice(start));
  console.log(JSON.stringify({ suitesPassed: result.numPassedTestSuites, suitesFailed: result.numFailedTestSuites, testsPassed: result.numPassedTests, testsFailed: result.numFailedTests, pending: result.numPendingTests }));
  if (test.status !== 0 || !result.success || result.numPendingTests !== 0 || result.numPassedTests !== 2) {
    console.log(JSON.stringify({ failedFiles: result.testResults.filter(row => row.status !== 'passed').map(row => relative(process.cwd(), row.name)) }));
    throw new Error('GOLDEN_FAMILY_REAL_TEST_FAILED');
  }
  console.log('GOLDEN_FAMILY_REAL_TESTS_VERIFIED=1');
}
main().catch((error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : undefined;
  console.error(JSON.stringify({ event: 'GOLDEN_FAMILY_DISPOSABLE_QUALIFICATION_FAILED', phase, ...(code ? { code } : {}) }));
  process.exitCode = 1;
});
