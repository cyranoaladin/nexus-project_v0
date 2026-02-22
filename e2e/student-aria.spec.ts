import { test, expect, Page } from '@playwright/test';
import { loginAsUser } from './helpers/auth';
import { CREDS } from './helpers/credentials';
import { disconnectPrisma, setEntitlementByUserEmail } from './helpers/db';

async function loginAsStudent(page: Page) {
  await loginAsUser(page, 'student');
}

test.describe('Student ARIA Interaction', () => {
  test.beforeAll(async () => {
    await setEntitlementByUserEmail(CREDS.student.email, 'ARIA_ADDON_MATHS');
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error]: ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log(`[Page Error]: ${err.message}`);
    });
  });

  async function waitForStreamingResponse(page: Page, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const messageElements = page.locator('[data-testid="aria-message"], .aria-message, [class*="message"]');
      const count = await messageElements.count();
      
      if (count > 0) {
        const lastMessage = messageElements.last();
        const isVisible = await lastMessage.isVisible().catch(() => false);
        
        if (isVisible) {
          const text = await lastMessage.textContent();
          if (text && text.trim().length > 10) {
            return true;
          }
        }
      }
      
      await page.waitForTimeout(100);
    }
    
    return false;
  }

  test('Student can access dashboard and see ARIA section', async ({ page }) => {
    await loginAsStudent(page);

    await expect(page).toHaveURL(/\/dashboard\/(eleve|student)/);

    // Verify student dashboard loaded
    await expect(page.locator('body')).toContainText(/Nexus Réussite|Dashboard|Sessions|ARIA/i);

    // Check for ARIA chat button or ARIA section
    const ariaButton = page
      .locator('[data-testid="aria-chat-trigger"], button:has-text("ARIA"), [data-testid*="aria"]')
      .first();
    if (await ariaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ariaButton.click();
      await page.waitForTimeout(500);
    }

    const ariaSignals = [
      page.getByTestId('aria-input').first(),
      page.locator('[data-testid*="aria"]').first(),
      page.getByText(/ARIA/i).first(),
    ];
    const visibleSignals = await Promise.all(
      ariaSignals.map((locator) => locator.isVisible().catch(() => false))
    );
    expect(visibleSignals.some(Boolean)).toBeTruthy();
  });
});
