import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

describe('Lot A closure decisions', () => {
  test('/corrige_dnb_maths_2026 is removed from the app surface and redirected to /ressources', () => {
    expect(existsSync(join(root, 'app/corrige_dnb_maths_2026/page.tsx'))).toBe(false);
    expect(sourceFor('app/sitemap.ts')).not.toContain('/corrige_dnb_maths_2026');

    const nextConfig = sourceFor('next.config.mjs');
    expect(nextConfig).toContain("source: '/corrige_dnb_maths_2026'");
    expect(nextConfig).toContain("destination: '/ressources'");
    expect(nextConfig).toContain('statusCode: 301');
  });

  test('/ressources is an assumed public hub linked from navigation and footer', () => {
    expect(sourceFor('components/layout/CorporateNavbar.tsx')).toContain("href: '/ressources'");
    expect(sourceFor('components/layout/CorporateFooter.tsx')).toContain("href: '/ressources'");
    expect(sourceFor('app/sitemap.ts')).toContain('/ressources');
  });

  test('/notre-centre remains public, linked from footer, and uses the legal pedagogical address source', () => {
    const page = sourceFor('app/notre-centre/page.tsx');

    expect(sourceFor('components/layout/CorporateFooter.tsx')).toContain("href: '/notre-centre'");
    expect(sourceFor('app/sitemap.ts')).toContain('/notre-centre');
    expect(page).toContain('LEGAL.addresses.pedagogique');
    expect(page).not.toContain("const PEDA_ADDRESS = 'Mutuelleville, Tunis'");
  });

  test('temporary access or student-only routes declare explicit noindex metadata', () => {
    const routeMetadataFiles = [
      ['app/access-required/page.tsx'],
      ['app/bilan-gratuit/assessment/page.tsx', 'app/bilan-gratuit/assessment/layout.tsx'],
      ['app/bilan-gratuit/confirmation/layout.tsx'],
      ['app/lamis/page.tsx'],
      ['app/programme/maths-1ere-stmg/page.tsx'],
      ['app/programme/maths-terminale/page.tsx'],
    ];

    const offenders = routeMetadataFiles.filter((files) => {
      return !files.some((file) => {
        const source = sourceFor(file);
        return /robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false[\s\S]*\}/m.test(source);
      });
    });

    expect(offenders).toEqual([]);
  });

  test('dashboard hash routing maps each anchor to the rubrique where the target is mounted', () => {
    const source = sourceFor('app/dashboard/eleve/page.tsx');
    const expected = [
      { hash: 'aria', rubrique: 'cockpit' },
      { hash: 'trajectory', rubrique: 'parcours' },
      { hash: 'programme-maths', rubrique: 'parcours' },
      { hash: 'survival', rubrique: 'parcours' },
      { hash: 'resources', rubrique: 'matières' },
    ];

    for (const { hash, rubrique } of expected) {
      expect(source).toMatch(new RegExp(`${hash === 'programme-maths' ? "'programme-maths'" : hash}:\\s*'${rubrique}'`));
      expect(source).toMatch(new RegExp(`activeRubrique === '${rubrique}'[\\s\\S]*id="${hash}"`));
    }
  });
});
