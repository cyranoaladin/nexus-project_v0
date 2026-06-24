import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

import { LEGAL, compactBankIdentifier } from '@/lib/legal';

const root = process.cwd();
const siteMapPath = join(root, 'docs/architecture/SITE_MAP.md');
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
  const section = siteMap.split('## Liens morts / ancres a verifier')[1]?.split('## Orphelines publiques')[0] ?? '';
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
  execFileSync('node', ['scripts/audit/site-map.mjs'], { cwd: root, stdio: 'pipe' });
});

describe('architecture diagnostic guardrails', () => {
  test('site-map audit keeps every current public orphan classified', () => {
    const siteMap = sourceFor('docs/architecture/SITE_MAP.md');
    const orphanSection = siteMap.split('## Orphelines publiques')[1]?.split('## Routes publiques surveillees')[0] ?? '';
    expect(orphanSection).not.toContain('non classee');
  });

  test('link-integrity findings are limited to the diagnosed allowlist', () => {
    const siteMap = sourceFor('docs/architecture/SITE_MAP.md');
    const expected = [
      // NPC dashboards still redirect to the old /auth/login alias; diagnosis only in this lot.
      '/dashboard/coach/npc -> /auth/login (app/dashboard/coach/npc/page.tsx)',
      '/dashboard/coach/npc/reports/[reportId] -> /auth/login (app/dashboard/coach/npc/reports/[reportId]/page.tsx)',
      '/dashboard/coach/npc/submissions/[submissionId]/upload -> /auth/login (app/dashboard/coach/npc/submissions/[submissionId]/upload/page.tsx)',
      '/dashboard/eleve/npc -> /auth/login (app/dashboard/eleve/npc/page.tsx)',
      '/dashboard/parent/npc -> /auth/login (app/dashboard/parent/npc/page.tsx)',
      // Dashboard hash anchors are referenced by redirects/navigation but not rendered as literal ids today.
      '/dashboard/eleve/ressources -> /dashboard/eleve#resources (app/dashboard/eleve/ressources/page.tsx)',
      '/dashboard/trajectoire -> /dashboard/eleve#trajectory (app/dashboard/trajectoire/page.tsx)',
      'shared -> /dashboard/eleve#aria (components/navigation/navigation-config.ts)',
      'shared -> /dashboard/eleve#programme-maths (components/navigation/navigation-config.ts)',
      'shared -> /dashboard/eleve#resources (components/navigation/navigation-config.ts)',
      'shared -> /dashboard/eleve#survival (lib/dashboard/student-payload.ts)',
      // Public/stage anchors and legacy section components remain documented, not mass-fixed here.
      '/stages -> #reservation (app/stages/_components/StagesHeader.tsx)',
      'shared -> #contact (components/sections/korrigo-showcase.tsx)',
      'shared -> #etablissements (components/sections/problem-solution-section.tsx)',
      'shared -> #formation_tech (components/sections/problem-solution-section.tsx)',
      'shared -> #methodologie (components/sections/home-hero.tsx)',
      'shared -> #parents_eleves (components/sections/problem-solution-section.tsx)',
    ].sort();

    expect(extractLinkFindingKeys(siteMap)).toEqual(expected);
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

  test('root ROADMAP status is explicitly surfaced in the generated architecture audit', () => {
    const siteMap = sourceFor('docs/architecture/SITE_MAP.md');
    expect(siteMap).toContain('ROADMAP.md present au root');
  });
});
