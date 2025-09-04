/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';

describe('Bilan core workflow', () => {
  it('start -> submit-answers -> ok', async () => {
    const start = await import('@/app/api/bilan/start/route');
    const submit = await import('@/app/api/bilan/[bilanId]/submit-answers/route');

    // 1) create bilan (E2E/dev defaults pick a student and default subject/grade when missing)
    // @ts-ignore
    const resStart = await start.POST({ url: 'http://localhost/api/bilan/start', json: async () => ({ subject: 'MATHEMATIQUES', grade: 'premiere' }) } as any);
    expect([200, 201]).toContain(resStart.status);
    const { bilanId } = await resStart.json();
    expect(bilanId).toBeTruthy();

    // 2) submit simple answers (minimal set)
    const answers = { 'Q1': 'A' } as any; // id must exist in loaded QCM; tolerated as route computes gracefully
    // @ts-ignore
    const resSubmit = await submit.POST({ url: `http://localhost/api/bilan/${bilanId}/submit-answers`, json: async () => ({ qcmAnswers: answers }) } as any, { params: { bilanId } } as any);
    expect([200, 201]).toContain(resSubmit.status);
    const js = await resSubmit.json();
    expect(js.ok).toBe(true);
  });
});
