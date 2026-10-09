import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Guard: no literal \u00xx Unicode escapes in JSX of public surface files.
 * These render as literal text in the HTML instead of the intended character.
 * Use real UTF-8 characters instead.
 */
describe('Unicode escape guard', () => {
  test('no literal \\u00xx escapes in public surface JSX files', () => {
    const root = process.cwd();

    // All public .tsx files (pages + components used on public routes)
    const publicGlobs = [
      'app/page.tsx',
      'app/HomePageClient.tsx',
      'app/famille/page.tsx',
      'app/offres/page.tsx',
      'app/stages/Stages2026Page.tsx',
      'app/stages/[stageSlug]/page.tsx',
      'app/stages/[stageSlug]/inscription/page.tsx',
      'app/stages/_components/*.tsx',
      'app/accompagnement-scolaire/page.tsx',
      'app/mentions-legales/page.tsx',
      'app/conditions-generales/page.tsx',
      'app/politique-confidentialite/page.tsx',
      'app/auth/signin/page.tsx',
      'app/auth/signin/SignInForm.tsx',
      'app/auth/activate/page.tsx',
      'app/auth/reset-password/page.tsx',
      'app/auth/mot-de-passe-oublie/page.tsx',
      'app/access-required/page.tsx',
      'app/notre-centre/page.tsx',
      'app/equipe/page.tsx',
      'app/contact/page.tsx',
      'app/recommandation/page.tsx',
      'app/bilan-gratuit/page.tsx',
      'app/ressources/page.tsx',
      'components/layout/CorporateNavbar.tsx',
      'components/layout/CorporateFooter.tsx',
      'components/stages/PublicStageCard.tsx',
      'components/stages/StageInscriptionForm.tsx',
    ];

    // Resolve the supported literal paths and directory/*.tsx patterns without
    // a shell. Missing historical pages may be absent; other I/O errors fail.
    const files: string[] = [];
    for (const glob of publicGlobs) {
      if (!glob.includes('*')) {
        files.push(join(root, glob));
        continue;
      }
      expect(glob.endsWith('/*.tsx')).toBe(true);
      const directory = join(root, dirname(glob));
      try {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.tsx')) files.push(join(directory, entry.name));
        }
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }

    // The wildcard must contribute real files; otherwise this guard silently
    // misses the public stage components it claims to inspect.
    expect(files).toContain(join(root, 'app/stages/_components/CTAButton.tsx'));

    const escapePattern = /\\u00[0-9a-fA-F]{2}/;
    const offenders: string[] = [];

    for (const fullPath of files) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (escapePattern.test(lines[i])) {
            const relPath = fullPath.replace(root + '/', '');
            offenders.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
          }
        }
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }

    expect(offenders).toEqual([]);
  });
});

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
