import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

const BASE = 'http://localhost:3000'
const MOBILE_PAGES = ['/', '/offres', '/bilan-gratuit', '/contact']

for (const url of MOBILE_PAGES) {
  test(`Mobile 390px — ${url} — zéro scroll horizontal`, async ({ page }) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    
    await page.screenshot({ path: `/tmp/mobile${url.replace(/\//g,'_') || 'home'}.png` })
    
    const { scrollW, clientW, overflowing } = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth
      const clientW = document.documentElement.clientWidth
      const over: string[] = []
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.right > clientW + 5 && r.width > 10) {
          const cls = [...el.classList].slice(0, 3).join('.')
          over.push(`${el.tagName}.${cls}[right=${Math.round(r.right)}]`)
        }
      })
      return { scrollW, clientW, overflowing: over.slice(0, 8) }
    })
    
    console.log(`scrollWidth=${scrollW} clientWidth=${clientW}`)
    if (overflowing.length) console.log('Débordants:', overflowing.join(', '))
    
    expect(scrollW, 
      `SCROLL HORIZONTAL sur ${url} (mobile 390px) !\n` +
      `scrollW=${scrollW} > clientW=${clientW}\n` +
      `Éléments coupables: ${overflowing.join(', ')}\n` +
      `→ Ajouter overflow-x-hidden et max-w-full sur ces éléments` 
    ).toBeLessThanOrEqual(clientW + 5)
  })
}

test('Mobile — Menu hamburger visible et fonctionnel', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  
  await page.screenshot({ path: '/tmp/mobile-nav-closed.png' })
  
  const hamburger = page.locator([
    'button[aria-label*="menu" i]',
    'button[aria-label*="nav" i]',
    '[data-testid*="menu"]',
    'button:has(svg[class*="menu"])',
    '.hamburger, .nav-toggle, #nav-toggle',
  ].join(', ')).first()
  
  const found = await hamburger.isVisible().catch(() => false)
  
  if (!found) {
    await page.screenshot({ path: '/tmp/mobile-NO-HAMBURGER.png' })
    throw new Error(
      '❌ Aucun menu hamburger visible sur mobile (390px) !\n' +
      'Screenshot: /tmp/mobile-NO-HAMBURGER.png\n' +
      '→ Ajouter un bouton hamburger dans le header avec class "md:hidden"\n' +
      '→ Cacher le menu desktop avec class "hidden md:flex"'
    )
  }
  
  console.log('✅ Hamburger trouvé')
  await hamburger.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/mobile-nav-open.png' })
  
  const menuLink = page.getByRole('link', { name: /offres|bilan|contact/i }).first()
  const menuOpen = await menuLink.isVisible().catch(() => false)
  
  if (!menuOpen) {
    throw new Error(
      '❌ Hamburger cliqué mais le menu ne s\'ouvre pas\n' +
      'Screenshot: /tmp/mobile-nav-open.png\n' +
      '→ Vérifier le state toggle du menu mobile dans le composant Navbar'
    )
  }
  console.log('✅ Menu mobile s\'ouvre correctement')
})
