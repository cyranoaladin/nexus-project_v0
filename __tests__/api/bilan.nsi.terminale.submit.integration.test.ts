/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('submit Terminale NSI', () => {
  it('accepte qcmAnswers et pedagoAnswers (stub) et renvoie ok', async () => {
    const mod = await import('@/app/api/bilan/submit/route');
    const url = new URL('http://localhost/api/bilan/submit?e2e=1');
    const body = { subject: 'NSI', grade: 'terminale', qcmAnswers: { 'NSI1-DON-Q1': 'A' }, pedagoAnswers: { N1: 4 } };
    // @ts-ignore
    const res = await mod.POST({ url: url.toString(), json: async () => body } as any);
    expect([200, 201]).toContain(res.status);
    const js = await res.json();
    expect(js.ok).toBe(true);
  });
});
