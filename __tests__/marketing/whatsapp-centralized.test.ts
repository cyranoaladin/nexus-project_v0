/**
 * Guardrail: no wa.me/ literal should appear outside lib/whatsapp.ts.
 *
 * This prevents drift back to hardcoded WhatsApp numbers scattered
 * across components and pages.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** Recursively collect .ts/.tsx files, skipping node_modules, .next, static HTML, tests, and dist. */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '.git', '__tests__', 'e2e', 'src/static-pages'].includes(entry.name)) continue;
      results.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('WhatsApp centralisation guardrail', () => {
  const ALLOWED_FILE = path.join(ROOT, 'lib/whatsapp.ts');
  const files = collectFiles(ROOT);
  const WA_ME_PATTERN = /wa\.me\//;

  it('no wa.me/ literal outside lib/whatsapp.ts', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file === ALLOWED_FILE) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (WA_ME_PATTERN.test(content)) {
        const rel = path.relative(ROOT, file);
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
