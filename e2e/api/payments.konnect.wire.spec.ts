import { expect, test } from '@playwright/test';
import { issueDevToken } from '../../lib/auth/dev-token';

test.describe('Konnect & Wire placeholders', () => {
  const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';
  test('checkout konnect returns placeholder URL', async ({ request }) => {
    process.env.NEXTAUTH_SECRET = secret;
    const parent = issueDevToken({ sub: 'parent-1', email: 'p@nexus.local', role: 'PARENT', dev: true });
    const r = await request.post('/api/payments/checkout', {
      data: { provider: 'konnect', userId: 'parent-1', packId: 1, amountTnd: 100 },
      headers: { Authorization: `Bearer ${parent}`, 'Content-Type': 'application/json' }
    });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.provider).toBe('konnect');
    expect(j.url).toBeTruthy();
  });

  test('wire info returns bientôt disponible', async ({ request }) => {
    const r = await request.get('/api/payments/wire/info');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(JSON.stringify(j).toLowerCase()).toContain('bient');
  });
})
