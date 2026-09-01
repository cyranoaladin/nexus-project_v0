import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Incrément 3, mission §1 (P0 test infra) — "une URL DB invalide doit
 * produire EXIT != 0." This is a test OF the test harness: it spawns a
 * real `jest --config jest.config.db.js` run against a real DB-integration
 * suite with a deliberately unreachable TEST_DATABASE_URL, and proves the
 * process fails closed (non-zero exit, every test reported FAILED) rather
 * than silently passing 0-assertion "green" tests — the exact bug this
 * increment closes (the old `if (!dbAvailable) return;` pattern would have
 * made this same spawn exit 0 with every test reported passed).
 *
 * Runs under jest.unit.config.js — does NOT itself need a real database.
 */
describe('DB test harness — DATABASE_TEST_MODE=REQUIRED (DB_TESTS_FAIL_CLOSED)', () => {
  it('an unreachable TEST_DATABASE_URL makes a DB-integration suite exit non-zero, every test FAILED — never a silent pass', () => {
    const projectRoot = path.resolve(__dirname, '../..');

    const result = spawnSync(
      'npx',
      ['jest', '--config', 'jest.config.db.js', '--runInBand', '__tests__/database/family-visibility.test.ts'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          // Deliberately unreachable: nothing listens on this port.
          DATABASE_URL: 'postgresql://nexus_user:test_password_change_in_real_prod@127.0.0.1:1/nexus_disposable_harness_unreachable_test?schema=public',
          TEST_DATABASE_URL: 'postgresql://nexus_user:test_password_change_in_real_prod@127.0.0.1:1/nexus_disposable_harness_unreachable_test?schema=public',
          NEXUS_DISPOSABLE_POSTGRES: '1',
        },
        timeout: 60_000,
      },
    );

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(result.status).not.toBe(0);
    // Never "0 total" / silently-passed-by-early-return — Jest must report real failures.
    expect(output).toMatch(/Tests:\s+\d+ failed/);
    expect(output).not.toMatch(/Tests:\s+0 failed,\s+\d+ passed/);
  }, 60_000);
});
