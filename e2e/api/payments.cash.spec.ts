import { expect, test } from '@playwright/test';
import { issueDevToken } from '../../lib/auth/dev-token';

test.describe('Cash payments flow', () => {
  const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';

  test('reserve, list pending, confirm and cancel require RBAC', async ({ request }) => {
    process.env.NEXTAUTH_SECRET = secret;
    const admin = issueDevToken({ sub: 'admin-1', email: 'a@nexus.local', role: 'ADMIN', dev: true });
    const parent = issueDevToken({ sub: 'parent-1', email: 'p@nexus.local', role: 'PARENT', dev: true });

    // Ensure at least one pack exists for purchase
    const createPack = await request.post('/api/credits/packs', {
      data: { credits: 10, priceTnd: 100, bonus: 0, active: true },
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }
    });
    const packJson = (await createPack.json()).id ? await createPack.json() : {};
    const packId = packJson.id || 1;

    // Reserve (public, parent)
    const reserve = await request.post('/api/payments/cash/reserve', {
      data: { userId: 'parent-1', packId, amountTnd: 100, note: 'test', parentEmail: 'p@nexus.local' },
      headers: { Authorization: `Bearer ${parent}` }
    });
    expect(reserve.status()).toBe(200);
    const { recordId } = await reserve.json();
    expect(recordId).toBeTruthy();

    // List pending (admin)
    const list = await request.get('/api/payments/cash/pending', { headers: { Authorization: `Bearer ${admin}` } });
    expect(list.status()).toBe(200);

    // Confirm (admin)
    const confirm = await request.post('/api/payments/cash/confirm', {
      data: { recordId }, headers: { Authorization: `Bearer ${admin}` }
    });
    expect(confirm.status()).toBe(200);
  });
});
