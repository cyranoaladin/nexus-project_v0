#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const E2E_DIR = path.join(ROOT, 'e2e');
const NAV_MAP_PATH = path.join(ROOT, 'NAVIGATION_MAP.md');
const NEXT_CONFIG_PATH = path.join(ROOT, 'next.config.mjs');
const OUT_JSON = path.join(ROOT, 'docs/tests/ROUTE_INVENTORY.json');
const OUT_MD = path.join(ROOT, 'docs/tests/ROUTE_DIFF.md');

const CONTRACT_PAGE_ROUTES = [
  '/',
  '/offres',
  '/bilan-gratuit',
  '/bilan-gratuit/confirmation',
  '/stages',
  '/stages/fevrier-2026',
  '/stages/fevrier-2026/diagnostic',
  '/contact',
  '/accompagnement-scolaire',
  '/plateforme-aria',
  '/equipe',
  '/notre-centre',
  '/famille',
  '/academy',
  '/consulting',
  '/programme/*',
  '/conditions',
  '/mentions-legales',
  '/auth/signin',
  '/auth/activate',
  '/auth/mot-de-passe-oublie',
  '/auth/reset-password',
  '/dashboard',
  '/dashboard/admin',
  '/dashboard/admin/users',
  '/dashboard/admin/analytics',
  '/dashboard/admin/subscriptions',
  '/dashboard/admin/activities',
  '/dashboard/admin/tests',
  '/dashboard/admin/documents',
  '/dashboard/admin/facturation',
  '/dashboard/assistante',
  '/dashboard/assistante/students',
  '/dashboard/assistante/coaches',
  '/dashboard/assistante/subscriptions',
  '/dashboard/assistante/credit-requests',
  '/dashboard/assistante/paiements',
  '/dashboard/assistante/subscription-requests',
  '/dashboard/assistante/credits',
  '/dashboard/assistante/docs',
  '/dashboard/coach',
  '/dashboard/coach/sessions',
  '/dashboard/coach/students',
  '/dashboard/coach/availability',
  '/dashboard/parent',
  '/dashboard/parent/children',
  '/dashboard/parent/abonnements',
  '/dashboard/parent/paiement',
  '/dashboard/parent/ressources',
  '/dashboard/eleve',
  '/dashboard/eleve/mes-sessions',
  '/dashboard/eleve/sessions',
  '/dashboard/eleve/ressources',
  '/dashboard/trajectoire',
  '/access-required',
  '/inscription',
  '/questionnaire',
  '/tarifs',
  '/academies-hiver',
  '/plateforme',
  '/education',
];

const CONTRACT_API_ROUTES = [
  '/api/contact',
  '/api/bilan-gratuit',
  '/api/auth/reset-password',
  '/api/reservation',
  '/api/stages/submit-diagnostic',
  '/api/aria/chat',
];

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs));
      continue;
    }
    out.push(abs);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function normalizeRouteFromPage(file) {
  const rel = toPosix(path.relative(ROOT, file));
  const appRel = rel.replace(/^app\//, '');
  const noPage = appRel.replace(/\/?page\.tsx$/, '');
  const parts = noPage
    .split('/')
    .filter(Boolean)
    .filter((p) => !(p.startsWith('(') && p.endsWith(')')));
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function normalizeRouteFromApi(file) {
  const rel = toPosix(path.relative(ROOT, file));
  const appRel = rel.replace(/^app\//, '');
  const noRoute = appRel.replace(/\/route\.ts$/, '');
  return `/${noRoute}`;
}

function routeType(route) {
  if (route.startsWith('/api/')) return 'api';
  if (route === '/dashboard' || route.startsWith('/dashboard/')) return 'dashboard';
  if (route.startsWith('/auth/')) return 'auth';
  return 'public';
}

function wildcardMatch(pattern, route) {
  if (!pattern.includes('*')) return pattern === route;
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${esc}$`).test(route);
}

function isDocumented(route, documented) {
  return documented.some((d) => wildcardMatch(d, route));
}

function collectE2EFiles() {
  if (!fs.existsSync(E2E_DIR)) return [];
  return walk(E2E_DIR)
    .filter((f) => f.endsWith('.spec.ts') || f.endsWith('.setup.ts'))
    .map((f) => toPosix(path.relative(ROOT, f)))
    .sort();
}

function routeReferencedInTests(route, testContent) {
  if (route.includes('[') || route.includes('*')) return false;
  if (route === '/') {
    return /goto\(['"]\/?['"]\)/.test(testContent);
  }
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['\"]${escaped}(['\"?/#])`).test(testContent)
    || new RegExp(`['\"]${escaped}['\"]`).test(testContent);
}

function extractRedirectSources() {
  if (!fs.existsSync(NEXT_CONFIG_PATH)) return [];
  const raw = fs.readFileSync(NEXT_CONFIG_PATH, 'utf8');
  const matches = [...raw.matchAll(/source:\s*['"]([^'"]+)['"]/g)];
  return matches
    .map((m) => m[1])
    .filter((r) => r.startsWith('/'))
    .sort();
}

function main() {
  const allFiles = walk(APP_DIR).map((f) => toPosix(path.relative(ROOT, f)));
  const pageFiles = allFiles.filter((f) => f.endsWith('/page.tsx')).sort();
  const apiFiles = allFiles.filter((f) => /^app\/api\/.+\/route\.ts$/.test(f)).sort();

  const pageRoutes = pageFiles.map((rel) => {
    const abs = path.join(ROOT, rel);
    const route = normalizeRouteFromPage(abs);
    return { file: rel, route, type: routeType(route) };
  });

  const apiRoutes = apiFiles.map((rel) => {
    const abs = path.join(ROOT, rel);
    const route = normalizeRouteFromApi(abs);
    return { file: rel, route, type: 'api' };
  });

  const navMarkdown = fs.readFileSync(NAV_MAP_PATH, 'utf8');
  const documentedRoutes = [...CONTRACT_PAGE_ROUTES, ...CONTRACT_API_ROUTES].sort();
  const documentedPageRoutes = documentedRoutes.filter((r) => !r.startsWith('/api/'));
  const documentedApiRoutes = documentedRoutes.filter((r) => r.startsWith('/api/'));

  const redirectSources = extractRedirectSources();
  const allCodeRoutes = [...pageRoutes.map((r) => r.route), ...apiRoutes.map((r) => r.route), ...redirectSources];

  const undocumentedInCode = allCodeRoutes
    .filter((route) => !isDocumented(route, documentedRoutes))
    .sort();

  const documentedMissingInCode = documentedRoutes
    .filter((route) => !isDocumented(route, allCodeRoutes))
    .sort();

  const e2eFiles = collectE2EFiles();
  const e2eContent = e2eFiles
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');

  const pageCoverage = pageRoutes.map((r) => ({
    route: r.route,
    file: r.file,
    type: r.type,
    referencedInE2E: routeReferencedInTests(r.route, e2eContent),
  }));

  const routesMissingInTests = pageCoverage
    .filter((r) => !r.referencedInE2E)
    .map((r) => ({ route: r.route, file: r.file, type: r.type }))
    .sort((a, b) => a.route.localeCompare(b.route));

  const inventory = {
    generatedAt: new Date().toISOString(),
    source: {
      appDir: 'app/**/page.tsx + app/api/**/route.ts',
      navMap: 'NAVIGATION_MAP.md',
      contractPageRoutes: CONTRACT_PAGE_ROUTES,
      contractApiRoutes: CONTRACT_API_ROUTES,
      e2eSpecsScanned: e2eFiles,
      redirectSources,
    },
    counts: {
      pages: pageRoutes.length,
      apis: apiRoutes.length,
      documentedRoutes: documentedRoutes.length,
      documentedPageRoutes: documentedPageRoutes.length,
      documentedApiRoutes: documentedApiRoutes.length,
      undocumentedInCode: undocumentedInCode.length,
      documentedMissingInCode: documentedMissingInCode.length,
      routesMissingInTests: routesMissingInTests.length,
    },
    routes: {
      pages: pageRoutes,
      apis: apiRoutes,
    },
    coverage: {
      pageContractCoverage: pageCoverage,
      routesMissingInTests,
    },
    diff: {
      undocumentedInCode,
      documentedMissingInCode,
    },
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(inventory, null, 2));

  const md = [
    '# Route Diff Report',
    '',
    `Generated: ${inventory.generatedAt}`,
    '',
    '## Counts',
    '',
    `- Pages detectees: ${inventory.counts.pages}`,
    `- API routes detectees: ${inventory.counts.apis}`,
    `- Routes documentees (NAVIGATION_MAP): ${inventory.counts.documentedRoutes}`,
    `- Routes non documentees dans le code: ${inventory.counts.undocumentedInCode}`,
    `- Routes documentees absentes du code: ${inventory.counts.documentedMissingInCode}`,
    `- Routes pages non referencees dans les specs E2E (heuristique): ${inventory.counts.routesMissingInTests}`,
    '',
    '## Routes Documentees Absentes Du Code',
    '',
    ...(documentedMissingInCode.length ? documentedMissingInCode.map((r) => `- \`${r}\``) : ['- Aucune']),
    '',
    '## Routes Du Code Non Documentees',
    '',
    ...(undocumentedInCode.length ? undocumentedInCode.map((r) => `- \`${r}\``) : ['- Aucune']),
    '',
    '## Routes Pages Potentiellement Manquantes Dans Les Tests E2E',
    '',
    ...(routesMissingInTests.length
      ? routesMissingInTests.map((r) => `- \`${r.route}\` (${r.type}) — \`${r.file}\``)
      : ['- Aucune']),
    '',
    '## Notes',
    '',
    `- Lignes NAVIGATION_MAP lues: ${navMarkdown.split('\n').length}.`,
    '- Les routes contractuelles sont explicitées dans `scripts/generate-route-inventory.mjs` (source: NAVIGATION_MAP.md).',
    '- La detection de couverture E2E est basee sur la presence textuelle des routes dans les specs.',
    '- Les patterns dynamiques (`[id]`) et wildcards (`*`) necessitent des tests parametrés dedies.',
  ].join('\n');

  fs.writeFileSync(OUT_MD, `${md}\n`);

  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
}

main();
