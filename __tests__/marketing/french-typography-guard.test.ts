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
  'app/equipe/page.tsx',
  'components/marketing/acadomia-inspired.tsx',
  'components/marketing/OfferDetailDialog.tsx',
  'components/marketing/MobileStickyBar.tsx',
  'components/premium/HeroSection.tsx',
  'components/premium/ForWhoSection.tsx',
  'components/layout/CorporateFooter.tsx',
];

/**
 * Strip template literal interpolations: `${expr}` → `` (empty).
 * This lets us check the French text portions of template strings
 * without false positives from JS code inside `${...}`.
 */
function stripInterpolations(s: string): string {
  // Handle nested braces by iterating
  let result = s;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(/\$\{[^{}]*\}/g, '');
  }
  return result;
}

/**
 * Extract user-visible French string literals from TSX source.
 *
 * Scans each line for single-quoted, double-quoted AND backtick strings.
 * For backtick strings, `${…}` interpolations are stripped before analysis.
 * Strings must be ≥10 chars and contain French-specific characters.
 */
function extractVisibleStrings(source: string): { line: number; text: string }[] {
  const results: { line: number; text: string }[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trim();

    // Skip non-content lines
    if (/^import\s/.test(trimmed)) continue;
    if (/^\/\//.test(trimmed)) continue;
    if (/^\*/.test(trimmed)) continue;
    if (/^className[=:]/.test(trimmed)) continue;

    // Extract single/double quoted strings
    const sdRegex = /(?:["'])([^"']{10,})(?:["'])/g;
    let m;
    while ((m = sdRegex.exec(ln)) !== null) {
      const s = m[1];
      if (/^(\/|@\/|http|#|\.\/|__|\.\.)/.test(s)) continue;
      if (/(?:className|href|src|id|data-|aria-|key|name|type|role|placeholder)\s*=\s*$/.test(ln.substring(0, m.index))) continue;
      if (!/[àâéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ\u2019]/.test(s)) continue;
      results.push({ line: i + 1, text: s });
    }

    // Extract backtick template literals (single-line only)
    const btRegex = /`([^`]{10,})`/g;
    while ((m = btRegex.exec(ln)) !== null) {
      const raw = m[1];
      const s = stripInterpolations(raw);
      if (s.length < 10) continue;
      if (/^(\/|@\/|http|#|\.\/|__|\.\.)/.test(s)) continue;
      if (/(?:className|href|src|id|data-|aria-|key|name|type|role|placeholder)\s*=\s*$/.test(ln.substring(0, m.index))) continue;
      if (!/[àâéèêëîïôùûüçÀÂÉÈÊËÎÏÔÙÛÜÇ\u2019]/.test(s)) continue;
      results.push({ line: i + 1, text: s });
    }
  }

  return results;
}

describe('French typography guard — luxury pages', () => {
  it('no straight apostrophe (\\\') between letters in user-visible French strings', () => {
    const violations: string[] = [];
    for (const file of luxuryFiles) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, 'utf8');
      const strings = extractVisibleStrings(source);
      for (const { line, text } of strings) {
        if (/\w'\w/.test(text)) {
          violations.push(`${file}:${line}: "${text.substring(0, 60)}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no regular space before high punctuation in user-visible French strings', () => {
    const violations: string[] = [];
    for (const file of luxuryFiles) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, 'utf8');
      const strings = extractVisibleStrings(source);
      for (const { line, text } of strings) {
        if (/ [:;!?]/.test(text) && !/https?:/.test(text) && !/\d:\d/.test(text) && !/\/\//.test(text)) {
          violations.push(`${file}:${line}: "${text.substring(0, 60)}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
