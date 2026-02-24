import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

const LOGINS = [
  { email: 'admin@nexus-reussite.com', pwd: 'admin123', expectedPath: '/dashboard/admin' },
  { email: 'helios@nexus-reussite.com', pwd: 'admin123', expectedPath: '/dashboard/coach' },
  { email: 'parent@example.com',        pwd: 'admin123', expectedPath: '/dashboard/parent' },
  { email: 'student@example.com',       pwd: 'admin123', expectedPath: '/dashboard/eleve' },
]

for (const { email, pwd, expectedPath } of LOGINS) {
  test(`Login réel: ${email}`, async ({ page }) => {
    await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle' })
    
    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const pwdInput = page.locator('input[type="password"]')
    const btn = page.locator('button[type="submit"]')
    
    expect(await emailInput.isVisible(), 'Champ email absent').toBe(true)
    expect(await pwdInput.isVisible(), 'Champ password absent').toBe(true)
    
    await emailInput.fill(email)
    await pwdInput.fill(pwd)
    
    await page.screenshot({ path: `/tmp/login-${email.split('@')[0]}-before.png` })
    await btn.click()
    
    try {
      await page.waitForURL(`**${expectedPath}**`, { timeout: 8000 })
      console.log(`✅ ${email} → ${page.url()}`)
      await page.screenshot({ path: `/tmp/login-${email.split('@')[0]}-success.png` })
    } catch {
      const url = page.url()
      const body = (await page.textContent('body') || '').substring(0, 300)
      await page.screenshot({ path: `/tmp/login-${email.split('@')[0]}-FAILED.png` })
      throw new Error(
        `❌ ${email} ne peut pas se connecter\n` +
        `URL: ${url}\n` +
        `Corps: ${body}` 
      )
    }
  })
}

test('Sécurité: mauvais password → reste sur signin', async ({ page }) => {
  await page.goto(`${BASE}/auth/signin`)
  await page.locator('input[type="email"]').fill('admin@nexus-reussite.com')
  await page.locator('input[type="password"]').fill('MAUVAIS_XYZ_999')
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(3000)
  expect(page.url()).not.toContain('/dashboard')
  console.log(`✅ Mauvais password → reste sur ${page.url()}`)
})

test('Sécurité: parent ne peut pas accéder dashboard élève', async ({ page }) => {
  await page.goto(`${BASE}/auth/signin`)
  await page.locator('input[type="email"]').fill('parent@example.com')
  await page.locator('input[type="password"]').fill('admin123')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard/parent**', { timeout: 8000 })
  
  await page.goto(`${BASE}/dashboard/eleve`)
  await page.waitForTimeout(2000)
  
  expect(page.url(), 'FAILLE: parent accède à /dashboard/eleve !').not.toContain('/dashboard/eleve')
  console.log(`✅ Parent redirigé vers ${page.url()} (pas /dashboard/eleve)`)
})
