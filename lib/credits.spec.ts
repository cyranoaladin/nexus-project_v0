import { beforeAll, describe, expect, it } from 'vitest';

describe('credits helpers', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public';
  });

  it('exports calculateCreditCost and canCancelBooking', async () => {
    const mod = await import('./credits');
    expect(typeof mod.calculateCreditCost).toBe('function');
    expect(typeof mod.canCancelBooking).toBe('function');
  });
});
