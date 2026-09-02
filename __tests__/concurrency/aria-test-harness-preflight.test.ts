/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ARIA concurrency lane preflight', () => {
  it('is isolated from the general database lane', () => {
    const databaseConfig = readFileSync(
      resolve(process.cwd(), 'jest.aria.db.config.js'),
      'utf8',
    );
    const concurrencyConfig = readFileSync(
      resolve(process.cwd(), 'jest.aria.concurrency.config.js'),
      'utf8',
    );

    expect(databaseConfig).not.toContain('__tests__/concurrency');
    expect(concurrencyConfig).not.toContain('__tests__/database');
    expect(concurrencyConfig).not.toContain('__tests__/db');
  });
});
