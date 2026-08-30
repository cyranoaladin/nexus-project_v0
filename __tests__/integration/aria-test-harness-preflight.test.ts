/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA Jest lane preflight', () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

  it('defines six non-empty lanes that fail when no test is selected', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    const lanes = ['unit', 'api', 'integration', 'db', 'concurrency', 'sse'];

    for (const lane of lanes) {
      expect(packageJson.scripts[`test:aria:${lane}`]).toBeTruthy();
      const config = read(`jest.aria.${lane}.config.js`);
      expect(config).toContain('testMatch');
      expect(config).toContain('passWithNoTests: false');
    }
  });

  it('keeps real-database tests out of the integration lane and gives every lane an exclusive namespace', () => {
    const integration = read('jest.aria.integration.config.js');
    const database = read('jest.aria.db.config.js');
    const concurrency = read('jest.aria.concurrency.config.js');
    const sse = read('jest.aria.sse.config.js');
    const unit = read('jest.aria.unit.config.js');

    expect(integration).toContain('aria-*.test.ts');
    expect(integration).toContain('\\\\.real\\\\.test');
    expect(integration).not.toContain('__tests__/database');
    expect(integration).not.toContain('__tests__/db');
    expect(integration).not.toContain('__tests__/concurrency');
    expect(database).toContain('__tests__/database/aria-*.test.ts');
    expect(database).toContain('__tests__/db/aria-*.real.test.ts');
    expect(concurrency).toContain('__tests__/concurrency/aria-*.test.ts');
    expect(sse).toContain('__tests__/lib/aria/sse.test.ts');
    expect(unit).toContain('<rootDir>/__tests__/lib/aria/sse.test.ts');
  });
});
