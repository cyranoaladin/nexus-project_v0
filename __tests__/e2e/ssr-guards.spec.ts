import { test, expect } from '@playwright/test'

// SSR guard: not authenticated should redirect to sign in

test('guards - redirects to sign in when accessing dashboard unauthenticated', async ({ page }) => {
  const res = await page.goto('/dashboard/parent')
  // We expect a redirect to /auth/signin
  await expect(page).toHaveURL(/\/auth\/signin/)
})
