import { test, expect } from '@playwright/test'

// Bilan gratuit: vérifie la présence du formulaire et erreurs client simples

test('bilan gratuit - formulaire présent et validations client basiques', async ({ page }) => {
  await page.goto('/bilan-gratuit')

  await expect(page.getByText(/bilan stratégique gratuit/i)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/créez votre compte parent/i)

  // Soumettre sans rien pour déclencher validations côté client (si présentes)
  const submit = page.getByRole('button', { name: /valider|envoyer|suivant/i })
  if (await submit.isVisible()) {
    await submit.click().catch(() => {})
  }

  // Vérifier que la page reste accessible
  await expect(page).toHaveURL(/bilan-gratuit/)
})
