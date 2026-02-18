import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const TEST_DIRS = [path.join(ROOT, '__tests__'), path.join(ROOT, 'e2e')];

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

function normalizeRoute(filePath) {
  const rel = path.relative(APP_DIR, filePath).replace(/\\/g, '/');
  const noFile = rel.replace(/(^|\/)(page\.tsx|route\.ts)$/, '');
  const cleaned = noFile
    .split('/')
    .filter((seg) => seg && !/^\(.*\)$/.test(seg))
    .join('/');
  return cleaned ? `/${cleaned}` : '/';
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function detectRoles(content) {
  const roles = new Set();
  const roleRegexes = [
    /UserRole\.([A-Z_]+)/g,
    /session\.user\.role\s*!==\s*'([A-Z_]+)'/g,
    /session\.user\.role\s*===\s*'([A-Z_]+)'/g,
    /allowedRoles:\s*\[([^\]]+)\]/g,
  ];

  for (const rx of roleRegexes) {
    let m;
    while ((m = rx.exec(content)) !== null) {
      if (rx.source.includes('allowedRoles')) {
        const inner = m[1] || '';
        const roleMatches = inner.match(/UserRole\.([A-Z_]+)/g) || [];
        for (const r of roleMatches) roles.add(r.replace('UserRole.', ''));
      } else if (m[1]) {
        roles.add(m[1]);
      }
    }
  }

  return [...roles];
}

function detectPolicyKeys(content) {
  const keys = [];
  const rx = /enforcePolicy\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = rx.exec(content)) !== null) keys.push(m[1]);
  return dedupe(keys);
}

function detectFeatures(content) {
  const features = [];
  const rx = /requireFeatureApi\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(content)) !== null) features.push(m[1]);
  return dedupe(features);
}

function detectMethods(content) {
  const methods = new Set();

  let m;
  const fnRx = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g;
  while ((m = fnRx.exec(content)) !== null) methods.add(m[1]);

  const aliasRx = /export\s*\{([^}]+)\}/g;
  while ((m = aliasRx.exec(content)) !== null) {
    const block = m[1];
    const methodMatches = block.match(/as\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g) || [];
    for (const mm of methodMatches) methods.add(mm.replace('as ', ''));
  }

  return [...methods].sort();
}

function detectGuardSymbols(content) {
  const checks = [
    ['getServerSession', /getServerSession\(/],
    ['requireAuth', /requireAuth\(/],
    ['requireRole', /requireRole\(/],
    ['requireAnyRole', /requireAnyRole\(/],
    ['enforcePolicy', /enforcePolicy\(/],
    ['requireFeatureApi', /requireFeatureApi\(/],
    ['requireFeature', /requireFeature\(/],
    ['session.user.role check', /session\.user\.role\s*[!=]==?/],
  ];

  return checks.filter(([, rx]) => rx.test(content)).map(([label]) => label);
}

function classifyPageRoute(route, content) {
  if (route.startsWith('/dashboard/admin') || route.startsWith('/admin')) return 'admin';
  if (route.startsWith('/dashboard')) return 'dashboard';
  if (route.startsWith('/auth')) return 'auth';
  if (/getServerSession\(|useSession\(|redirect\(\s*['"]\/auth\/signin/.test(content)) return 'auth';
  return 'public';
}

function collectTestFiles() {
  const files = [];
  for (const dir of TEST_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      if (/\.(test|spec)\.(ts|tsx|js)$/.test(file)) files.push(file);
    }
  }
  return files;
}

function toRouteImportCandidates(apiFile) {
  const noExt = apiFile.replace(/\.ts$/, '');
  const rel = noExt.replace(/\\/g, '/');
  return [
    `@/${rel}`,
    rel,
    `./${rel}`,
    `../${rel}`,
  ];
}

function detectTestsForApi(apiRoute, apiFile, testFiles) {
  const refs = [];
  const importCandidates = toRouteImportCandidates(apiFile);
  for (const f of testFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const hasRouteString = content.includes(apiRoute);
    const hasImportRef = importCandidates.some((candidate) => content.includes(candidate));
    if (hasRouteString || hasImportRef) {
      refs.push(path.relative(ROOT, f).replace(/\\/g, '/'));
    }
  }
  return dedupe(refs);
}

function parseRbacPolicies() {
  const file = path.join(ROOT, 'lib', 'rbac.ts');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');

  const policies = [];
  const blockRx = /'([^']+)'\s*:\s*\{([\s\S]*?)\n\s*\},/g;
  let m;
  while ((m = blockRx.exec(content)) !== null) {
    const key = m[1];
    const block = m[2];

    const roles = [];
    const rolesRx = /UserRole\.([A-Z_]+)/g;
    let rm;
    while ((rm = rolesRx.exec(block)) !== null) roles.push(rm[1]);

    const descMatch = block.match(/description:\s*'([^']+)'/);
    policies.push({
      key,
      allowedRoles: dedupe(roles),
      description: descMatch ? descMatch[1] : undefined,
    });
  }

  return policies.sort((a, b) => a.key.localeCompare(b.key));
}

function run() {
  const files = walk(APP_DIR);
  const pageFiles = files.filter((f) => f.endsWith('/page.tsx'));
  const apiFiles = files.filter((f) => f.endsWith('/route.ts'));
  const testFiles = collectTestFiles();

  const pages = pageFiles.map((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const route = normalizeRoute(file);
    return {
      route,
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      segmentType: classifyPageRoute(route, content),
      guardsDetected: detectGuardSymbols(content),
    };
  }).sort((a, b) => a.route.localeCompare(b.route));

  const apiRoutes = apiFiles.map((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const route = normalizeRoute(file);
    return {
      route,
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      methods: detectMethods(content),
      authDetected: /getServerSession\(|require(Auth|Role|AnyRole)\(|enforcePolicy\(|requireFeature(Api)?\(/.test(content),
      guardSymbols: detectGuardSymbols(content),
      rolesDetected: detectRoles(content),
      policyKeys: detectPolicyKeys(content),
      featuresDetected: detectFeatures(content),
      tests: detectTestsForApi(route, path.relative(ROOT, file), testFiles),
    };
  }).sort((a, b) => a.route.localeCompare(b.route));

  const dashboardsByRole = {
    ELEVE: pages.filter((p) => p.route.startsWith('/dashboard/eleve')).map((p) => p.route),
    PARENT: pages.filter((p) => p.route.startsWith('/dashboard/parent')).map((p) => p.route),
    COACH: pages.filter((p) => p.route.startsWith('/dashboard/coach')).map((p) => p.route),
    ASSISTANTE: pages.filter((p) => p.route.startsWith('/dashboard/assistante')).map((p) => p.route),
    ADMIN: pages.filter((p) => p.route.startsWith('/dashboard/admin')).map((p) => p.route),
  };

  const sensitiveAdminApi = apiRoutes
    .filter((r) => r.route.startsWith('/api/admin') || r.rolesDetected.includes('ADMIN'))
    .map((r) => ({
      route: r.route,
      methods: r.methods,
      rolesDetected: r.rolesDetected,
      tests: r.tests,
      testCoverage: r.tests.length > 0 ? 'covered' : 'missing',
      file: r.file,
    }));

  const apiCoverage = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/docs/route_inventory.js',
    adminSensitive: {
      total: sensitiveAdminApi.length,
      covered: sensitiveAdminApi.filter((r) => r.tests.length > 0).length,
      missing: sensitiveAdminApi.filter((r) => r.tests.length === 0).length,
      missingTests: sensitiveAdminApi.filter((r) => r.tests.length === 0),
    },
    allApi: {
      total: apiRoutes.length,
      covered: apiRoutes.filter((r) => r.tests.length > 0).length,
      missing: apiRoutes.filter((r) => r.tests.length === 0).length,
    },
  };

  const routeInventory = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/docs/route_inventory.js',
    counts: {
      pages: pages.length,
      apiRoutes: apiRoutes.length,
      publicPages: pages.filter((p) => p.segmentType === 'public').length,
      dashboardPages: pages.filter((p) => p.segmentType === 'dashboard' || p.segmentType === 'admin').length,
      adminApi: sensitiveAdminApi.length,
    },
    pages,
    apiRoutes,
    dashboardsByRole,
    sensitiveAdminApi,
  };

  const rbacPolicies = parseRbacPolicies();
  const rbacMatrix = {
    generatedAt: new Date().toISOString(),
    source: 'lib/rbac.ts',
    policyCount: rbacPolicies.length,
    policies: rbacPolicies,
    apiPolicyUsages: apiRoutes
      .filter((r) => r.policyKeys.length > 0)
      .map((r) => ({ route: r.route, file: r.file, policyKeys: r.policyKeys })),
  };

  const outRoutes = path.join(ROOT, 'docs', '_generated', 'routes.json');
  const outRbac = path.join(ROOT, 'docs', '_generated', 'rbac_matrix.json');
  const outCoverage = path.join(ROOT, 'docs', '_generated', 'rbac_coverage.json');

  fs.mkdirSync(path.dirname(outRoutes), { recursive: true });
  fs.writeFileSync(outRoutes, `${JSON.stringify(routeInventory, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outRbac, `${JSON.stringify(rbacMatrix, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outCoverage, `${JSON.stringify(apiCoverage, null, 2)}\n`, 'utf8');

  console.log(`Generated ${path.relative(ROOT, outRoutes)}, ${path.relative(ROOT, outRbac)}, ${path.relative(ROOT, outCoverage)}`);
}

run();
