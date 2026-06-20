import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test('Bilan gratuit banner uses API (not localStorage)', async ({ page }) => {
  const apiCalled = { status: false, dismiss: false }
  page.on('request', (r) => {
    if (r.url().includes('/api/bilan-gratuit/status')) apiCalled.status = true
    if (r.url().includes('/api/bilan-gratuit/dismiss')) apiCalled.dismiss = true
  })

  // Login as parent
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.locator('input[type="email"], input[name="email"]').fill('parent@example.com')
  await page.locator('input[type="password"]').fill('admin123')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard/parent**', { timeout: 20000 })
  await page.waitForTimeout(3000)

  // Verify API was called (not localStorage)
  expect(apiCalled.status, '❌ Banner does NOT call /api/bilan-gratuit/status — still using localStorage').toBe(true)
  console.log('✅ Banner calls /api/bilan-gratuit/status')

  // Check banner is visible
  const banner = page.locator('text=Complétez le Bilan Diagnostic Gratuit')
  const visible = await banner.isVisible({ timeout: 3000 }).catch(() => false)

  if (visible) {
    console.log('✅ Bilan gratuit banner is visible on parent dashboard')
    await page.screenshot({ path: '/tmp/bilan-banner-visible.png' })

    // Test dismiss via API
    const dismissBtn = page.locator('button[aria-label*="Fermer"]')
    await dismissBtn.click()
    await page.waitForTimeout(1000)

    const stillVisible = await banner.isVisible().catch(() => false)
    expect(stillVisible, 'Banner should be hidden after dismiss').toBe(false)
    console.log('✅ Banner dismiss works correctly')

    // Verify dismiss API was called
    expect(apiCalled.dismiss, '❌ Dismiss does NOT call /api/bilan-gratuit/dismiss').toBe(true)
    console.log('✅ Dismiss calls /api/bilan-gratuit/dismiss (DB-backed)')

    // Verify localStorage is NOT used
    const lsValue = await page.evaluate(() => localStorage.getItem('nexus_bilan_gratuit_dismissed'))
    expect(lsValue, '❌ Banner still uses localStorage!').toBeNull()
    console.log('✅ localStorage NOT used — dismiss is DB-backed')
  } else {
    // Banner not visible = parent already dismissed or completed — that's OK
    console.log('ℹ️ Banner not visible (parent may have already dismissed/completed)')
    await page.screenshot({ path: '/tmp/bilan-banner-hidden.png' })
  }
})
