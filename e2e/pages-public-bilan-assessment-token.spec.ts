import { expect, test } from '@playwright/test';

test.describe('/bilan-gratuit/assessment — token binding', () => {
  test('refuse l’accès direct par query params publics sans cookie de flux signé', async ({ page }) => {
    const response = await page.goto(
      '/bilan-gratuit/assessment?subject=MATHEMATIQUES&grade=terminale&email=attacker@example.test',
    );

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /accès au diagnostic expiré/i })).toBeVisible();
    await expect(page.locator('[data-testid="assessment-client"]')).toHaveCount(0);

    expect(page.url()).not.toContain('assessmentPublicToken');
    expect(page.url()).not.toContain('x-assessment-public-token');

    const html = await page.content();
    expect(html).not.toContain('x-assessment-public-token');
    expect(html).not.toContain('assessmentPublicToken');
    expect(html).not.toContain('attacker@example.test');
  });
});
