import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const BASE = 'http://localhost:3000'
const report: any[] = []

async function checkPage(page: any, url: string) {
  const jsErrors: string[] = []
  const netErrors: string[] = []
  
  page.on('console', (m: any) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) {
      jsErrors.push(m.text().substring(0, 150))
    }
  })
  page.on('response', (r: any) => {
    if (r.status() >= 400 && !r.url().includes('favicon') && !r.url().includes('_next')) {
      netErrors.push(`[${r.status()}] ${r.url().substring(0, 80)}`)
    }
  })
  
  const resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 20000 })
  const http = resp?.status() || 0
  await page.waitForTimeout(500)
  
  const safeName = url.replace(/[^a-zA-Z0-9]/g, '_')
  fs.mkdirSync('/tmp/pages', { recursive: true })
  await page.screenshot({ path: `/tmp/pages${safeName}.png` })
  
  const issues = [
    ...(http !== 200 ? [`HTTP ${http}`] : []),
    ...jsErrors.map(e => `JS: ${e}`),
    ...netErrors,
  ]
  
  const ok = issues.length === 0
  console.log(`${ok ? '✅' : '❌'} [${http}] ${url}${ok ? '' : '\n   └─ ' + issues.slice(0,3).join('\n   └─ ')}`)
  report.push({ url, http, issues, ok })
}

test('Toutes les pages publiques', async ({ page }) => {
  const PAGES = [
    '/', '/offres', '/bilan-gratuit', '/contact',
    '/stages', '/stages/fevrier-2026',
    '/bilan-pallier2-maths', '/programme/maths-1ere',
    '/accompagnement-scolaire', '/plateforme-aria',
    '/equipe', '/notre-centre', '/conditions', '/mentions-legales',
    '/auth/signin',
  ]
  
  for (const url of PAGES) {
    await checkPage(page, url)
    await page.removeAllListeners()
  }
  
  fs.writeFileSync('/tmp/pages-report.json', JSON.stringify(report, null, 2))
  
  const failed = report.filter(r => !r.ok)
  console.log(`\n=== RÉSUMÉ: ${report.length - failed.length} OK, ${failed.length} ERREURS ===`)
  
  expect(failed.length, 
    `${failed.length} pages cassées:\n` + failed.map(f => `  ${f.url}: ${f.issues[0]}`).join('\n')
  ).toBe(0)
})
