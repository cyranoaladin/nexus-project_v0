import { test, expect, Page } from '@playwright/test'
import { loginViaSigninForm, type UserType } from '../helpers/auth'
import { CREDS } from '../helpers/credentials'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3002'

async function loginAs(page: Page, role: UserType) {
  await loginViaSigninForm(page, role)
}

// ======================================================
// ADMIN — CRÉER UN UTILISATEUR (vérification en vraie DB)
// ======================================================
test('ADMIN — créer user via dialog → existe en DB', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'admin')
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

  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Assistante' }).click()

  await page.screenshot({ path: '/tmp/admin-create-user-form.png' })

  // Submit the form
  const submitBtn = dialog.getByRole('button', { name: /créer|ajouter|enregistrer|save/i })
  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/admin/users')
      && response.request().method() === 'POST'
    ),
    submitBtn.click(),
  ])
  expect(createResponse.status(), await createResponse.text()).toBe(201)

  // Verify in DB
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const created = await prisma.user.findUnique({ where: { email: testEmail } })
    if (!created) {
      throw new Error(`❌ ${testEmail} créé via UI mais ABSENT en DB → Vérifier POST /api/admin/users`)
    }
    expect(created.role).toBe('ASSISTANTE')
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
  await loginAs(page, 'parent')
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

  await loginAs(page, 'parent')
  await page.waitForTimeout(2000)

  expect(apiCalled.status, '❌ Banner N\'APPELLE PAS /api/bilan-gratuit/status').toBe(true)
  console.log('✅ Banner appelle bien /api/bilan-gratuit/status')
})

// ======================================================
// COACH — DISPONIBILITÉS AFFICHÉES
// ======================================================
test('COACH — page disponibilités charge avec contenu', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'coach')
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
  await loginAs(page, 'student')
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
  await loginAs(page, 'admin')
  await page.goto(`${BASE}/dashboard/admin/users`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)

  // Find search input
  const search = page.locator('input[placeholder*="cherche" i], input[placeholder*="search" i], input[type="search"]').first()
  await expect(search).toBeVisible()
  // La recherche portait sur le mot generique « parent », puis exigeait un
  // e-mail precis. Or plusieurs specs creent des parents supplementaires —
  // inscription publique, onboarding, cycle de vie des comptes en attente — et
  // la liste est paginee : le compte seedé sortait de la premiere page et le
  // test echouait selon ce qui l'avait precede.
  //
  // Chercher l'adresse exacte prouve mieux ce que le test annonce : la
  // recherche RETROUVE un utilisateur donne, quel que soit le nombre de comptes
  // presents.
  await search.fill(CREDS.parent.email)
  await expect(page.getByText(CREDS.parent.email, { exact: false }).first()).toBeVisible()
})

// ======================================================
// DÉCONNEXION FONCTIONNE
// ======================================================
test('DÉCONNEXION — admin redirigé après logout', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'admin')

  const logoutBtn = page.getByRole('button', { name: /se déconnecter de votre compte/i })
  await expect(logoutBtn).toBeVisible()
  await Promise.all([
    page.waitForURL((url) => ['/', '/auth/signin'].includes(url.pathname)),
    logoutBtn.click(),
  ])
})

test('DÉCONNEXION — parent redirigé après logout', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'parent')

  const logoutBtn = page.getByRole('button', { name: /se déconnecter de votre compte/i })
  await expect(logoutBtn).toBeVisible()
  await Promise.all([
    page.waitForURL((url) => ['/', '/auth/signin'].includes(url.pathname)),
    logoutBtn.click(),
  ])
})
