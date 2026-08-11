import { test, expect } from '@playwright/test'
import { loginViaSigninForm, type UserType } from '../helpers/auth'
import { CREDS } from '../helpers/credentials'
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3002'

const LOGINS = [
  { role: 'admin', expectedPath: '/dashboard/admin' },
  { role: 'coach', expectedPath: '/dashboard/coach' },
  { role: 'parent', expectedPath: '/dashboard/parent' },
  { role: 'student', expectedPath: '/dashboard/eleve' },
] satisfies Array<{ role: UserType; expectedPath: string }>

for (const { role, expectedPath } of LOGINS) {
  test(`Login réel: ${role}`, async ({ page }) => {
    await loginViaSigninForm(page, role)
    await expect(page).toHaveURL(new RegExp(expectedPath))
  })
}

test('Sécurité: mauvais password → reste sur signin', async ({ page }) => {
  await resetDisposableE2ERateLimits()
  await page.goto(`${BASE}/auth/signin`)
  await page.locator('#email').fill(CREDS.admin.email)
  await page.locator('#password').fill('MAUVAIS_XYZ_999')
  await page.getByTestId('btn-signin').click()
  await expect(page).toHaveURL(/\/auth\/signin(?:[?#]|$)/)
})

test('Sécurité: parent ne peut pas accéder dashboard élève', async ({ page }) => {
  await loginViaSigninForm(page, 'parent')
  
  await page.goto(`${BASE}/dashboard/eleve`)
  await page.waitForTimeout(2000)
  
  expect(page.url(), 'FAILLE: parent accède à /dashboard/eleve !').not.toContain('/dashboard/eleve')
  console.log(`✅ Parent redirigé vers ${page.url()} (pas /dashboard/eleve)`)
})
