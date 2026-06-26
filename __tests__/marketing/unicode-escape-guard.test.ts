import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

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

    // Resolve globs
    const files: string[] = [];
    for (const glob of publicGlobs) {
      try {
        const result = execSync(`find ${join(root, glob.replace(/\*/g, ''))} -name "*.tsx" 2>/dev/null || true`, { encoding: 'utf-8' });
        if (glob.includes('*')) {
          result.trim().split('\n').filter(Boolean).forEach((f) => files.push(f));
        } else {
          const fullPath = join(root, glob);
          files.push(fullPath);
        }
      } catch {
        // File may not exist
      }
    }

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
      } catch {
        // File doesn't exist — skip
      }
    }

    expect(offenders).toEqual([]);
  });
});
