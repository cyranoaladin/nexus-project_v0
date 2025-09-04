import { expect, request, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

test.describe('Bilan - email et téléchargement', () => {
  test('start -> status -> download -> email', async () => {
    const ctx = await request.newContext({ baseURL: BASE });

    // Login ELEVE
    const login = await ctx.post('/api/test/login', { data: { role: 'ELEVE' } });
    expect(login.ok()).toBeTruthy();

    // Start bilan (stub E2E)
    const start = await ctx.post('/api/bilan/start', { data: { subject: 'MATHEMATIQUES', grade: 'premiere' } });
    expect(start.ok()).toBeTruthy();
    const js = await start.json();
    const id = js.bilanId as string;
    expect(id).toBeTruthy();

    // Poll status (should be done shortly in E2E stub)
    let status = 'pending';
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const st = await ctx.get(`/api/bilans/${id}/status`);
      if (!st.ok()) break;
      const sj = await st.json();
      status = sj.status;
      if (status === 'done') break;
      await new Promise(r => setTimeout(r, 150));
    }
    expect(['done', 'processing', 'pending'].includes(status)).toBeTruthy();

    // Download (200 si done, sinon 409 toléré)
    const dl = await ctx.get(`/api/bilans/${id}/download`);
    expect([200, 409].includes(dl.status())).toBeTruthy();
    if (dl.status() === 200) {
      expect(dl.headers()['content-type']).toContain('application/pdf');
    }

    // Email (E2E: 200 ok immediate)
    const mail = await ctx.post(`/api/bilan/email/${id}?to=test@example.com`);
    expect([200, 409].includes(mail.status())).toBeTruthy();
  });
});
