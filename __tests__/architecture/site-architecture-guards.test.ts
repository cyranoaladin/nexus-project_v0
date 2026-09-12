import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';

import { LEGAL, compactBankIdentifier } from '@/lib/legal';

const { linkAllowlist } = require('../../scripts/audit/link-allowlist.cjs') as { linkAllowlist: string[] };

const root = process.cwd();
let auditOutDir = '';
const pricingPath = join(root, 'data/pricing.canonical.json');
const scannedExtensions = new Set(['.ts', '.tsx', '.json', '.prisma']);

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

function listFiles(target: string): string[] {
  const absolute = join(root, target);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return scannedExtensions.has(extname(target)) ? [target] : [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const child = `${target}/${entry.name}`;
    const childStat = statSync(join(root, child));
    if (childStat.isDirectory()) files.push(...listFiles(child));
    else if (scannedExtensions.has(extname(child))) files.push(child);
  }
  return files;
}

function routeFromPage(file: string): string {
  const rel = file.replace(/^app\//, '').replace(/(^|\/)page\.tsx$/, '');
  const parts = rel.split('/').filter(Boolean).filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  return parts.length ? `/${parts.join('/')}` : '/';
}

function isPublicPage(file: string): boolean {
  const route = routeFromPage(file);
  return !(
    route.startsWith('/dashboard') ||
    route.startsWith('/admin') ||
    route.startsWith('/api') ||
    route.startsWith('/auth') ||
    route.startsWith('/session') ||
    route.startsWith('/assessments')
  );
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

beforeAll(() => {
  auditOutDir = mkdtempSync(join(tmpdir(), 'nexus-architecture-'));
  execFileSync('node', ['scripts/audit/site-map.mjs', '--out-dir', auditOutDir], { cwd: root, stdio: 'pipe' });
});

describe('architecture diagnostic guardrails', () => {
  test('site-map audit keeps every current public orphan classified', () => {
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');
    const orphanSection = siteMap.split('## Orphelines publiques')[1]?.split('## Routes publiques surveillees')[0] ?? '';
    expect(orphanSection).not.toContain('non classee');
    expect(orphanSection).not.toContain('a relier');
  });

  test('link-integrity findings fail outside the shrinking shared allowlist', () => {
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');
    const findings = extractLinkFindingKeys(siteMap);
    const allowed = new Set(linkAllowlist);
    const unexpected = findings.filter((finding) => !allowed.has(finding));
    const staleAllowlist = linkAllowlist.filter((allowedFinding) => !findings.includes(allowedFinding));

    expect(linkAllowlist.some((entry) => entry.includes('/auth/login'))).toBe(false);
    expect(unexpected).toEqual([]);
    expect(staleAllowlist).toEqual([]);
  });

  test('no source link or redirect points to the removed /auth/login alias', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap(listFiles)
      .filter((file) => sourceFor(file).includes('/auth/login'));

    expect(offenders).toEqual([]);
  });

  test('public routes and public marketing components do not render bank identifiers', () => {
    const publicPageFiles = listFiles('app').filter((file) => file.endsWith('/page.tsx')).filter(isPublicPage);
    const publicComponentFiles = [
      'components/layout',
      'components/marketing',
      'components/premium',
      'components/sections',
      'components/stages',
      'components/ui',
    ].flatMap(listFiles);
    const scannedFiles = [...new Set([...publicPageFiles, ...publicComponentFiles])].sort();
    const forbiddenValues = [
      LEGAL.billing.rib,
      LEGAL.billing.iban,
      compactBankIdentifier(LEGAL.billing.rib),
      compactBankIdentifier(LEGAL.billing.iban),
    ];
    const offenders = scannedFiles.filter((file) => {
      const source = sourceFor(file);
      return source.includes('LEGAL.billing') || forbiddenValues.some((value) => source.includes(value));
    });

    expect(offenders).toEqual([]);
  });

  test('all canonical id-like fields are recursive ASCII kebab-case slugs', () => {
    const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'));
    const offenders: string[] = [];

    function visit(value: unknown, pathLabel: string): void {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${pathLabel}[${index}]`));
        return;
      }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const nextPath = `${pathLabel}.${key}`;
        if (['id', 'format_id', 'edition_id'].includes(key) && typeof child === 'string' && !/^[a-z0-9-]+$/.test(child)) {
          offenders.push(`${nextPath}=${child}`);
        }
        visit(child, nextPath);
      }
    }

    visit(pricing, 'pricing');
    expect(offenders).toEqual([]);
  });

  test('stage edition identifiers are not persisted in DB, API payloads or analytics code', () => {
    const riskyRoots = ['prisma', 'app/api', 'lib/analytics.ts', 'lib/analytics'];
    const offenders = riskyRoots
      .flatMap(listFiles)
      .filter((file) => /edition_id|editionId|stageEdition|stage_edition/.test(sourceFor(file)));

    expect(offenders).toEqual([]);
  });

  test('root ROADMAP is classified under docs instead of left as a root artifact', () => {
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');
    expect(existsSync(join(root, 'ROADMAP.md'))).toBe(false);
    expect(existsSync(join(root, 'docs/roadmaps/RAG_PLATFORM_ROADMAP.md'))).toBe(true);
    expect(siteMap).not.toContain('ROADMAP.md present au root');
  });

  test('private route groups define noindex metadata at their layout boundary', () => {
    const layoutFiles = [
      'app/dashboard/layout.tsx',
      'app/auth/layout.tsx',
      'app/admin/directeur/layout.tsx',
      'app/assessments/layout.tsx',
      'app/session/layout.tsx',
    ];
    const offenders = layoutFiles.filter((file) => {
      if (!existsSync(join(root, file))) return true;
      const source = sourceFor(file);
      return !/robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false[\s\S]*\}/m.test(source);
    });

    expect(offenders).toEqual([]);
  });

  test('generated site map accounts for inherited private noindex layouts', () => {
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');

    expect(siteMap).toContain('Pages privees sans metadata noindex locale: aucune');
    expect(siteMap).not.toMatch(/\|\s+\/dashboard\/trajectoire\s+\| page \|[^\n]+\| public \|/);
  });

  test('generated architecture artifacts are deterministic and partition the route graph', () => {
    const siteMap = readFileSync(join(auditOutDir, 'SITE_MAP.md'), 'utf8');
    const ssotMap = readFileSync(join(auditOutDir, 'SSOT_MAP.md'), 'utf8');
    const graph = readFileSync(join(auditOutDir, 'SITE_GRAPH.mmd'), 'utf8');
    const edgeLines = graph.split('\n').filter((line) => line.includes('-->'));

    expect(siteMap).not.toMatch(/Genere:\s*\d{4}-\d{2}-\d{2}T/);
    expect(ssotMap).not.toMatch(/Genere:\s*\d{4}-\d{2}-\d{2}T/);
    expect(graph).toContain('subgraph marketing');
    expect(graph).toContain('subgraph dashboard_parent');
    expect(graph).toContain('subgraph dashboard_coach');
    expect(graph).toContain('subgraph api');
    expect(edgeLines).toHaveLength(new Set(edgeLines).size);
  });

  test('metadataBase SSOT row stays focused on canonical metadata consumers', () => {
    const ssotMap = readFileSync(join(auditOutDir, 'SSOT_MAP.md'), 'utf8');
    const row = ssotMap.split('\n').find((line) => line.startsWith('| metadataBase/url canonique |')) ?? '';

    expect(row).toContain('app/layout.tsx');
    expect(row).not.toContain('NEXTAUTH_URL');
  });

  test('programme testimonial type is not rendered as fabricated marketing proof', () => {
    const typeFile = 'components/programme/shared/types/programme.ts';
    expect(sourceFor(typeFile)).not.toContain('testimonial');
    const offenders = ['app', 'components', 'content']
      .flatMap(listFiles)
      .filter((file) => file !== typeFile)
      .filter((file) => /testimonial/.test(sourceFor(file)) && /programme/i.test(sourceFor(file)));

    expect(offenders).toEqual([]);
  });

  test('no Link/Button nest as interactive-in-interactive markup, in either direction', () => {
    // A next/link <Link> always renders <a>; components/ui/button.tsx's <Button> renders a
    // real <button> unless given `asChild` (in which case it merges its props onto its single
    // child via Radix Slot instead of rendering its own element).
    //
    // Two invalid forms, both checked here:
    //   1. <Link><Button /></Link> without asChild on the Button -> <a><button>...</button></a>.
    //      Established fix: invert to <Button asChild><Link>...</Link></Button>.
    //   2. <Button>...<Link/>...</Button> without asChild on the Button, even with intermediate
    //      non-Link/Button elements (e.g. wrapper <div>s) in between -> <button>...<a>...</a>...
    //      </button>. Same fix: give the Button `asChild` and make the Link its single child
    //      wrapping the full content. This form was found real in
    //      app/dashboard/assistante/page.tsx (a "Validation Paiements" card whose outer Button
    //      had no asChild and no onClick, wrapping a Link two <div>s deep -- both an HTML
    //      validity bug and a UX mismatch, since only the inner text was actually clickable
    //      despite the whole card being styled to look like one control).
    //
    // The tag-stack walk below only matches Link/Button tags (see tagRe) -- it does not push
    // intermediate tags (e.g. <div>) onto the stack, so an ancestor check here already reaches
    // through any number of non-Link/Button wrapper elements for both directions above.
    //
    // Note: no `s` (dotAll) flag needed/used -- [^>] already matches across
    // newlines regardless, and this repo's tsconfig targets es2017 (< es2018,
    // which is required for the `s` flag and raises TS1501 if used).
    const tagRe = /<(\/)?(Link|Button)\b([^>]*?)(\/)?>/g;

    const offenders: string[] = [];
    for (const file of ['app', 'components'].flatMap(listFiles)) {
      if (!file.endsWith('.tsx')) continue;
      const src = sourceFor(file);
      if (!/\bLink\b/.test(src) || !/\bButton\b/.test(src)) continue;

      const stack: Array<{ name: string; hasAsChild: boolean }> = [];
      let match: RegExpExecArray | null;
      tagRe.lastIndex = 0;
      while ((match = tagRe.exec(src))) {
        const [, isClose, name, attrs, isSelfClose] = match;
        if (isClose) {
          for (let i = stack.length - 1; i >= 0; i -= 1) {
            if (stack[i].name === name) {
              stack.splice(i, 1);
              break;
            }
          }
          continue;
        }
        if (
          name === 'Button' &&
          !/\basChild\b/.test(attrs) &&
          stack.some((ancestor) => ancestor.name === 'Link')
        ) {
          offenders.push(file); // form 1: Link wraps non-asChild Button
        }
        if (
          name === 'Link' &&
          stack.some((ancestor) => ancestor.name === 'Button' && !ancestor.hasAsChild)
        ) {
          offenders.push(file); // form 2: non-asChild Button wraps Link (any depth)
        }
        if (!isSelfClose) stack.push({ name, hasAsChild: /\basChild\b/.test(attrs) });
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });
});
