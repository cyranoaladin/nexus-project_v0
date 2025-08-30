import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('allows up to max hits within window and then blocks', async () => {
    const rl = rateLimit({ windowMs: 1000, max: 3 }) as (key: string) => any;
    const key = 'test:ip';

    expect(rl(key).ok).toBe(true); // 1
    expect(rl(key).ok).toBe(true); // 2
    expect(rl(key).ok).toBe(true); // 3
    const res = rl(key);
    expect(res.ok).toBe(false); // 4th should be blocked
    expect(res.remaining).toBe(0);
  });
});
