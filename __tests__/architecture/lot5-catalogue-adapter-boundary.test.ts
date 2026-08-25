import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the Lot 5 sequencing decision (docs/candidat-individuel/
 * lot5-catalogue-brainstorming.md Décision 1 + §4): the catalogue/adapter
 * is built this lot but NOT wired into the public wizard or its APIs yet —
 * that rewiring is a separate, explicitly announced lot. This test fails
 * loudly the moment someone wires it in without updating/removing this
 * guard, so the adapter's transitional nature (one-way, retirement
 * condition tied to that future lot) can never silently calcify into a
 * second permanent recommendation engine.
 */

const root = process.cwd();

function listFilesRecursive(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full, exts));
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

describe('Lot 5 catalogue adapter — architecture boundary', () => {
  test('no file under app/ or components/ imports lib/quotes/catalogue or lib/quotes/pricing-engine yet (Phase A stays unwired this lot)', () => {
    const candidateFiles = [
      ...listFilesRecursive(join(root, 'app'), ['.ts', '.tsx']),
      ...listFilesRecursive(join(root, 'components'), ['.ts', '.tsx']),
    ];
    const offenders = candidateFiles.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return (
        content.includes("from '@/lib/quotes/catalogue'") ||
        content.includes('from "@/lib/quotes/catalogue"') ||
        content.includes("from '@/lib/quotes/pricing-engine'") ||
        content.includes('from "@/lib/quotes/pricing-engine"')
      );
    });
    expect(offenders).toEqual([]);
  });

  test('the adapter and pricing engine never import from app/ or components/ (one-way: carte-aware -> legacy shape, never the reverse)', () => {
    for (const file of ['lib/quotes/catalogue.ts', 'lib/quotes/pricing-engine.ts']) {
      const content = readFileSync(join(root, file), 'utf8');
      expect(content).not.toMatch(/from ['"]@\/app\//);
      expect(content).not.toMatch(/from ['"]@\/components\//);
    }
  });

  test('no second parallel namespace lib/tarification/ exists (mission §4 — single canonical catalogue)', () => {
    expect(existsSync(join(root, 'lib/tarification'))).toBe(false);
  });

  test('the catalogue data lives only in data/pricing.canonical.json — no second candidate_individuel_catalogue JSON file exists', () => {
    const dataFiles = listFilesRecursive(join(root, 'data'), ['.json']).filter(
      (f) => f !== join(root, 'data/pricing.canonical.json') && f !== join(root, 'data/pricing-client-data.generated.json'),
    );
    const offenders = dataFiles.filter((f) => readFileSync(f, 'utf8').includes('candidat_individuel_catalogue'));
    expect(offenders).toEqual([]);
  });
});
