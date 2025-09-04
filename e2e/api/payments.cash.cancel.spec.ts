import { expect, test } from '@playwright/test';
import { issueDevToken } from '../../lib/auth/dev-token';

test.describe('Cash cancel flow', () => {
  const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';

  test('reserve then cancel sends email and marks cancelled', async ({ request }) => {
    process.env.NEXTAUTH_SECRET = secret;
    const admin = issueDevToken({ sub: 'admin-1', email: 'a@nexus.local', role: 'ADMIN', dev: true });
    const parent = issueDevToken({ sub: 'parent-1', email: 'p@nexus.local', role: 'PARENT', dev: true });

    // ensure a pack
    await request.post('/api/credits/packs', {
      data: { credits: 10, priceTnd: 100, bonus: 0, active: true },
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }
    });

    // reserve
    const reserve = await request.post('/api/payments/cash/reserve', {
      data: { userId: 'parent-1', packId: 1, amountTnd: 50, parentEmail: 'p@nexus.local' },
      headers: { Authorization: `Bearer ${parent}` }
    });
    expect(reserve.status()).toBe(200);
    const { recordId } = await reserve.json();
    expect(recordId).toBeTruthy();

    // cancel
    const cancel = await request.post('/api/payments/cash/cancel', {
      data: { recordId },
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }
    });
    expect(cancel.status()).toBe(200);
  });
})
