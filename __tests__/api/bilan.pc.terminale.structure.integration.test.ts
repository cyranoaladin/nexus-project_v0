/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('questionnaire-structure Terminale PC', () => {
  it('renvoie QCM PC Terminale et Volet2 fusionné', async () => {
    const mod = await import('@/app/api/bilan/questionnaire-structure/route');
    const url = new URL('http://localhost/api/bilan/questionnaire-structure?matiere=PHYSIQUE_CHIMIE&niveau=terminale&studentId=e2e');
    // @ts-ignore
    const res = await mod.GET({ url: url.toString(), headers: new Headers() } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json?.volet1?.questions || json?.volet1)).toBeTruthy();
    if (json?.requiresVolet2) {
      expect(Array.isArray(json?.volet2?.questions)).toBe(true);
    }
  });
});
