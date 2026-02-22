import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import { clearEntitlementsByUserEmail, setEntitlementByUserEmail, disconnectPrisma } from './helpers/db';

test.describe.serial('Feature gating / entitlements', () => {
  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('ARIA Maths sans entitlement -> 403 + access-required', async ({ page }) => {
    await clearEntitlementsByUserEmail(CREDS.student.email);
    await loginAsUser(page, 'student');

    const res = await page.request.post('/api/aria/chat', {
      data: { subject: 'MATHEMATIQUES', content: 'Test', conversationId: 'e2e-contract' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.feature).toBe('aria_maths');

    await page.goto('/access-required?feature=aria_maths&reason=missing_entitlement&missing=aria_maths');
    await expect(page.getByRole('heading', { name: /accès requis/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /voir les offres/i })).toHaveAttribute('href', '/offres');
    await expect(page.getByRole('link', { name: /contacter nexus/i })).toHaveAttribute('href', '/contact');
    await expect(page.getByRole('link', { name: /retour au tableau de bord/i })).toHaveAttribute('href', '/dashboard/eleve');
  });

  test('credits_use OFF -> /api/sessions/book renvoie 403', async ({ page }) => {
    await clearEntitlementsByUserEmail(CREDS.parent.email);
    await loginAsUser(page, 'parent');

    const denied = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    expect(denied.status()).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody.feature).toBe('credits_use');

    await setEntitlementByUserEmail(CREDS.parent.email, 'ABONNEMENT_HYBRIDE');

    const allowedThenValidated = await page.request.post('/api/sessions/book', {
      data: {},
      failOnStatusCode: false,
    });

    // Once entitlement is active, request should pass guard and fail later on payload validation.
    expect(allowedThenValidated.status()).not.toBe(403);
  });
});
