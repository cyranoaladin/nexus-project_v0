import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';

const { linkAllowlist } = require('../../scripts/audit/link-allowlist.cjs') as { linkAllowlist: string[] };

const root = process.cwd();

const scanRoots = ['app', 'components'];
const scannedExtensions = new Set(['.ts', '.tsx']);
const excludedDirectories = new Set(['.next', 'node_modules']);

function listScannedFiles(target: string): string[] {
  const absolute = join(root, target);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return scannedExtensions.has(extname(target)) ? [target] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(absolute)) {
    if (excludedDirectories.has(entry)) continue;
    const child = `${target}/${entry}`;
    const childStat = statSync(join(root, child));
    if (childStat.isDirectory()) {
      files.push(...listScannedFiles(child));
    } else if (scannedExtensions.has(extname(child))) {
      files.push(child);
    }
  }
  return files;
}

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

function extractLinkFindingKeys(siteMap: string): string[] {
  const section = siteMap.split('## Liens morts / ancres a verifier')[1]?.split('## Decisions P1 navigation appliquees')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---') && !line.includes('Origine'))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return `${cells[1]} -> ${cells[2]} (${cells[4]})`;
    })
    .sort();
}

function anchorFromHref(href: string): string | null {
  if (!href.startsWith('#') && !href.startsWith('/')) return null;
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return null;
  const rawAnchor = href.slice(hashIndex + 1).split(/[?&/]/)[0];
  return rawAnchor || null;
}

function isCssHexColor(href: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(href);
}

function collectCanonicalPricingIds(): Set<string> {
  const pricing = JSON.parse(sourceFor('data/pricing.canonical.json'));
  const ids = new Set<string>();

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    for (const key of ['id', 'format_id', 'edition_id']) {
      if (typeof record[key] === 'string') {
        ids.add(record[key]);
      }
    }
    Object.values(record).forEach(visit);
  }

  visit(pricing);
  return ids;
}

function collectLiteralIds(files: string[]): Set<string> {
  const ids = new Set<string>();
  const idPattern = /\bid\s*=\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
  const configIdPattern = /\bid\s*:\s*["'`]([A-Za-z0-9_-]+)["'`]/g;

  for (const file of files) {
    const source = sourceFor(file);
    for (const match of source.matchAll(idPattern)) {
      ids.add(match[1]);
    }
    for (const match of source.matchAll(configIdPattern)) {
      ids.add(match[1]);
    }
  }

  return ids;
}

describe('internal anchor link integrity', () => {
  test('literal internal href anchors resolve to a literal id in active app or component code', () => {
    const files = scanRoots
      .flatMap(listScannedFiles)
      .filter((file, index, allFiles) => allFiles.indexOf(file) === index);
    const ids = collectLiteralIds(files);
    collectCanonicalPricingIds().forEach((id) => ids.add(id));
    const internalAnchorStringPattern = /["'`]((?:\/[\p{L}0-9_./?=&%-]+)?#[\p{L}][\p{L}0-9_-]+)["'`]/gu;
    const missing: string[] = [];

    for (const file of files) {
      const source = sourceFor(file);
      for (const match of source.matchAll(internalAnchorStringPattern)) {
        const href = match[1];
        if (isCssHexColor(href)) continue;
        const anchor = anchorFromHref(href);
        if (anchor && !ids.has(anchor)) {
          missing.push(`${file}: ${href} -> #${anchor}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('global route graph audit classifies every detected dead link or missing anchor', () => {
    const auditOutDir = mkdtempSync(join(tmpdir(), 'nexus-links-'));
    execFileSync('node', ['scripts/audit/site-map.mjs', '--out-dir', auditOutDir], { cwd: root, stdio: 'pipe' });
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');
    const findings = extractLinkFindingKeys(siteMap);
    const allowed = new Set(linkAllowlist);

    expect(findings.filter((finding) => !allowed.has(finding))).toEqual([]);
    expect(linkAllowlist.filter((allowedFinding) => !findings.includes(allowedFinding))).toEqual([]);
    const orphanSection = siteMap.split('## Orphelines publiques')[1]?.split('## Routes publiques surveillees')[0] ?? '';
    expect(orphanSection).not.toContain('non classee');
    expect(orphanSection).not.toContain('a relier');
  });

  describe('Next.js rewrite and route integrity semantics', () => {
    test('Cas 1 — valid internal rewrite pointing to existing public artifact is recognized as valid route', async () => {
      const siteMapModule = await import('../../scripts/audit/site-map.mjs');
      const rewrites = siteMapModule.parseRewrites(undefined, join(root, 'public'), []);
      expect(rewrites.some((r: any) => r.source === '/planning' && r.verified)).toBe(true);
      const rewriteSources = new Set(rewrites.map((r: any) => r.source));
      const routePatterns: RegExp[] = [];
      const redirectSources = new Set<string>();
      expect(siteMapModule.routeExists('/planning', routePatterns, redirectSources, rewriteSources)).toBe(true);
    });

    test('Cas 2 — rewrite pointing to missing internal destination fails closed as dead link', async () => {
      const siteMapModule = await import('../../scripts/audit/site-map.mjs');
      const fakeNextConfig = `
        export default {
          async rewrites() {
            return [{ source: '/fake', destination: '/nonexistent/index.html' }];
          }
        };
      `;
      const rewrites = siteMapModule.parseRewrites(fakeNextConfig, join(root, 'public'), []);
      expect(rewrites.some((r: any) => r.source === '/fake')).toBe(false);
      const rewriteSources = new Set(rewrites.map((r: any) => r.source));
      const routePatterns: RegExp[] = [];
      const redirectSources = new Set<string>();
      expect(siteMapModule.routeExists('/fake', routePatterns, redirectSources, rewriteSources)).toBe(false);
    });

    test('Cas 3 — external rewrite to absolute URL is not recognized as valid internal route', async () => {
      const siteMapModule = await import('../../scripts/audit/site-map.mjs');
      const externalNextConfig = `
        export default {
          async rewrites() {
            return [{ source: '/external-proxy', destination: 'https://external-service.com/api' }];
          }
        };
      `;
      const rewrites = siteMapModule.parseRewrites(externalNextConfig, join(root, 'public'), []);
      expect(rewrites.some((r: any) => r.source === '/external-proxy')).toBe(false);
      const rewriteSources = new Set(rewrites.map((r: any) => r.source));
      const routePatterns: RegExp[] = [];
      const redirectSources = new Set<string>();
      expect(siteMapModule.routeExists('/external-proxy', routePatterns, redirectSources, rewriteSources)).toBe(false);
    });

    test('Cas 4 — standard App Router routes remain intact', async () => {
      const siteMapModule = await import('../../scripts/audit/site-map.mjs');
      const routePatterns = [siteMapModule.routeRegex('/'), siteMapModule.routeRegex('/offres'), siteMapModule.routeRegex('/dashboard/admin')];
      const redirectSources = new Set<string>();
      const rewriteSources = new Set<string>();
      expect(siteMapModule.routeExists('/', routePatterns, redirectSources, rewriteSources)).toBe(true);
      expect(siteMapModule.routeExists('/offres', routePatterns, redirectSources, rewriteSources)).toBe(true);
      expect(siteMapModule.routeExists('/dashboard/admin', routePatterns, redirectSources, rewriteSources)).toBe(true);
      expect(siteMapModule.routeExists('/non-existent-route', routePatterns, redirectSources, rewriteSources)).toBe(false);
    });

    test('Cas 5 — redirects from next.config.mjs remain intact without regression', async () => {
      const siteMapModule = await import('../../scripts/audit/site-map.mjs');
      const redirects = siteMapModule.parseRedirects();
      expect(redirects.some((r: any) => r.source === '/tarifs' && r.target === '/offres')).toBe(true);
      const redirectSources = new Set(redirects.map((r: any) => r.source));
      const routePatterns: RegExp[] = [];
      const rewriteSources = new Set<string>();
      expect(siteMapModule.routeExists('/tarifs', routePatterns, redirectSources, rewriteSources)).toBe(true);
    });
  });
});
