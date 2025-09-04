import { expect, request, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3003';

test.describe('ARIA API - smoke JSON', () => {
  test('POST /api/aria/chat retourne une réponse (stub E2E)', async () => {
    const ctx = await request.newContext({ baseURL: BASE });
    const res = await ctx.post('/api/aria/chat', { data: { message: 'Bonjour', subject: 'MATHEMATIQUES', stub: true } });
    expect(res.ok()).toBeTruthy();
    const js = await res.json();
    expect(typeof js.response).toBe('string');
    expect(js.response).toContain('E2E-STUB');
  });
});

