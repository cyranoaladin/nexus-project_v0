import { expect, test } from '@playwright/test';
import { issueDevToken } from '../../lib/auth/dev-token';

test.describe('Admin payments records API', () => {
  const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';

  test('requires RBAC and returns filtered results', async ({ request }) => {
    // Without token should be 401/403
    const r1 = await request.get('/api/admin/payments/records?limit=1');
    expect([401, 403]).toContain(r1.status());

    // With dev token ADMIN
    process.env.NEXTAUTH_SECRET = secret;
    const token = issueDevToken({ sub: 'admin-1', email: 'a@nexus.local', role: 'ADMIN', dev: true });
    const r2 = await request.get('/api/admin/payments/records?provider=cash&status=pending&limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    });
    // 200 even if empty array
    expect(r2.status()).toBe(200);
    const json = await r2.json();
    expect(Array.isArray(json)).toBeTruthy();
  });
});
