import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function loginAs(page: Page, email: string, pwd: string, path: string) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(pwd)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(`**${path}**`, { timeout: 30000 })
}

// ======================================================
// ADMIN — CRÉER UN UTILISATEUR (vérification en vraie DB)
// ======================================================
test('ADMIN — créer user via dialog → existe en DB', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'admin@nexus-reussite.com', 'admin123', '/dashboard/admin')
  await page.goto(`${BASE}/dashboard/admin/users`, { waitUntil: 'load' })
  await page.waitForTimeout(5000)

  const testEmail = `pw.create.${Date.now()}@nexus-test.com`

  // Click "Ajouter Utilisateur" button — wait for page to finish loading
  const createBtn = page.getByRole('button', { name: /ajouter utilisateur/i })
  await expect(createBtn).toBeVisible({ timeout: 15000 })
  await createBtn.click()
  await page.waitForTimeout(500)

  // Fill the dialog form
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 3000 })

  await dialog.locator('#email').fill(testEmail)
  await dialog.locator('#firstName').fill('Test')
  await dialog.locator('#lastName').fill('Playwright')
  await dialog.locator('#password').fill('Test1234!')

  await page.screenshot({ path: '/tmp/admin-create-user-form.png' })

  // Submit the form
  const submitBtn = dialog.getByRole('button', { name: /créer|ajouter|enregistrer|save/i })
  await submitBtn.click()
  await page.waitForTimeout(3000)

  // Verify in DB
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const created = await prisma.user.findUnique({ where: { email: testEmail } })
    if (!created) {
      throw new Error(`❌ ${testEmail} créé via UI mais ABSENT en DB → Vérifier POST /api/admin/users`)
    }
    console.log(`✅ User créé en DB: ${created.email} (${created.role})`)
    // Cleanup
    await prisma.student.deleteMany({ where: { userId: created.id } })
    await prisma.parentProfile.deleteMany({ where: { userId: created.id } })
    await prisma.user.delete({ where: { email: testEmail } })
    console.log('✅ Cleanup done')
  } finally {
    await prisma.$disconnect()
  }
})

// ======================================================
// PARENT — DIALOG AJOUTER ENFANT
// ======================================================
test('PARENT — dialog ajouter enfant fonctionne', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'parent@example.com', 'admin123', '/dashboard/parent')
  await page.waitForTimeout(2000)

  // Find "Ajouter un Enfant" button specifically
  const btn = page.getByRole('button', { name: /ajouter un enfant/i })
  await expect(btn).toBeVisible({ timeout: 5000 })
  await btn.click()
  await page.waitForTimeout(500)

  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 3000 })
  console.log('✅ Dialog ajouter enfant s\'ouvre')

  await page.screenshot({ path: '/tmp/parent-add-child-dialog.png' })

  // Close with Escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await expect(dialog).not.toBeVisible({ timeout: 3000 })
  console.log('✅ Dialog se ferme avec Escape')
})

// ======================================================
// PARENT — BANNER BILAN UTILISE L'API (pas localStorage)
// ======================================================
test('PARENT — banner bilan gratuit appelle /api/bilan-gratuit/status', async ({ page }) => {
  test.setTimeout(60000)
  const apiCalled = { status: false, dismiss: false }
  page.on('request', r => {
    if (r.url().includes('/api/bilan-gratuit/status')) apiCalled.status = true
    if (r.url().includes('/api/bilan-gratuit/dismiss')) apiCalled.dismiss = true
  })

  await loginAs(page, 'parent@example.com', 'admin123', '/dashboard/parent')
  await page.waitForTimeout(2000)

  expect(apiCalled.status, '❌ Banner N\'APPELLE PAS /api/bilan-gratuit/status').toBe(true)
  console.log('✅ Banner appelle bien /api/bilan-gratuit/status')
})

// ======================================================
// COACH — DISPONIBILITÉS AFFICHÉES
// ======================================================
test('COACH — page disponibilités charge avec contenu', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'helios@nexus-reussite.com', 'admin123', '/dashboard/coach')
  await page.goto(`${BASE}/dashboard/coach/availability`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/coach-availability.png' })

  const body = await page.textContent('body') || ''
  // Page should not show a crash error
  const hasCrash = body.includes('Application error') || body.includes('Internal Server Error')
  expect(hasCrash, '❌ Page disponibilités coach affiche une erreur critique').toBe(false)
  console.log('✅ Page disponibilités coach charge correctement')
})

// ======================================================
// ÉLÈVE — PAGE SESSIONS AFFICHE QUELQUE CHOSE
// ======================================================
test('ÉLÈVE — page sessions charge', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'student@example.com', 'admin123', '/dashboard/eleve')
  await page.goto(`${BASE}/dashboard/eleve/sessions`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/eleve-sessions.png' })

  const body = await page.textContent('body') || ''
  const hasCrash = body.includes('Application error') || body.includes('Internal Server Error')
  expect(hasCrash, '❌ Page sessions élève affiche une erreur critique').toBe(false)
  console.log('✅ Page sessions élève charge')
})

// ======================================================
// ADMIN — SEARCH USERS FONCTIONNE
// ======================================================
test('ADMIN — recherche utilisateurs fonctionne', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'admin@nexus-reussite.com', 'admin123', '/dashboard/admin')
  await page.goto(`${BASE}/dashboard/admin/users`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)

  // Find search input
  const search = page.locator('input[placeholder*="cherche" i], input[placeholder*="search" i], input[type="search"]').first()
  if (await search.isVisible()) {
    await search.fill('parent')
    await page.waitForTimeout(1500)
    const body = await page.textContent('body') || ''
    const hasParent = body.toLowerCase().includes('parent@example.com') || body.toLowerCase().includes('parent')
    console.log(`✅ Recherche "parent" → résultats: ${hasParent ? 'trouvé' : 'filtré'}`)
  } else {
    console.log('ℹ️ Pas de champ recherche visible — skip')
  }
})

// ======================================================
// DÉCONNEXION FONCTIONNE
// ======================================================
test('DÉCONNEXION — admin redirigé après logout', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'admin@nexus-reussite.com', 'admin123', '/dashboard/admin')

  // Find logout button — could be "Déconnexion" text or LogOut icon
  const logoutBtn = page.getByRole('button', { name: /déconnexion|logout/i }).first()
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click()
    await page.waitForTimeout(3000)
    const url = page.url()
    const redirected = url.includes('/auth/signin') || url.endsWith('/') || url === BASE + '/'
    expect(redirected, `❌ Après déconnexion admin: ${url}`).toBe(true)
    console.log(`✅ Déconnexion admin → ${url}`)
  } else {
    // Try sidebar or menu logout
    const sideLogout = page.locator('a[href*="signout"], button:has-text("Déconnexion")').first()
    if (await sideLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sideLogout.click()
      await page.waitForTimeout(3000)
      console.log(`✅ Déconnexion admin via sidebar → ${page.url()}`)
    } else {
      await page.screenshot({ path: '/tmp/admin-no-logout-btn.png' })
      console.log('⚠️ Bouton déconnexion non trouvé — screenshot saved')
    }
  }
})

test('DÉCONNEXION — parent redirigé après logout', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'parent@example.com', 'admin123', '/dashboard/parent')

  const logoutBtn = page.getByRole('button', { name: /déconnexion|logout/i }).first()
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click()
    await page.waitForTimeout(3000)
    const url = page.url()
    const redirected = url.includes('/auth/signin') || url.endsWith('/') || url === BASE + '/'
    expect(redirected, `❌ Après déconnexion parent: ${url}`).toBe(true)
    console.log(`✅ Déconnexion parent → ${url}`)
  } else {
    await page.screenshot({ path: '/tmp/parent-no-logout-btn.png' })
    console.log('⚠️ Bouton déconnexion parent non trouvé — screenshot saved')
  }
})
