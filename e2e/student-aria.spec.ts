import { test, expect, Page } from '@playwright/test';

const STUDENT_AUTH_FILE = 'e2e/.auth/student.json';

test.describe('Student ARIA Interaction', () => {
  test.use({ storageState: STUDENT_AUTH_FILE });

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

  test('Student can ask ARIA a question and receive streaming response', async ({ page }) => {
    await page.goto('/dashboard/student', { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/dashboard\/student/);

    const studentName = page.getByText(/Test Student|Bonjour|Bienvenue/i);
    await expect(studentName.first()).toBeVisible({ timeout: 10000 });

    const creditsSection = page.getByText(/crédit|credit/i);
    await expect(creditsSection.first()).toBeVisible({ timeout: 5000 });

    const subjectSelector = page.locator('select, [role="combobox"]').filter({ hasText: /mathématiques|physique|nsi/i });
    if (await subjectSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await subjectSelector.click();
      
      const mathOption = page.getByRole('option', { name: /mathématiques/i });
      if (await mathOption.isVisible().catch(() => false)) {
        await mathOption.click();
      }
    }

    const questionInput = page.locator('input[type="text"], textarea').filter({ 
      hasText: /question|message|poser/i 
    }).or(page.locator('[placeholder*="question"], [placeholder*="message"]'));
    
    const inputField = questionInput.first();
    await inputField.waitFor({ state: 'visible', timeout: 5000 });
    await inputField.fill('Explique-moi le théorème de Pythagore');

    const sendButton = page.getByRole('button', { name: /envoyer|send|poser/i });
    await sendButton.click();

    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="typing"]');
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 3000 });

    const hasResponse = await waitForStreamingResponse(page, 30000);
    expect(hasResponse).toBe(true);

    const ariaResponse = page.locator('[data-testid="aria-message"], .aria-message').last();
    await expect(ariaResponse).toBeVisible();
    
    const responseText = await ariaResponse.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(20);

    const feedbackButtons = page.locator('button').filter({ hasText: /👍|👎|like|dislike/i });
    if (await feedbackButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const thumbsUp = feedbackButtons.first();
      await thumbsUp.click();
      
      await page.waitForTimeout(500);
    }

    await page.reload({ waitUntil: 'networkidle' });

    const conversationHistory = page.locator('[data-testid="aria-message"], .aria-message');
    await expect(conversationHistory.first()).toBeVisible({ timeout: 5000 });
    
    const messageCount = await conversationHistory.count();
    expect(messageCount).toBeGreaterThan(0);
  });
});
