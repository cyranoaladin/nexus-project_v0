#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const REPORT_PATH = path.join(ROOT, 'test-results', 'contrast-audit.json');
const BASE_URL = process.env.CONTRAST_BASE_URL || 'https://nexus.local:18443';
const require = createRequire(import.meta.url);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let out = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'api') continue;
      out = out.concat(walk(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name === 'page.tsx') out.push(fullPath);
  }
  return out;
}

function routeFromPagePath(pagePath) {
  const rel = path.relative(APP_DIR, pagePath);
  const parts = rel.split(path.sep).slice(0, -1);
  const clean = parts.filter((segment) => {
    if (!segment) return false;
    if (segment.startsWith('(') && segment.endsWith(')')) return false;
    if (segment.startsWith('[') && segment.endsWith(']')) return false;
    if (segment.startsWith('@')) return false;
    return true;
  });
  return `/${clean.join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

async function run() {
  const pageFiles = walk(APP_DIR);
  const routes = uniqueSorted(pageFiles.map(routeFromPagePath));

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  const results = [];
  for (const route of routes) {
    const url = new URL(route, BASE_URL).toString();
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const axeResult = await page.evaluate(async () => {
        // @ts-ignore
        return axe.run(document, {
          runOnly: { type: 'rule', values: ['color-contrast'] },
        });
      });

      results.push({
        route,
        finalUrl: page.url(),
        violations: axeResult.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        })),
      });
    } catch (error) {
      results.push({
        route,
        finalUrl: page.url(),
        error: error instanceof Error ? error.message : String(error),
        violations: [],
      });
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const failedRoutes = results.filter((r) => r.violations.length > 0).length;
  const errorRoutes = results.filter((r) => r.error).length;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routesChecked: routes.length,
    failedRoutes,
    errorRoutes,
    totalViolations,
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`Contrast audit completed for ${routes.length} routes.`);
  console.log(`Violations: ${totalViolations} across ${failedRoutes} route(s).`);
  console.log(`Errors: ${errorRoutes} route(s).`);
  console.log(`Report: ${REPORT_PATH}`);
}

run().catch((error) => {
  console.error('Contrast audit failed:', error);
  process.exit(1);
});
