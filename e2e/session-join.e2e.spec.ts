import { expect, test } from '@playwright/test';

test.describe('E2E: Session Join Flow', () => {
  test('joins a session and renders video conference', async ({ page }) => {
    // Mock the join API
    await page.route('**/api/sessions/video', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = request.postDataJSON() as any;
        if (postData?.action === 'JOIN') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              sessionData: {
                id: postData.sessionId,
                roomName: 'nexus-reussite-session-test',
                jitsiUrl: 'https://meet.jit.si/nexus-reussite-session-test',
                studentName: 'Marie Dupont',
                coachName: 'Pierre Martin',
                subject: 'Mathématiques',
                scheduledAt: new Date().toISOString(),
                duration: 60,
                status: 'IN_PROGRESS',
                isHost: false
              }
            })
          });
        }
      }
      return route.continue();
    });

    // Navigate to session video page with a test sessionId
    await page.goto('/session/video?sessionId=s-test');

    // Wait for main header to render
    await expect(page.getByText('Session de Visioconférence')).toBeVisible();

    // Expect coach and student names to appear
    await expect(page.getByText('Pierre Martin')).toBeVisible();
    await expect(page.getByText('Marie Dupont')).toBeVisible();

    // Optional: expect iframe container (Jitsi) to be present
    await expect(page.locator('.min-h-\[600px\]')).toBeVisible();
  });
});

