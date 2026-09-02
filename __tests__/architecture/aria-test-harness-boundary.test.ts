import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ARIA test harness ownership', () => {
  it('keeps every ARIA PostgreSQL suite outside the generic integration testMatch', () => {
    const generic = read('jest.integration.config.js');
    expect(generic).not.toContain("'**/*.real.test.ts'");
    expect(generic).not.toContain('__tests__/db/aria-');
    expect(generic).not.toContain('__tests__/concurrency/aria-');
    expect(generic).toContain("'**/__tests__/lib/bilan-runtime/**/*.real.test.ts'");
  });

  it('cannot re-include ARIA PostgreSQL suites when CI replaces ignore options', () => {
    const output = execFileSync(process.execPath, [
      'node_modules/jest/bin/jest.js',
      '--config', 'jest.integration.config.js',
      '--runInBand',
      '--listTests',
      '--json',
      '--testPathIgnorePatterns=/__tests__/lib/bilan-runtime/',
      '--testPathIgnorePatterns=session-revocation[.]real[.]test[.]ts',
    ], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const collected = JSON.parse(output) as string[];
    expect(collected.some((path) => /__tests__\/(?:db|concurrency)\/aria-/.test(path))).toBe(false);
  });

  it('keeps every excluded suite owned by an exact real PostgreSQL lane', () => {
    const dbConfig = read('jest.aria.db.config.js');
    const concurrencyConfig = read('jest.aria.concurrency.config.js');
    const dbTests = readdirSync(resolve(process.cwd(), '__tests__/db'))
      .filter((file) => /^aria-.*\.real\.test\.ts$/.test(file));
    const concurrencyTests = readdirSync(resolve(process.cwd(), '__tests__/concurrency'))
      .filter((file) => /^aria-.*\.real\.test\.ts$/.test(file));

    expect(dbTests.length).toBeGreaterThan(0);
    expect(concurrencyTests.length).toBeGreaterThan(0);
    expect(dbConfig).toContain("'<rootDir>/__tests__/db/aria-*.real.test.ts'");
    expect(concurrencyConfig).toContain(
      "'<rootDir>/__tests__/concurrency/aria-*.test.ts'",
    );
    expect(read('.github/workflows/ci.yml')).toContain('script: test:aria:db');
    expect(read('.github/workflows/ci.yml')).toContain('script: test:aria:concurrency');
  });
});
