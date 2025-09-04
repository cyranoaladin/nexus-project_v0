/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('submit Terminale Maths', () => {
  it('accepte qcmAnswers et pedagoAnswers (E2E stub) et persiste', async () => {
    const mod = await import('@/app/api/bilan/submit/route');
    const url = new URL('http://localhost/api/bilan/submit?e2e=1');
    const body = {
      subject: 'MATHEMATIQUES', grade: 'terminale',
      qcmAnswers: { 'P-AN-01': 0, 'P-SU-12': 2 },
      pedagoAnswers: { T1: 5, T2: 4 }
    };
    // @ts-ignore
    const res = await mod.POST({ url: url.toString(), json: async () => body } as any);
    expect([200, 201]).toContain(res.status);
    const js = await res.json();
    expect(js.ok).toBe(true);
  });
});
