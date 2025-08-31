import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { isE2E as realIsE2E } from '@/lib/env/e2e';

// Simple unit to ensure stubs never activate in production

describe('stub-safety (E2E guards)', () => {
  const env = process.env;
  let isE2E: typeof realIsE2E;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...env };
  });
  afterEach(() => {
    process.env = env;
  });

  it('returns false when NODE_ENV=production regardless of E2E=1', async () => {
    process.env.NODE_ENV = 'production';
    process.env.E2E = '1';
    ({ isE2E } = await import('@/lib/env/e2e'));
    expect(isE2E()).toBe(false);
  });

  it('returns true when E2E=1 and NODE_ENV!=production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.E2E = '1';
    ({ isE2E } = await import('@/lib/env/e2e'));
    expect(isE2E()).toBe(true);
  });

  it('returns false when E2E not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.E2E;
    ({ isE2E } = await import('@/lib/env/e2e'));
    expect(isE2E()).toBe(false);
  });
});
