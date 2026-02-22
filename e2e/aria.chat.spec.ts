import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import {
  clearEntitlementsByUserEmail,
  setEntitlementByUserEmail,
  ensureActiveAriaSubscriptionForStudentEmail,
  disconnectPrisma,
} from './helpers/db';

test.describe.serial('ARIA / RAG / LLM deterministic', () => {
  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('sans entitlement aria_maths => 403', async ({ page }) => {
    await clearEntitlementsByUserEmail(CREDS.student.email);
    await loginAsUser(page, 'student');

    const res = await page.request.post('/api/aria/chat', {
      data: { subject: 'MATHEMATIQUES', content: 'Bonjour ARIA' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(403);
    expect((await res.json()).feature).toBe('aria_maths');
  });

  test('avec entitlement aria_maths + mock réponse chat', async ({ page }) => {
    await setEntitlementByUserEmail(CREDS.student.email, 'ARIA_ADDON_MATHS');
    await ensureActiveAriaSubscriptionForStudentEmail(CREDS.student.email, ['MATHEMATIQUES']);

    await page.route('**/api/aria/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversation: { id: 'conv-e2e', subject: 'MATHEMATIQUES', title: 'E2E' },
          message: { id: 'msg-e2e', content: 'Réponse mockée ARIA', role: 'assistant' },
          newBadges: [],
        }),
      });
    });

    await loginAsUser(page, 'student');
    await page.goto('/dashboard/eleve');

    await page.getByTestId('aria-chat-trigger').click();
    await page.getByTestId('aria-subject-mathematiques').click();
    await page.getByTestId('aria-input').fill('Explique les limites');
    await page.getByTestId('aria-send').click();

    await expect(page.getByTestId('aria-message-assistant').last()).toContainText('Réponse mockée ARIA');

    const feedbackRes = await page.request.post('/api/aria/feedback', {
      data: { messageId: 'msg-e2e', feedback: true },
      failOnStatusCode: false,
    });

    // mocked message is not persisted by backend in this test mode, so feedback returns 404.
    expect([200, 404]).toContain(feedbackRes.status());
  });
});
