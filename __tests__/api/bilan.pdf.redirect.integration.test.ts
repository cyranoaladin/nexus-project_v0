/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('pdf redirect by id', () => {
  it('redirects /api/bilan/pdf/[id] to /api/bilan/pdf?bilanId=id', async () => {
    const mod = await import('@/app/api/bilan/pdf/[id]/route');
    const url = new URL('http://localhost/api/bilan/pdf/ABC123?variant=parent');
    // @ts-ignore
    const res = await mod.GET({ url: url.toString() } as any, { params: { id: 'ABC123' } } as any);
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') || '';
    expect(loc.includes('/api/bilan/pdf')).toBe(true);
    expect(loc.includes('bilanId=ABC123')).toBe(true);
    expect(loc.includes('variant=parent')).toBe(true);
  });
});
