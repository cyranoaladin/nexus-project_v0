import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'

const BASE = 'http://localhost:3000'
const report: { url: string; http: number; issues: string[]; ok: boolean }[] = []

async function loginAs(page: Page, email: string, pwd: string, waitPath: string) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(pwd)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(`**${waitPath}**`, { timeout: 30000 })
}

async function testPage(page: Page, url: string) {
  const jsErrors: string[] = []
  const netErrors: string[] = []
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text()
      // Filter known non-breaking console errors
      if (t.includes('favicon') || t.includes('ClientFetchError') || t.includes('Failed to fetch') || t.includes('hydration') || t.includes('Failed to load resource') || t.includes('net::ERR')) return
      jsErrors.push(t.substring(0, 100))
    }
  })
  page.on('response', r => {
    if (r.status() >= 500 && !r.url().includes('favicon') && !r.url().includes('_next/')) {
      netErrors.push(`[${r.status()}] ${new URL(r.url()).pathname}`)
    }
  })

  let resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 30000 }).catch(() => null)
  if (!resp) {
    // Retry once on timeout
    resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 30000 }).catch(() => null)
  }
  const http = resp?.status() || 0
  await page.waitForTimeout(700)

  fs.mkdirSync('/tmp/dash', { recursive: true })
  await page.screenshot({ path: `/tmp/dash/${url.replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {})

  const redirectedToSignin = page.url().includes('/auth/signin') && !url.includes('/auth/')
  const issues = [
    ...(http !== 200 ? [`HTTP_${http}`] : []),
    ...(redirectedToSignin ? ['AUTH_REDIRECT'] : []),
    ...jsErrors.slice(0, 2),
    ...netErrors.slice(0, 2)
  ]
  const ok = issues.length === 0
  console.log(`${ok ? '✅' : '❌'} [${http}] ${url.padEnd(48)} ${issues.join(' ')}`)
  report.push({ url, http, issues, ok })
  page.removeAllListeners()
}

test('Admin — toutes les pages', async ({ page }) => {
  test.setTimeout(120000)
  await loginAs(page, 'admin@nexus-reussite.com', 'admin123', '/dashboard/admin')
  const pages = [
    '/dashboard/admin', '/dashboard/admin/users', '/dashboard/admin/analytics',
    '/dashboard/admin/subscriptions', '/dashboard/admin/activities',
    '/dashboard/admin/tests', '/dashboard/admin/facturation',
    '/admin/directeur', '/admin/stages/fevrier-2026',
  ]
  for (const url of pages) await testPage(page, url)
})

test('Assistante — toutes les pages', async ({ page }) => {
  test.setTimeout(120000)
  await loginAs(page, 'assistante@nexus-reussite.com', 'admin123', '/dashboard/assistante')
  const pages = [
    '/dashboard/assistante', '/dashboard/assistante/students', '/dashboard/assistante/coaches',
    '/dashboard/assistante/subscriptions', '/dashboard/assistante/credit-requests',
    '/dashboard/assistante/subscription-requests', '/dashboard/assistante/credits',
    '/dashboard/assistante/paiements', '/dashboard/assistante/docs',
  ]
  for (const url of pages) await testPage(page, url)
})

test('Coach — toutes les pages', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'helios@nexus-reussite.com', 'admin123', '/dashboard/coach')
  const pages = [
    '/dashboard/coach', '/dashboard/coach/sessions',
    '/dashboard/coach/students', '/dashboard/coach/availability',
  ]
  for (const url of pages) await testPage(page, url)
})

test('Parent — toutes les pages', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'parent@example.com', 'admin123', '/dashboard/parent')
  const pages = [
    '/dashboard/parent', '/dashboard/parent/children',
    '/dashboard/parent/abonnements', '/dashboard/parent/paiement',
  ]
  for (const url of pages) await testPage(page, url)
})

test('Élève — toutes les pages', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'student@example.com', 'admin123', '/dashboard/eleve')
  const pages = [
    '/dashboard/eleve', '/dashboard/eleve/mes-sessions',
    '/dashboard/eleve/sessions', '/dashboard/eleve/ressources',
    '/dashboard/trajectoire',
  ]
  for (const url of pages) await testPage(page, url)
})

test('Pages spéciales authentifiées', async ({ page }) => {
  test.setTimeout(60000)
  await loginAs(page, 'student@example.com', 'admin123', '/dashboard/eleve')
  const pages = [
    '/session/video', '/access-required',
  ]
  for (const url of pages) await testPage(page, url)
})

test.afterAll(() => {
  const ok = report.filter(r => r.ok).length
  const bad = report.filter(r => !r.ok)
  fs.writeFileSync('/tmp/dash-report.json', JSON.stringify(report, null, 2))
  console.log(`\n${'='.repeat(55)}`)
  console.log(`DASHBOARDS: ${ok} OK | ${bad.length} ERREUR(S) / ${report.length} pages`)
  bad.forEach(p => console.log(`  ❌ ${p.url}: ${p.issues.join(', ')}`))
  console.log('Screenshots: /tmp/dash/')
})
