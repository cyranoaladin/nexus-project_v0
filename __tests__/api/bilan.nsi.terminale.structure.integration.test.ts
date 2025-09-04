/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('questionnaire-structure Terminale NSI', () => {
  it('retourne le QCM Terminale NSI', async () => {
    const mod = await import('@/app/api/bilan/questionnaire-structure/route');
    const url = new URL('http://localhost/api/bilan/questionnaire-structure?matiere=NSI&niveau=terminale&studentId=e2e');
    // @ts-ignore
    const res = await mod.GET({ url: url.toString(), headers: new Headers() } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const q1 = json?.volet1 || json?.volet1?.questions || json;
    expect(Array.isArray(q1?.questions || q1)).toBe(true);
  });
});
