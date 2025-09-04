import { buildContext } from '@/server/context/builder';
import { describe, expect, it } from '@jest/globals';

describe('ARIA context includes pedagoProfile', () => {
  it('adds pedagoProfile from Memory if available', async () => {
    const ctx = await buildContext('any', 'test', 'MATHEMATIQUES', 'premiere');
    expect(ctx).toHaveProperty('pedagoProfile');
  });
});
