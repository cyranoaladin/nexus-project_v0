import { expect, test } from '@playwright/test';
import { issueDevToken } from '../../lib/auth/dev-token';

test('admin filters by provider and status', async ({ request }) => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';
  const admin = issueDevToken({ sub: 'admin-1', email: 'a@nexus.local', role: 'ADMIN', dev: true });
  const r1 = await request.get('/api/admin/payments/records?provider=cash&status=pending&limit=3', { headers: { Authorization: `Bearer ${admin}` } });
  expect(r1.status()).toBe(200);
  const arr = await r1.json();
  expect(Array.isArray(arr)).toBeTruthy();
})
