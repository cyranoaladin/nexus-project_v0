import { describe, it, expect, afterAll } from 'vitest';
import { isE2EStubActive } from './orchestrator';

const OLD_E2E = process.env.E2E;
const OLD_NODE_ENV = process.env.NODE_ENV;

describe('Stub safety', () => {
  it('stub is inactive in production regardless of E2E=1', () => {
    process.env.E2E = '1';
    process.env.NODE_ENV = 'production';
    expect(isE2EStubActive()).toBe(false);
  });

  it('stub is active when E2E=1 and NODE_ENV!=production', () => {
    process.env.E2E = '1';
    process.env.NODE_ENV = 'test';
    expect(isE2EStubActive()).toBe(true);
  });
});

afterAll(() => {
  if (OLD_E2E === undefined) delete process.env.E2E; else process.env.E2E = OLD_E2E;
  if (OLD_NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = OLD_NODE_ENV;
});
