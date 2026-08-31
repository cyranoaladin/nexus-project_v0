import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ARIA test harness ownership', () => {
  it('keeps every ARIA PostgreSQL suite out of the legacy mocked integration harness', () => {
    const generic = read('jest.integration.config.js');
    expect(generic).toContain(
      "'<rootDir>/__tests__/db/aria-[^/]+[.]real[.]test[.]ts$'",
    );
    expect(generic).toContain(
      "'<rootDir>/__tests__/concurrency/aria-[^/]+[.]real[.]test[.]ts$'",
    );
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
