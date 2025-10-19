import { test, expect } from '@playwright/test'

// Parcours paiement Konnect - marqué skipped tant que secrets non fournis

test.skip('paiement Konnect - init puis redirection', async ({ page }) => {
  // Pré-condition: utilisateur parent authentifié et variables KONNECT_* configurées
  await page.goto('/dashboard/parent/paiement?plan=HYBRIDE&student=stub')
  const payBtn = page.getByRole('button', { name: /procéder au paiement/i })
  await expect(payBtn).toBeVisible()
  await payBtn.click()
  await expect(page).toHaveURL(/konnect/i)
})
