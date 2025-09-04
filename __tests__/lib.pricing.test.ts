import { getPricing } from '@/lib/pricing';

describe('lib/pricing', () => {
  it('returns FALLBACK on network error', async () => {
    const res = await getPricing('http://127.0.0.1:65530');
    expect(res.pack_50_credits).toBe(500);
    expect(res.pack_100_credits).toBe(1000);
    expect(res.pack_250_credits).toBe(2500);
  });

  it('normalizes array payload ({variable,valeur}) into map', async () => {
    const originalFetch = global.fetch as any;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ([{ variable: 'pack_50_credits', valeur: 550 }]) });
    const res = await getPricing('http://localhost:3000');
    expect(res.pack_50_credits).toBe(550);
    expect(res.pack_100_credits).toBe(1000); // from FALLBACK
    (global.fetch as any) = originalFetch;
  });
});

