#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const { linkAllowlist } = require('./link-allowlist.cjs');
const args = process.argv.slice(2);
const outDirArg = args.includes('--out-dir') ? args[args.indexOf('--out-dir') + 1] : null;
const OUT_DIR = outDirArg ? path.resolve(ROOT, outDirArg) : path.join(ROOT, 'docs', 'architecture');
const SITE_MAP = path.join(OUT_DIR, 'SITE_MAP.md');
const SITE_GRAPH = path.join(OUT_DIR, 'SITE_GRAPH.mmd');
const SSOT_MAP = path.join(OUT_DIR, 'SSOT_MAP.md');
const APP_DIR = path.join(ROOT, 'app');

const publicOrphanPolicy = {
  '/candidat-libre-bac-francais': {
    status: 'SEO-landing volontaire',
    reason: 'Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations.',
  },
  '/grand-oral': {
    status: 'SEO-landing volontaire',
    reason: 'Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations.',
  },
  '/preparation-bac-francais-tunis': {
    status: 'SEO-landing volontaire',
    reason: 'Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations.',
  },
  '/reussir-eaf': {
    status: 'SEO-landing volontaire',
    reason: 'Landing SEO T1.1 presente au sitemap et reliee au cluster Preparations.',
  },
  '/notre-centre': {
    status: 'a relier',
    reason: 'Page publique sitemappee mais seulement contextuelle; verifier son role vs /contact.',
  },
  '/ressources': {
    status: 'a relier',
    reason: 'Page publique sitemappee, faible maillage observe; clarifier hub ressources ou retrait.',
  },
  '/corrige_dnb_maths_2026': {
    status: 'a relier ou renommer',
    reason: 'Route snake_case au sitemap, aucun lien entrant public stable detecte; decision Shark requise.',
  },
  '/access-required': {
    status: 'a relier ou noindex',
    reason: 'Page technique d’acces requis, hors sitemap; verifier si elle doit rester publique.',
  },
  '/bilan-gratuit/assessment': {
    status: 'a relier ou noindex',
    reason: 'Ancien tunnel assessment hors sitemap; clarifier son entree ou son retrait.',
  },
  '/bilan-pallier2-maths/confirmation': {
    status: 'a relier ou noindex',
    reason: 'Confirmation technique hors sitemap; entree indirecte via formulaire, a documenter/noindex.',
  },
  '/conditions': {
    status: 'alias redirect',
    reason: 'Alias applicatif vers /conditions-generales; aucun lien interne ne devrait viser l’alias.',
  },
  '/maths-1ere': {
    status: 'alias redirect',
    reason: 'Alias applicatif vers /programme/maths-1ere; aucun lien interne ne devrait viser l’alias.',
  },
  '/programme/maths-1ere-stmg': {
    status: 'a relier ou noindex',
    reason: 'Page programme publique hors sitemap sans maillage detecte.',
  },
  '/programme/maths-terminale': {
    status: 'a relier ou noindex',
    reason: 'Page programme publique hors sitemap sans maillage detecte.',
  },
};

const roleNames = ['admin', 'assistante', 'coach', 'parent', 'eleve', 'directeur'];
const staticFileExtensions = /\.(pdf|png|jpe?g|webp|svg|ico|json|txt|xml|mp4|zip)$/i;

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function routeFromAppFile(absFile) {
  const rel = toPosix(path.relative(APP_DIR, absFile));
  const noFile = rel.replace(/(^|\/)(page\.tsx|route\.ts)$/, '');
  const parts = noFile
    .split('/')
    .filter(Boolean)
    .filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  return parts.length ? `/${parts.join('/')}` : '/';
}

function isClientComponent(source) {
  return /^\s*['"]use client['"];?/m.test(source);
}

function isDynamicRoute(route) {
  return route.includes('[');
}

function classifyAccess(route, source, kind) {
  if (route.startsWith('/api/internal')) return 'interne';
  if (route.startsWith('/api/auth')) return 'api auth';
  if (route.startsWith('/api/')) {
    for (const role of roleNames) {
      if (route.includes(`/${role}/`) || route.endsWith(`/${role}`)) return `api ${role}`;
    }
    if (/getServerSession|requireAuth|requireRole|requireAnyRole|enforcePolicy|session\.user/.test(source)) {
      return 'api authentifiee';
    }
    return 'api publique/technique';
  }
  if (route.startsWith('/dashboard/admin') || route.startsWith('/admin/directeur')) return 'auth admin/directeur';
  if (route.startsWith('/dashboard/assistante')) return 'auth assistante';
  if (route.startsWith('/dashboard/coach')) return 'auth coach';
  if (route.startsWith('/dashboard/parent')) return 'auth parent';
  if (route.startsWith('/dashboard/eleve')) return 'auth eleve';
  if (route === '/dashboard') return 'auth routeur role';
  if (route.startsWith('/dashboard/')) return 'auth dashboard';
  if (route.startsWith('/auth')) return 'public auth';
  if (route.startsWith('/assessments') || route.startsWith('/session')) return 'auth/session';
  return kind === 'page' ? 'public' : 'technique';
}

function inferPurpose(route, source, kind) {
  if (kind === 'api') return `Endpoint ${route.replace(/^\/api\//, '')}`;
  if (route === '/') return 'Accueil marketing et orientation conversion';
  if (route === '/offres') return 'Catalogue offres et tarifs';
  if (route === '/bilan-gratuit') return 'Tunnel public de demande de bilan';
  if (route === '/recommandation') return 'Selecteur de formule';
  if (route === '/stages') return 'Presentation stages et intensifs';
  if (route.includes('dashboard')) return 'Espace applicatif par role';
  if (route.startsWith('/auth')) return 'Authentification et recuperation compte';
  if (/landing|FAQPage|LandingNiche|seo/i.test(source)) return 'Landing SEO';
  if (route.includes('conditions') || route.includes('mentions') || route.includes('confidentialite')) return 'Legal et conformite';
  return 'Page publique ou applicative';
}

function detectDataSources(source) {
  const sources = [];
  const checks = [
    ['pricing canonical', /@\/lib\/pricing|data\/pricing\.canonical|getFullPricingData|getRules|getAll/],
    ['group-rules', /@\/lib\/group-rules|GROUP_RULES/],
    ['legal', /@\/lib\/legal|LEGAL\./],
    ['cgv-policy', /@\/lib\/cgv-policy|CGV_POLICY/],
    ['team', /content\/team|TEAM|team\.json/],
    ['social-proof', /content\/social-proof|social-proof\.json/],
    ['metadataBase', /metadataBase|alternates|canonical:/],
    ['prisma/db', /@\/lib\/prisma|prisma\./],
    ['next-auth/session', /next-auth|getServerSession|useSession/],
    ['api fetch', /fetch\(['"`]\/api|fetch\(`/],
    ['content marketing', /content\/marketing|seo-landings|landing/],
  ];
  for (const [label, rx] of checks) if (rx.test(source)) sources.push(label);
  return sources.length ? sources.join(', ') : '-';
}

function loadBuildModes() {
  const prerender = path.join(ROOT, '.next', 'prerender-manifest.json');
  const modes = new Map();
  if (fs.existsSync(prerender)) {
    const json = JSON.parse(read(prerender));
    for (const route of Object.keys(json.routes || {})) modes.set(route, 'statique');
    for (const route of Object.keys(json.dynamicRoutes || {})) modes.set(route, 'ISR/dynamique prerender');
  }
  return modes;
}

function routeRegex(route) {
  const escaped = route
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[\.{3}[^/]+\\\]/g, '.+')
    .replace(/\\\[[^/]+\\\]/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function collectRoutes() {
  const files = walk(APP_DIR);
  const buildModes = loadBuildModes();
  const routes = [];
  for (const file of files) {
    if (!file.endsWith('/page.tsx') && !file.endsWith('/route.ts')) continue;
    const source = read(file);
    const route = routeFromAppFile(file);
    const kind = file.endsWith('/route.ts') ? 'api' : 'page';
    const rel = toPosix(path.relative(ROOT, file));
    const rendering =
      kind === 'api'
        ? 'route handler'
        : buildModes.get(route) || (isDynamicRoute(route) || /force-dynamic|headers\(|cookies\(|searchParams/.test(source) ? 'dynamique' : 'statique probable');
    routes.push({
      route,
      kind,
      file: rel,
      dynamic: isDynamicRoute(route),
      rendering,
      boundary: isClientComponent(source) ? 'client' : 'server',
      access: classifyAccess(route, source, kind),
      purpose: inferPurpose(route, source, kind),
      sources: detectDataSources(source),
      source,
    });
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));
}

function parseRedirects() {
  const source = read(path.join(ROOT, 'next.config.mjs'));
  const redirects = [];
  const blockRx = /\{\s*source:\s*['"]([^'"]+)['"],\s*destination:\s*['"]([^'"]+)['"],\s*permanent:\s*(true|false)[\s\S]*?\}/g;
  let match;
  while ((match = blockRx.exec(source)) !== null) {
    redirects.push({ source: match[1], target: match[2], permanent: match[3] === 'true' });
  }
  return redirects;
}

function collectAppRedirects(edges) {
  return edges
    .filter((edge) => edge.kind === 'redirect')
    .filter((edge) => edge.from !== 'shared')
    .map((edge) => ({ source: edge.from, target: edge.to, permanent: false, file: edge.file }));
}

function parseSitemapEntries() {
  const source = read(path.join(ROOT, 'app', 'sitemap.ts'));
  const entries = new Set(['/']);
  for (const match of source.matchAll(/`\$\{BASE_URL\}([^`]+)`/g)) {
    const route = match[1].replace(/\$\{[^}]+\}/g, '[dynamic]');
    entries.add(route || '/');
  }
  return [...entries].sort();
}

function nearestRouteForFile(relFile, routes) {
  if (!relFile.startsWith('app/')) return 'shared';
  const abs = path.join(ROOT, relFile);
  const parts = relFile.split('/');
  for (let i = parts.length; i > 0; i--) {
    const candidatePage = path.join(ROOT, parts.slice(0, i).join('/'), 'page.tsx');
    const candidateRoute = path.join(ROOT, parts.slice(0, i).join('/'), 'route.ts');
    if (fs.existsSync(candidatePage)) return routeFromAppFile(candidatePage);
    if (fs.existsSync(candidateRoute)) return routeFromAppFile(candidateRoute);
  }
  return routeFromAppFile(abs);
}

function classifyChannel(file, kind, context) {
  if (kind === 'redirect') return 'redirect';
  if (/CorporateNavbar|Navbar|navigation|floating-nav/i.test(file)) return 'nav';
  if (/Footer/i.test(file)) return 'footer';
  if (/CTA|cta|Button|bilan|offre|reservation|WhatsApp/i.test(context)) return 'CTA';
  return 'contextuel';
}

function collectEdges(routes) {
  const files = ['app', 'components', 'content', 'lib']
    .flatMap((root) => walk(path.join(ROOT, root)))
    .filter((file) => /\.(ts|tsx|md|mdx|json)$/.test(file))
    .filter((file) => !file.includes('/node_modules/') && !file.includes('/.next/') && !file.includes('/nexus-codex-handoff/'));
  const edges = [];
  const patterns = [
    { kind: 'href', rx: /\bhref\s*=\s*["']([^"']+)["']/g },
    { kind: 'href', rx: /\bhref\s*:\s*["']([^"']+)["']/g },
    { kind: 'redirect', rx: /\b(?:redirect|permanentRedirect)\(\s*["']([^"']+)["']/g },
    { kind: 'redirect', rx: /\brouter\.(?:push|replace)\(\s*["']([^"']+)["']/g },
  ];
  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file));
    const source = read(file);
    for (const { kind, rx } of patterns) {
      let match;
      while ((match = rx.exec(source)) !== null) {
        const href = match[1];
        if (!isInternalHref(href)) continue;
        const context = source.slice(Math.max(0, match.index - 120), match.index + 180);
        edges.push({
          from: nearestRouteForFile(rel, routes),
          to: href,
          file: rel,
          channel: classifyChannel(rel, kind, context),
          kind,
        });
      }
    }
  }
  for (const redirect of parseRedirects()) {
    edges.push({
      from: redirect.source,
      to: redirect.target,
      file: 'next.config.mjs',
      channel: 'redirect',
      kind: redirect.permanent ? 'redirect 301' : 'redirect 307',
    });
  }
  return edges.sort((a, b) => `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`));
}

function isInternalHref(href) {
  return href.startsWith('/') || href.startsWith('#');
}

function normalizeTarget(href, origin = '/') {
  if (href.startsWith('#')) return { route: origin, anchor: href.slice(1) || null };
  const [pathAndQuery, anchor] = href.split('#');
  const route = pathAndQuery.split('?')[0].replace(/\/$/, '') || '/';
  return { route, anchor: anchor || null };
}

function collectAnchors(routes) {
  const byRoute = new Map();
  const global = new Set(['main-content']);
  const canonical = JSON.parse(read(path.join(ROOT, 'data', 'pricing.canonical.json')));
  const add = (route, id) => {
    if (!id) return;
    if (!byRoute.has(route)) byRoute.set(route, new Set());
    byRoute.get(route).add(id);
    global.add(id);
  };
  for (const item of routes.filter((r) => r.kind === 'page')) {
    const source = item.source;
    for (const match of source.matchAll(/\bid\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) add(item.route, match[1]);
    for (const match of source.matchAll(/\bid\s*:\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) add(item.route, match[1]);
  }
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['id', 'format_id', 'edition_id'].includes(key) && typeof child === 'string') add('/offres', child);
      visit(child);
    }
  }
  visit(canonical);
  return { byRoute, global };
}

function routeExists(route, routePatterns, redirectSources) {
  if (route === '#') return true;
  if (staticFileExtensions.test(route)) return true;
  if (redirectSources.has(route)) return true;
  return routePatterns.some((rx) => rx.test(route));
}

function collectLinkFindings(routes, edges) {
  const routePatterns = routes.map((r) => routeRegex(r.route));
  const redirectSources = new Set(parseRedirects().map((r) => r.source));
  const anchors = collectAnchors(routes);
  const missing = [];
  for (const edge of edges) {
    const target = normalizeTarget(edge.to, edge.from === 'shared' ? '/' : edge.from);
    if (!routeExists(target.route, routePatterns, redirectSources)) {
      missing.push({ ...edge, reason: 'route absente', normalizedTarget: target.route });
      continue;
    }
    if (target.anchor) {
      const routeAnchors = anchors.byRoute.get(target.route);
      if (!anchors.global.has(target.anchor) && !(routeAnchors && routeAnchors.has(target.anchor))) {
        missing.push({ ...edge, reason: `ancre absente #${target.anchor}`, normalizedTarget: `${target.route}#${target.anchor}` });
      }
    }
  }
  return missing;
}

function collectNavigationDebtDecisions() {
  const dashboardSource = read(path.join(ROOT, 'app', 'dashboard', 'eleve', 'page.tsx'));
  const stagesHeader = read(path.join(ROOT, 'app', 'stages', '_components', 'StagesHeader.tsx'));
  const requiredDashboardAnchors = ['aria', 'programme-maths', 'resources', 'survival', 'trajectory'];
  const legacySections = [
    'components/sections/home-hero.tsx',
    'components/sections/korrigo-showcase.tsx',
    'components/sections/problem-solution-section.tsx',
  ];
  const legacyPresent = legacySections.filter((file) => fs.existsSync(path.join(ROOT, file)));

  return [
    {
      case: 'NPC auth redirects',
      decision: collectAuthLoginSources().length === 0 ? 'corrige' : 'a corriger',
      proof: collectAuthLoginSources().length === 0 ? 'aucun lien/redirect applicatif vers /auth/login' : collectAuthLoginSources().join(', '),
    },
    {
      case: 'Dashboard eleve hash anchors',
      decision: requiredDashboardAnchors.every((id) => dashboardSource.includes(`id="${id}"`)) ? 'ids cibles ajoutes' : 'ids incomplets',
      proof: requiredDashboardAnchors.join(', '),
    },
    {
      case: 'StagesHeader reservation',
      decision: stagesHeader.includes('/offres#section-intensifs') ? 'repointage vers route catalogue reelle' : 'a corriger',
      proof: '/offres#section-intensifs',
    },
    {
      case: 'Legacy home-hero/problem-solution/korrigo-showcase',
      decision: legacyPresent.length === 0 ? 'code mort supprime' : 'encore present',
      proof: legacyPresent.length === 0 ? 'fichiers absents et aucun import actif detecte avant suppression' : legacyPresent.join(', '),
    },
  ];
}

function collectAuthLoginSources() {
  const roots = ['app', 'components', 'lib'];
  return roots
    .flatMap((root) => walk(path.join(ROOT, root)))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => toPosix(path.relative(ROOT, file)))
    .filter((rel) => read(path.join(ROOT, rel)).includes('/auth/login'))
    .sort();
}

function publicPages(routes) {
  return routes.filter((r) => r.kind === 'page' && r.access === 'public');
}

function collectOrphans(routes, edges, sitemapEntries) {
  const inbound = new Map();
  for (const edge of edges) {
    const target = normalizeTarget(edge.to, edge.from === 'shared' ? '/' : edge.from);
    if (target.route === edge.from) continue;
    inbound.set(target.route, (inbound.get(target.route) || 0) + 1);
  }
  return publicPages(routes)
    .filter((r) => r.route !== '/' && !r.dynamic)
    .map((r) => ({
      route: r.route,
      inbound: inbound.get(r.route) || 0,
      sitemap: sitemapEntries.includes(r.route),
      classification:
        inbound.get(r.route) || publicOrphanPolicy[r.route]
          ? publicOrphanPolicy[r.route] || { status: 'reliee', reason: 'Lien entrant detecte.' }
          : { status: 'non classee', reason: 'Aucun lien entrant et aucune politique documentee.' },
    }))
    .filter((entry) => entry.inbound === 0 || publicOrphanPolicy[entry.route])
    .sort((a, b) => a.route.localeCompare(b.route));
}

function ssotRows() {
  const ssotRoots = ['app', 'components', 'content', 'lib', 'data', '__tests__', 'e2e', 'scripts'];
  const files = ssotRoots.flatMap((root) => walk(path.join(ROOT, root)))
    .filter((file) => /\.(ts|tsx|json|md|mdx)$/.test(file))
    .filter((file) => !file.includes('/node_modules/') && !file.includes('/.next/'));
  const scans = [
    ['prix/offres/echeanciers', 'data/pricing.canonical.json + lib/pricing.ts', /@\/lib\/pricing|getFullPricingData|getAllOffers|getAnnualOffer|getStageFormat|pricing\.canonical/g],
    ['regles groupes', 'data/pricing.canonical.json -> lib/group-rules.ts', /GROUP_RULES|@\/lib\/group-rules|getRules/g],
    ['legal/adresses/contact', 'lib/legal.ts', /LEGAL\.|@\/lib\/legal/g],
    ['banque RIB/IBAN/BIC', 'LEGAL.billing dans lib/legal.ts', /LEGAL\.billing|compactBankIdentifier|billing\.(rib|iban|bic)|\bRIB\b|\bIBAN\b/g],
    ['CGV/paiement', 'lib/cgv-policy.ts', /CGV_POLICY|CGV_VERSION|@\/lib\/cgv-policy/g],
    ['equipe', 'content/team.json', /content\/team|team\.json|TEAM_MEMBERS|MENTORS/g],
    ['avis/social proof', 'content/social-proof.json', /social-proof|testimonial|testimonials|reviews/g],
    ['metadataBase/url canonique', 'app/layout.tsx metadataBase', /metadataBase|alternates|canonical:|openGraph:\s*\{/],
  ];
  return scans.map(([data, source, rx]) => {
    const consumers = files
      .map((file) => toPosix(path.relative(ROOT, file)))
      .filter((rel) => !rel.startsWith('docs/'))
      .filter((rel) => {
        rx.lastIndex = 0;
        return rx.test(read(path.join(ROOT, rel)));
      })
      .sort();
    return { data, source, consumers };
  });
}

function collectBusinessFindings(routes, edges) {
  const pricing = JSON.parse(read(path.join(ROOT, 'data', 'pricing.canonical.json')));
  const offerIds = [
    ...pricing.offers.map((offer) => offer.id),
    ...pricing.stage_formats.map((format) => format.format_id),
    ...pricing.ponctuel_offers.map((offer) => offer.id),
    ...pricing.coaching.map((offer) => offer.id),
    ...pricing.packs.map((pack) => pack.id),
    pricing.carte_nexus.id,
  ].sort();
  const offresSource = read(path.join(ROOT, 'app', 'offres', 'page.tsx'));
  const anchorsByConstruction = /id=\{(?:offer|f|p|pack|coaching)\.id\}|id=\{f\.format_id\}/.test(offresSource);
  const missingOfferAnchors = anchorsByConstruction ? [] : offerIds.filter((id) => !offresSource.includes(`id="${id}"`));
  const routeSet = new Set(routes.map((r) => r.route));
  const conversionRoutes = ['/', '/offres', '/bilan-gratuit', '/api/payments/clictopay/init'];
  return {
    offerIds,
    missingOfferAnchors,
    conversionRoutes: conversionRoutes.map((route) => ({ route, present: routeSet.has(route) })),
    dashboards: roleNames.map((role) => ({
      role,
      pages: routes.filter((r) => r.route.startsWith(`/dashboard/${role}`) || (role === 'directeur' && r.route === '/admin/directeur')).length,
    })),
  };
}

function collectPublicClientPages(routes) {
  return publicPages(routes)
    .filter((r) => r.boundary === 'client')
    .map((r) => {
      const interactive = /useState|useEffect|onClick|framer-motion|useRouter|useSearchParams|window\.|navigator\./.test(r.source);
      let decision = interactive ? 'justifiee par interactivite actuelle' : 'candidate server component';
      if (r.route === '/offres') decision = 'priorite audit: page SEO majeure en client, candidate a repasser server par extraction des interactions';
      return { route: r.route, file: r.file, decision };
    });
}

function collectSitemapFindings(routes, edges, sitemapEntries) {
  const routeSet = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.route));
  const privateInSitemap = sitemapEntries.filter((route) => isNoindexRequiredRoute(route) || route.startsWith('/api'));
  const sitemapMissingRoutes = sitemapEntries.filter((route) => !route.includes('[dynamic]') && !routeSet.has(route));
  const publicNoSitemap = publicPages(routes)
    .filter((r) => !r.dynamic && !sitemapEntries.includes(r.route))
    .map((r) => r.route);
  const privatePagesNoNoindex = routes
    .filter((r) => r.kind === 'page' && isNoindexRequiredRoute(r.route))
    .filter((r) => !routeHasNoindex(r))
    .map((r) => r.route);
  return { privateInSitemap, sitemapMissingRoutes, publicNoSitemap, privatePagesNoNoindex };
}

function isNoindexRequiredRoute(route) {
  return (
    route.startsWith('/dashboard') ||
    route.startsWith('/auth') ||
    route.startsWith('/admin/directeur') ||
    route.startsWith('/assessments') ||
    route.startsWith('/session')
  );
}

function hasNoindexMetadata(source) {
  return /robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false[\s\S]*\}|noindex/i.test(source);
}

function routeHasNoindex(routeItem) {
  if (hasNoindexMetadata(routeItem.source)) return true;
  const parts = routeItem.file.split('/');
  for (let i = parts.length - 1; i > 1; i--) {
    const candidate = path.join(ROOT, parts.slice(0, i).join('/'), 'layout.tsx');
    if (fs.existsSync(candidate) && hasNoindexMetadata(read(candidate))) return true;
  }
  return false;
}

function collectSourceHygiene() {
  const roadmap = fs.existsSync(path.join(ROOT, 'ROADMAP.md'))
    ? 'ROADMAP.md present au root (non suivi si git status le confirme); a classer avant prochain lot.'
    : 'ROADMAP.md absent au root.';
  const editionOccurrences = [];
  const editionRx = /edition_id|editionId|stageEdition|stage_edition/g;
  for (const file of walk(ROOT)) {
    const rel = toPosix(path.relative(ROOT, file));
    if (!/\.(ts|tsx|prisma|json)$/.test(file)) continue;
    if (rel.startsWith('node_modules/') || rel.startsWith('.next/') || rel.startsWith('nexus-codex-handoff/')) continue;
    if (rel === 'data/pricing.canonical.json' || rel.startsWith('__tests__/')) continue;
    const source = read(file);
    if (editionRx.test(source)) editionOccurrences.push(rel);
  }
  return { roadmap, editionOccurrences: [...new Set(editionOccurrences)].sort() };
}

function anomalyList({ linkFindings, orphans, sitemapFindings, clientPages, business, hygiene }) {
  const p1 = [];
  const p2 = [];
  const p3 = [];
  if (linkFindings.length) p1.push(`${linkFindings.length} lien(s)/ancre(s) internes a verifier (voir section liens morts).`);
  if (sitemapFindings.privateInSitemap.length) p1.push(`Routes privees presentes au sitemap: ${sitemapFindings.privateInSitemap.join(', ')}.`);
  const unclassified = orphans.filter((o) => o.classification.status === 'non classee');
  if (unclassified.length) p1.push(`Orphelines publiques non classees: ${unclassified.map((o) => o.route).join(', ')}.`);
  const corrige = orphans.find((o) => o.route === '/corrige_dnb_maths_2026');
  if (corrige) p2.push('/corrige_dnb_maths_2026 est snake_case, au sitemap et a relier/renommer/retirer sur decision Shark.');
  if (business.missingOfferAnchors.length) p2.push(`Offres canonical sans ancre /offres detectee: ${business.missingOfferAnchors.join(', ')}.`);
  if (clientPages.some((p) => p.route === '/offres')) p2.push('/offres est une page publique SEO en "use client"; extraction server recommandee avant optimisation SEO/perf.');
  if (sitemapFindings.privatePagesNoNoindex.length) p2.push(`${sitemapFindings.privatePagesNoNoindex.length} page(s) privees sans metadata noindex locale; robots.txt les bloque mais le noindex explicite reste a harmoniser.`);
  if (hygiene.editionOccurrences.length) p3.push(`edition_id hors canonical limite a: ${hygiene.editionOccurrences.join(', ')}.`);
  if (hygiene.roadmap.includes('present')) p3.push(hygiene.roadmap);
  p3.push('Decisions Shark ouvertes: charte cible, Carte Nexus, tutoiement eleve, sort des orphelines.');
  return { p1, p2, p3 };
}

function mdTable(headers, rows) {
  const line = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  return [line, sep, ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\n/g, '<br>').replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');
}

function renderSiteMap(data) {
  const sections = [
    ['Marketing public', (r) => r.kind === 'page' && r.access === 'public'],
    ['Auth et parcours publics techniques', (r) => r.kind === 'page' && r.access !== 'public' && !r.route.startsWith('/dashboard')],
    ['Dashboards', (r) => r.kind === 'page' && r.route.startsWith('/dashboard')],
    ['API', (r) => r.kind === 'api'],
  ];
  const lines = [
    '# Site Map',
    '',
    `Routes detectees: ${data.routes.length} (${data.routes.filter((r) => r.kind === 'page').length} pages, ${data.routes.filter((r) => r.kind === 'api').length} route handlers).`,
    '',
  ];
  for (const [title, filter] of sections) {
    const rows = data.routes.filter(filter).map((r) => [
      r.route,
      r.kind,
      r.rendering,
      r.boundary,
      r.access,
      r.purpose,
      r.sources,
      r.file,
    ]);
    lines.push(`## ${title}`, '', mdTable(['Chemin', 'Type', 'Rendu', 'Server/client', 'Acces/role', 'Finalite', 'Sources donnees', 'Fichier'], rows), '');
  }
  lines.push('## Liens morts / ancres a verifier', '');
  if (data.linkFindings.length === 0) {
    lines.push('Aucun lien interne litteral mort detecte.');
  } else {
    lines.push(mdTable(['Origine', 'Cible', 'Canal', 'Fichier', 'Diagnostic'], data.linkFindings.map((f) => {
      const key = `${f.from} -> ${f.to} (${f.file})`;
      const suffix = linkAllowlist.includes(key) ? ' allowlist temporaire' : '';
      return [f.from, f.to, f.channel, f.file, `${f.reason} (${f.normalizedTarget})${suffix}`];
    })));
  }
  lines.push('', '## Decisions P1 navigation appliquees', '');
  lines.push(mdTable(['Cas', 'Decision', 'Preuve'], data.navigationDebtDecisions.map((item) => [item.case, item.decision, item.proof])));
  lines.push('', '## Orphelines publiques', '');
  lines.push(mdTable(['Route', 'Entrants', 'Sitemap', 'Classement', 'Justification'], data.orphans.map((o) => [o.route, o.inbound, o.sitemap ? 'oui' : 'non', o.classification.status, o.classification.reason])));
  lines.push('', '## Routes publiques surveillees', '');
  lines.push(mdTable(['Route', 'Entrants', 'Sitemap', 'Statut'], data.watchedPublicRoutes.map((o) => [o.route, o.inbound, o.sitemap ? 'oui' : 'non', o.classification.status])));
  lines.push('', '## Alias et redirects', '');
  lines.push(mdTable(['Source', 'Destination', 'Type', 'Fichier'], data.redirects.map((r) => [r.source, r.target, r.permanent ? '301 permanent' : '307 temporaire', r.file || 'next.config.mjs'])));
  lines.push('', '## Sitemap / routes / noindex', '');
  lines.push(`- Routes sitemap statiques detectees: ${data.sitemapEntries.join(', ')}`);
  lines.push(`- Routes privees au sitemap: ${data.sitemapFindings.privateInSitemap.join(', ') || 'aucune'}`);
  lines.push(`- Entrees sitemap sans route statique locale: ${data.sitemapFindings.sitemapMissingRoutes.join(', ') || 'aucune'}`);
  lines.push(`- Pages publiques hors sitemap: ${data.sitemapFindings.publicNoSitemap.join(', ') || 'aucune'}`);
  lines.push(`- Pages privees sans metadata noindex locale: ${data.sitemapFindings.privatePagesNoNoindex.join(', ') || 'aucune'}`);
  lines.push('', '## Frontieres server/client publiques', '');
  lines.push(mdTable(['Route', 'Fichier', 'Statut'], data.clientPages.map((p) => [p.route, p.file, p.decision])));
  lines.push('', '## Cohérence métier', '');
  lines.push(`- Offres/produits canonical couverts par /offres: ${data.business.missingOfferAnchors.length === 0 ? 'oui, ancres construites depuis les ids canonical' : `non (${data.business.missingOfferAnchors.join(', ')})`}.`);
  lines.push(`- Parcours accueil -> offres -> bilan -> paiement: ${data.business.conversionRoutes.map((r) => `${r.route}:${r.present ? 'present' : 'absent'}`).join(', ')}.`);
  lines.push(`- Dashboards par role: ${data.business.dashboards.map((d) => `${d.role}:${d.pages}`).join(', ')}.`);
  lines.push('- Vocabulaire gammes legacy: couvert par brand-trust-guard; Odyssée/Cortex/Académies/Studio Flex restent interdits hors allowlist.');
  lines.push('', '## Hygiene source', '');
  lines.push(`- ${data.hygiene.roadmap}`);
  lines.push(`- edition_id hors canonical/tests: ${data.hygiene.editionOccurrences.join(', ') || 'aucune occurrence detectee'}.`);
  lines.push('', '## Anomalies prioritaires', '');
  for (const [label, items] of [['P1 nav', data.anomalies.p1], ['P2 incoherence', data.anomalies.p2], ['P3 hygiene', data.anomalies.p3]]) {
    lines.push(`### ${label}`, '');
    if (items.length === 0) lines.push('- Aucune anomalie detectee.');
    else items.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function graphGroup(route) {
  const normalized = route.replace(/#.*/, '');
  if (normalized.startsWith('/api')) return 'api';
  if (normalized.startsWith('/dashboard/parent')) return 'dashboard_parent';
  if (normalized.startsWith('/dashboard/coach')) return 'dashboard_coach';
  if (normalized.startsWith('/dashboard/assistante')) return 'dashboard_assistante';
  if (normalized.startsWith('/dashboard/admin') || normalized.startsWith('/admin/directeur')) return 'dashboard_admin';
  if (normalized.startsWith('/dashboard/eleve')) return 'dashboard_eleve';
  if (normalized.startsWith('/dashboard')) return 'dashboard_shared';
  return 'marketing';
}

function renderGraph(edges) {
  const dedupedEdges = [];
  const seenEdges = new Set();
  for (const edge of edges) {
    const normalized = normalizeTarget(edge.to, edge.from === 'shared' ? '/' : edge.from);
    const toLabel = normalized.anchor ? `${normalized.route}#${normalized.anchor}` : normalized.route;
    const key = `${edge.from}|${toLabel}|${edge.channel}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    dedupedEdges.push({ ...edge, toLabel });
  }

  const lines = ['flowchart TD'];
  const nodeId = new Map();
  const idFor = (route) => {
    if (!nodeId.has(route)) nodeId.set(route, `N${nodeId.size + 1}`);
    return nodeId.get(route);
  };
  for (const edge of dedupedEdges) {
    idFor(edge.from);
    idFor(edge.toLabel);
  }

  const groupLabels = [
    ['marketing', 'Marketing public'],
    ['dashboard_parent', 'Dashboard parent'],
    ['dashboard_coach', 'Dashboard coach'],
    ['dashboard_assistante', 'Dashboard assistante'],
    ['dashboard_admin', 'Dashboard admin'],
    ['dashboard_eleve', 'Dashboard eleve'],
    ['dashboard_shared', 'Dashboard partage'],
    ['api', 'API'],
  ];
  for (const [group, label] of groupLabels) {
    const nodes = [...nodeId.entries()].filter(([route]) => graphGroup(route) === group);
    if (nodes.length === 0 && !['marketing', 'dashboard_parent', 'dashboard_coach', 'api'].includes(group)) continue;
    lines.push(`  subgraph ${group}["${label}"]`);
    for (const [route, id] of nodes.sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`    ${id}["${route}"]`);
    }
    lines.push('  end');
  }

  for (const edge of dedupedEdges) {
    lines.push(`  ${idFor(edge.from)} -->|${edge.channel}| ${idFor(edge.toLabel)}`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function renderSsot(rows) {
  const lines = [
    '# SSOT Map',
    '',
    mdTable(
      ['Donnee', 'Source unique', 'Consommateurs detectes'],
      rows.map((row) => [row.data, row.source, row.consumers.length ? row.consumers.slice(0, 40).join('<br>') : 'aucun consommateur detecte'])
    ),
    '',
    '## Notes',
    '',
    '- Les consommateurs sont detectes par imports/symboles depuis l’arbre courant; cette carte est un diagnostic, pas une preuve semantique exhaustive.',
    '- Les coordonnees bancaires peuvent exister dans les surfaces privees de paiement/facturation et les emails transactionnels, jamais dans les surfaces publiques marketing.',
    '- `content/social-proof.json` doit rester vide tant que des avis reels valides ne sont pas fournis.',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function collectAll() {
  const routes = collectRoutes();
  const edges = collectEdges(routes);
  const sitemapEntries = parseSitemapEntries();
  const redirects = parseRedirects();
  const linkFindings = collectLinkFindings(routes, edges);
  const orphans = collectOrphans(routes, edges, sitemapEntries);
  const watchedPublicRoutes = [
    ...new Set([
      '/notre-centre',
      '/ressources',
      '/accompagnement-scolaire',
      '/plateforme-aria',
      '/grand-oral',
      '/reussir-eaf',
      '/candidat-libre-bac-francais',
      '/preparation-bac-francais-tunis',
      '/corrige_dnb_maths_2026',
    ]),
  ].map((route) => {
    const orphan = orphans.find((entry) => entry.route === route);
    const inbound = edges.filter((edge) => normalizeTarget(edge.to, edge.from === 'shared' ? '/' : edge.from).route === route).length;
    return orphan || {
      route,
      inbound,
      sitemap: sitemapEntries.includes(route),
      classification: { status: inbound > 0 ? 'reliee' : 'non classee', reason: inbound > 0 ? 'Lien entrant detecte.' : 'Aucun lien entrant.' },
    };
  });
  const appRedirects = collectAppRedirects(edges);
  const sitemapFindings = collectSitemapFindings(routes, edges, sitemapEntries);
  const clientPages = collectPublicClientPages(routes);
  const business = collectBusinessFindings(routes, edges);
  const hygiene = collectSourceHygiene();
  const anomalies = anomalyList({ linkFindings, orphans, sitemapFindings, clientPages, business, hygiene });
  return {
    routes: routes.map(({ source, ...rest }) => rest),
    edges,
    sitemapEntries,
    redirects: [...redirects, ...appRedirects].sort((a, b) => `${a.source} ${a.target}`.localeCompare(`${b.source} ${b.target}`)),
    linkFindings,
    navigationDebtDecisions: collectNavigationDebtDecisions(),
    orphans,
    watchedPublicRoutes,
    sitemapFindings,
    clientPages,
    business,
    hygiene,
    anomalies,
    ssotRows: ssotRows(),
  };
}

function main() {
  const data = collectAll();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(SITE_MAP, renderSiteMap(data));
  fs.writeFileSync(SITE_GRAPH, renderGraph(data.edges));
  fs.writeFileSync(SSOT_MAP, renderSsot(data.ssotRows));
  console.log(`Generated ${path.relative(ROOT, SITE_MAP)}`);
  console.log(`Generated ${path.relative(ROOT, SITE_GRAPH)}`);
  console.log(`Generated ${path.relative(ROOT, SSOT_MAP)}`);
  console.log(`Routes: ${data.routes.length}; edges: ${data.edges.length}; link findings: ${data.linkFindings.length}; public orphan entries: ${data.orphans.length}`);
}

main();
