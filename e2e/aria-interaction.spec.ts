import { expect, test } from '@playwright/test';

test.describe('ARIA Interaction Flow', () => {
  test('should limit anonymous users to 3 questions before prompting registration', async ({ page }) => {
    // Step 1: Navigate to homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Nexus Réussite/);

    // Step 2: Open ARIA chat widget
    const ariaChatButton = page.locator('[data-testid="aria-chat-widget"]');
    await expect(ariaChatButton).toBeVisible();
    await ariaChatButton.click();

    // Verify chat modal opens
    await expect(page.locator('[data-testid="aria-chat-modal"]')).toBeVisible();
    await expect(page.locator('text=ARIA - Votre Assistante Pédagogique')).toBeVisible();

    // Step 3: Send first question
    const chatInput = page.locator('[data-testid="aria-chat-input"]');
    const sendButton = page.locator('[data-testid="aria-send-button"]');

    await chatInput.fill('Bonjour');
    await sendButton.click();

    // Step 4: Verify ARIA responds
    await expect(page.locator('[data-testid="aria-message"]').last()).toContainText('Bonjour');

    // Wait for ARIA's response
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

    // Step 5: Send second question
    await chatInput.fill('Peux-tu m\'aider avec les mathématiques ?');
    await sendButton.click();

    // Wait for response
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

    // Step 6: Send third question
    await chatInput.fill('Comment résoudre une équation du second degré ?');
    await sendButton.click();

    // Wait for response
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

    // Step 7: Send fourth question - should trigger registration prompt
    await chatInput.fill('Quels sont les tarifs ?');
    await sendButton.click();

    // Step 8: Verify registration prompt appears
    const registrationPrompt = page.locator('[data-testid="aria-registration-prompt"]');
    await expect(registrationPrompt).toBeVisible();
    await expect(registrationPrompt).toContainText('Vous avez atteint la limite');
    await expect(registrationPrompt).toContainText('inscrivez-vous');

    // Verify registration link/button is present
    const registrationLink = page.locator('[data-testid="aria-register-link"]');
    await expect(registrationLink).toBeVisible();

    // Step 9: Click registration link and verify redirection
    await registrationLink.click();
    await expect(page).toHaveURL('/bilan-gratuit');
  });

  test('should allow unlimited questions for authenticated users', async ({ page }) => {
    // Login first
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test.student@nexus-test.com');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Navigate to homepage
    await page.goto('/');

    // Open ARIA chat
    await page.click('[data-testid="aria-chat-widget"]');

    // Send multiple questions (more than 3)
    const questions = [
      'Bonjour ARIA',
      'Comment calculer une dérivée ?',
      'Explique-moi les limites',
      'Qu\'est-ce qu\'une intégrale ?',
      'Comment résoudre un système d\'équations ?'
    ];

    for (let i = 0; i < questions.length; i++) {
      await page.fill('[data-testid="aria-chat-input"]', questions[i]);
      await page.click('[data-testid="aria-send-button"]');

      // Wait for response
      await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

      // Verify no registration prompt appears
      await expect(page.locator('[data-testid="aria-registration-prompt"]')).not.toBeVisible();
    }

    // Verify all questions were processed
    const messageCount = await page.locator('[data-testid="aria-message"]').count();
    expect(messageCount).toBeGreaterThanOrEqual(questions.length);
  });

  test('should handle ARIA chat errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Mock network failure for ARIA API
    await page.route('**/api/aria/chat', route => {
      route.abort('failed');
    });

    // Open ARIA chat
    await page.click('[data-testid="aria-chat-widget"]');

    // Send a message
    await page.fill('[data-testid="aria-chat-input"]', 'Test message');
    await page.click('[data-testid="aria-send-button"]');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="aria-error-message"]')).toBeVisible();
    await expect(page.locator('text=Désolée, je rencontre des difficultés')).toBeVisible();
  });

  test('should display typing indicator while ARIA is responding', async ({ page }) => {
    await page.goto('/');

    // Open ARIA chat
    await page.click('[data-testid="aria-chat-widget"]');

    // Send a message
    await page.fill('[data-testid="aria-chat-input"]', 'Bonjour');
    await page.click('[data-testid="aria-send-button"]');

    // Verify typing indicator appears
    await expect(page.locator('[data-testid="aria-typing-indicator"]')).toBeVisible();

    // Verify typing indicator disappears when response arrives
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="aria-typing-indicator"]')).not.toBeVisible();
  });

  test('should persist chat history during session', async ({ page }) => {
    await page.goto('/');

    // Open ARIA chat
    await page.click('[data-testid="aria-chat-widget"]');

    // Send first message
    await page.fill('[data-testid="aria-chat-input"]', 'Première question');
    await page.click('[data-testid="aria-send-button"]');
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

    // Close chat modal
    await page.click('[data-testid="aria-chat-close"]');
    await expect(page.locator('[data-testid="aria-chat-modal"]')).not.toBeVisible();

    // Reopen chat modal
    await page.click('[data-testid="aria-chat-widget"]');

    // Verify previous message is still visible
    await expect(page.locator('text=Première question')).toBeVisible();

    // Send second message
    await page.fill('[data-testid="aria-chat-input"]', 'Deuxième question');
    await page.click('[data-testid="aria-send-button"]');
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });

    // Verify both messages are visible
    await expect(page.locator('text=Première question')).toBeVisible();
    await expect(page.locator('text=Deuxième question')).toBeVisible();
  });

  test('should show subject selection for new conversations', async ({ page }) => {
    // Login as student
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test.student@nexus-test.com');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await page.goto('/dashboard');

    // Open ARIA chat
    await page.click('[data-testid="aria-chat-widget"]');

    // Verify subject selection is available for authenticated users
    await expect(page.locator('[data-testid="aria-subject-select"]')).toBeVisible();

    // Select a subject
    await page.selectOption('[data-testid="aria-subject-select"]', 'MATHEMATIQUES');

    // Send a message
    await page.fill('[data-testid="aria-chat-input"]', 'Aide-moi avec les mathématiques');
    await page.click('[data-testid="aria-send-button"]');

    // Verify message is sent with subject context
    await expect(page.locator('[data-testid="aria-response"]').last()).toBeVisible({ timeout: 10000 });
  });
});
