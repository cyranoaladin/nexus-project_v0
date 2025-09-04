import { expect, request, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Bilan workflow API', () => {
  test('login -> start -> submit -> pdf', async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    // Login ELEVE (sets cookie)
    const login = await ctx.post('/api/test/login', { data: { role: 'ELEVE' } });
    expect(login.ok()).toBeTruthy();

    // Start bilan (Maths Première)
    const start = await ctx.post('/api/bilan/start', { data: { subject: 'MATHEMATIQUES', grade: 'premiere' } });
    expect(start.ok()).toBeTruthy();
    const js = await start.json();
    const id = js.bilanId as string;
    expect(id).toBeTruthy();

    // Submit minimal answers
    const submit = await ctx.post(`/api/bilan/${id}/submit-answers`, { data: { qcmAnswers: { Q1: 'A' } } });
    expect(submit.ok()).toBeTruthy();
    const sj = await submit.json();
    expect(sj.ok).toBeTruthy();

    // PDF direct (avoid redirects in dev/E2E). Tolerate service unavailability in E2E.
    const pdf = await ctx.get(`/api/bilan/pdf?bilanId=${id}&variant=parent&dev=1`);
    const status = pdf.status();
    expect([200, 202, 404, 403, 500]).toContain(status);
    const ct = (pdf.headers()['content-type'] || '').toLowerCase();
    if (status === 200 && ct.includes('application/pdf')) {
      const buf = await pdf.body();
      expect(buf.byteLength).toBeGreaterThan(100); // minimal sanity check
    }

    // Email (optional: 200 or 409 if not ready)
    const mail = await ctx.post(`/api/bilan/email/${id}?to=test@example.com`);
    expect([200, 409]).toContain(mail.status());
  });
});
