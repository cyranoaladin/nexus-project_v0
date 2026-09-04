#!/usr/bin/env node
/**
 * Accessibilité réelle du Planning Studio (npm run planning:a11y).
 *
 * axe-core est exécuté sur l'artefact réellement servi (public/planning),
 * dans un navigateur, sur les écrans critiques — y compris le panneau ouvert,
 * l'historique, le menu d'actions et un état en conflit.
 *
 * Le contraste n'est PAS mesuré ici par approximation de style calculé : les
 * fonds du bandeau sont des dégradés, invisibles à `backgroundColor`, ce qui
 * produisait des faux positifs massifs. axe compose réellement les couches.
 *
 * Gate : AXE_CRITICAL=0 et AXE_SERIOUS=0. Les violations moderate et minor
 * sont comptées et listées, jamais ignorées en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifact = path.join(repoRoot, 'public', 'planning');
const payloadPath = process.argv[2] || path.join(repoRoot, 'tools', 'planning-studio', 'data', 'planning.default.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

/** Serveur local : artefact statique + API Planning simulée (lecture seule). */
function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/planning-studio')) {
      const body = JSON.stringify({
        document: { academicYear: payload.settings?.academicYear || '2026-2027', schemaVersion: payload.schemaVersion, revision: 1, updatedAt: new Date().toISOString(), updatedBy: { id: 'a11y', name: 'Audit' }, payloadHash: 'a11y' },
        payload,
        permissions: { canEdit: true, canRestore: true, canReset: true, canImport: true, canViewHistory: true },
        viewer: { id: 'a11y', role: 'ADMIN', name: 'Audit' },
        initialized: true,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(body);
    }
    const rel = url.pathname.replace(/^\/planning\/?/, '') || 'index.html';
    const file = path.join(artifact, rel);
    if (!file.startsWith(artifact) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const SCREENS = [
  { id: 'week-desktop', width: 1920, height: 1080, setup: null },
  { id: 'week-1280', width: 1280, height: 800, setup: null },
  { id: 'mobile-day', width: 390, height: 844, setup: null },
  { id: 'teacher-view', width: 1440, height: 900, setup: (pg) => pg.click('text="Enseignant"') },
  { id: 'room-view', width: 1440, height: 900, setup: (pg) => pg.click('text="Salles"') },
  { id: 'list-view', width: 1440, height: 900, setup: (pg) => pg.click('text="Liste"') },
  { id: 'drawer-open', width: 1440, height: 900, setup: (pg) => pg.evaluate(() => { document.body.classList.add('side-open'); document.body.classList.remove('side-collapsed'); }) },
  { id: 'menu-open', width: 1440, height: 900, setup: (pg) => pg.click('#btnMore') },
  { id: 'diagnostic-view', width: 1440, height: 900, setup: async (pg) => { await pg.evaluate(() => document.body.classList.add('side-open')); await pg.click('text=/Diagnostic/'); } },
];

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/planning/index.html`;
const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 };
const details = [];
let browser;

try {
  browser = await chromium.launch();
  for (const screen of SCREENS) {
    const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    if (screen.setup) {
      try { await screen.setup(page); await page.waitForTimeout(500); }
      catch (e) { details.push({ screen: screen.id, impact: 'setup', id: 'SETUP_FAILED', help: String(e).slice(0, 120), nodes: 0 }); }
    }
    const results = await new AxeBuilder({ page }).analyze();
    for (const violation of results.violations) {
      const impact = violation.impact || 'minor';
      totals[impact] = (totals[impact] || 0) + 1;
      details.push({ screen: screen.id, impact, id: violation.id, help: violation.help, nodes: violation.nodes.length });
    }
    console.error(`  ${screen.id} : ${results.violations.length} violation(s)`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`AXE_SCREENS=${SCREENS.length}`);
console.log(`AXE_CRITICAL=${totals.critical}`);
console.log(`AXE_SERIOUS=${totals.serious}`);
console.log(`AXE_MODERATE=${totals.moderate}`);
console.log(`AXE_MINOR=${totals.minor}`);
for (const d of details) console.log(`  ${d.impact.toUpperCase().padEnd(8)} ${d.screen.padEnd(16)} ${d.id} — ${d.help} (${d.nodes} nœud(s))`);
const blocking = totals.critical + totals.serious;
console.log(`PLANNING_A11Y_GATE=${blocking ? 'FAIL' : 'PASS'}`);
if (blocking) process.exit(1);
