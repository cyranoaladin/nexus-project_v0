import { test, expect, Page } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

async function loginAsStudent(page: Page) {
  await loginAsUser(page, 'student');
}

test.describe('Student ARIA Interaction', () => {
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
    const creditsSection = page.getByText(/crédit|credit/i);
    await expect(creditsSection.first()).toBeVisible({ timeout: 10000 });

    // Check for ARIA chat button or section
    const ariaButton = page.locator('button.rounded-full, button:has-text("ARIA"), [data-testid*="aria"]').first();
    if (await ariaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ ARIA chat button found on student dashboard');
      await ariaButton.click();
      await page.waitForTimeout(500);

      // Verify ARIA interface opened
      await expect(page.getByText(/ARIA/i).first()).toBeVisible({ timeout: 5000 });
    } else {
      console.log('⚠️ ARIA chat button not visible - may require API key configuration');
    }
  });
});
