/**
 * Accessibility gate for every live dashboard (go-live §AU / §24), all roles ×
 * all routes of test-all-dashboard-pages.spec.ts, on the real authenticated
 * stack. axe-core on each page after it settled:
 *   - critical = 0, serious = 0 (includes every colour-contrast finding,
 *     unlabelled controls, missing button/link names, keyboard traps);
 *   - the full result set (including moderate/minor) is written to a
 *     machine-readable artifact so nothing is hidden behind the threshold.
 * Uses REAL auth via loginAsUser (CSRF → callback → session). No retries.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loginAsUser, type UserType } from '../helpers/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const ARTIFACT = path.join('test-results', 'a11y', 'dashboards-axe.json');

interface PageResult {
  readonly role: UserType;
  readonly url: string;
  readonly finalUrl: string;
  readonly violations: Array<{
    id: string;
    impact: string | null | undefined;
    help: string;
    nodes: Array<{ target: string; html: string; failureSummary: string | undefined; data: unknown }>;
  }>;
}

const results: PageResult[] = [];

const ROUTES: Record<Extract<UserType, 'admin' | 'assistante' | 'coach' | 'parent' | 'student'>, string[]> = {
  admin: ['/dashboard/admin', '/dashboard/admin/users', '/dashboard/admin/analytics', '/dashboard/admin/subscriptions', '/dashboard/admin/activities', '/dashboard/admin/tests', '/dashboard/admin/facturation'],
  assistante: [
    '/dashboard/assistante',
    '/dashboard/assistante/students',
    '/dashboard/assistante/coaches',
    '/dashboard/assistante/subscriptions',
    '/dashboard/assistante/credit-requests',
    '/dashboard/assistante/subscription-requests',
    '/dashboard/assistante/credits',
    '/dashboard/assistante/paiements',
    '/dashboard/assistante/docs',
  ],
  coach: ['/dashboard/coach', '/dashboard/coach/sessions', '/dashboard/coach/students', '/dashboard/coach/availability'],
  parent: ['/dashboard/parent', '/dashboard/parent/children', '/dashboard/parent/abonnements', '/dashboard/parent/paiement'],
  student: ['/dashboard/eleve', '/dashboard/eleve/sessions', '/dashboard/eleve/ressources', '/dashboard/trajectoire'],
};

async function audit(page: Page, role: UserType, url: string): Promise<void> {
  await page.goto(BASE_URL + url, { waitUntil: 'load', timeout: 30_000 });
  // Client-side dashboards fetch their data after mount; let the first paint of data settle.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const axe = await new AxeBuilder({ page }).analyze();
  results.push({
    role,
    url,
    finalUrl: page.url(),
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html, failureSummary: n.failureSummary, data: n.any[0]?.data ?? null })),
    })),
  });
}

for (const [role, routes] of Object.entries(ROUTES) as Array<[keyof typeof ROUTES, string[]]>) {
  test(`axe — ${role} dashboards`, async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsUser(page, role, { navigate: false });
    for (const url of routes) await audit(page, role, url);
    // Per-role artifact written before the assertion: a failing role still leaves its evidence
    // (Playwright restarts the worker after a failure, so afterAll alone would lose it).
    fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
    fs.writeFileSync(ARTIFACT.replace('.json', `.${role}.json`), JSON.stringify(results.filter((r) => r.role === role), null, 2));
    const blocking = results
      .filter((r) => r.role === role)
      .flatMap((r) => r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${r.url} ${v.id}: ${v.nodes.map((n) => `${n.target} ${JSON.stringify(n.data)}`).join(' | ')}`));
    expect(blocking).toEqual([]);
  });
}

test.afterAll(() => {
  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    pages: results.length,
    bySeverity: results.reduce<Record<string, number>>((acc, r) => {
      for (const v of r.violations) acc[v.impact ?? 'unknown'] = (acc[v.impact ?? 'unknown'] ?? 0) + v.nodes.length;
      return acc;
    }, {}),
    results,
  };
  fs.writeFileSync(ARTIFACT, JSON.stringify(summary, null, 2));
  console.log(`A11Y_DASHBOARDS pages=${summary.pages} ${JSON.stringify(summary.bySeverity)} → ${ARTIFACT}`);
  for (const r of results) {
    for (const v of r.violations) console.log(`  [${v.impact}] ${r.role} ${r.url} ${v.id} ×${v.nodes.length}`);
  }
});
