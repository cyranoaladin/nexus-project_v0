import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

import { LEGAL } from '@/lib/legal';

const root = process.cwd();
const scanRoots = ['app', 'components', 'lib'];
const scannedExtensions = new Set(['.ts', '.tsx']);
const excludedDirectories = new Set(['.next', 'node_modules']);

function sourceFor(file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

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

function filesContaining(pattern: RegExp): string[] {
  return scanRoots
    .flatMap(listScannedFiles)
    .filter((file, index, allFiles) => allFiles.indexOf(file) === index)
    .filter((file) => pattern.test(sourceFor(file)));
}

describe('centralized banking policy', () => {
  test('bank transfer identifiers have a single canonical source', () => {
    const billing = (LEGAL as unknown as { billing?: { rib: string; iban: string; bic: string } }).billing;

    expect(billing).toBeDefined();
    expect(billing?.rib).toMatch(/\d/);
    expect(billing?.iban).toMatch(/^TN/);
    expect(billing?.bic).toMatch(/^[A-Z0-9]+$/);

    const bankIdentifierPattern =
      /TN59\s*25\s*079\s*000\s*0001569084\s*04|RIB25079000000156908404|25\s*079\s*000\s*0001569084\s*04/;

    expect(filesContaining(bankIdentifierPattern)).toEqual(['lib/legal.ts']);
  });

  test('public legal and marketing pages do not expose bank account identifiers', () => {
    const publicFiles = [
      'app/conditions-generales/page.tsx',
      'app/mentions-legales/page.tsx',
      'app/offres/page.tsx',
      'app/page.tsx',
      'app/HomePageClient.tsx',
      'app/bilan-gratuit/page.tsx',
      'app/contact/page.tsx',
    ];

    for (const file of publicFiles) {
      const source = sourceFor(file);
      expect(source).not.toContain('LEGAL.billing');
      expect(source).not.toMatch(/TN59|RIB25079000000156908404|0001569084/);
    }
  });
});
