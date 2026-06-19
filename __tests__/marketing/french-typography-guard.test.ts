import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

/** Files with user-visible French strings on luxury pages. */
const luxuryFiles = [
  'app/HomePageClient.tsx',
  'app/offres/page.tsx',
  'app/bilan-gratuit/BilanStrategiqueClient.tsx',
  'app/contact/page.tsx',
  'app/accompagnement-scolaire/page.tsx',
  'app/stages/Stages2026Page.tsx',
  'app/plateforme-aria/page.tsx',
  'app/notre-centre/page.tsx',
  'app/ressources/page.tsx',
  'app/recommandation/RecommandationClient.tsx',
  'components/marketing/acadomia-inspired.tsx',
  'components/marketing/OfferDetailDialog.tsx',
  'components/marketing/MobileStickyBar.tsx',
  'components/premium/HeroSection.tsx',
  'components/premium/ForWhoSection.tsx',
  'components/sections/offers-preview-section.tsx',
  'components/layout/CorporateFooter.tsx',
];

/**
 * Extract user-visible string literals from TSX files.
 * Matches: `...`, '...', "..." (template, single, double-quoted strings)
 * Excludes: import paths, className, href, src, id attributes.
 */
function extractVisibleStrings(source: string): string[] {
  const strings: string[] = [];
  // Match template literals and string literals containing French text
  const regex = /[`'"]([^`'"]{10,})[`'"]/g;
  let m;
  while ((m = regex.exec(source)) !== null) {
    const s = m[1];
    // Skip non-French / non-visible patterns
    if (/^(\/|@\/|http|#|\.\/|__|\{|import|className|href=|src=|id=|data-|aria-)/.test(s)) continue;
    if (!/[àâéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ]/.test(s)) continue; // Must contain French chars
    strings.push(s);
  }
  return strings;
}

describe('French typography guard — luxury pages', () => {
  it('no straight apostrophe (\\\') between letters in user-visible French strings', () => {
    const violations: string[] = [];
    for (const file of luxuryFiles) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, 'utf8');
      const strings = extractVisibleStrings(source);
      for (const s of strings) {
        // Straight apostrophe between word chars = violation
        if (/\w'\w/.test(s)) {
          violations.push(`${file}: "${s.substring(0, 60)}..."`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no regular space before high punctuation in pure-text French strings', () => {
    const violations: string[] = [];
    for (const file of luxuryFiles) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, 'utf8');
      const strings = extractVisibleStrings(source);
      for (const s of strings) {
        // Skip strings containing JSX/HTML/code patterns
        if (/<|>|\{|className|href|src|onClick|import/.test(s)) continue;
        // Regular space (not NBSP) before : ; ! ? = violation
        // Exclude URLs (http:) and time formats (10:00) and // comments
        if (/ [:;!?]/.test(s) && !/https?:/.test(s) && !/\d:\d/.test(s) && !/\/\//.test(s)) {
          violations.push(`${file}: "${s.substring(0, 60)}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
