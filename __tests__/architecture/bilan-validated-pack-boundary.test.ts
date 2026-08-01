import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOWED_PRODUCTION_FILES = new Set([
  'lib/bilans/catalog/load-pack.ts',
  'lib/bilans/validators/contracts.ts',
]);
const SKIPPED_DIRECTORIES = new Set(['.git', '.next', 'node_modules']);

function listTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolutePath);
    return /\.[cm]?tsx?$/.test(entry.name) ? [absolutePath] : [];
  });
}

describe('ValidatedPack construction boundary', () => {
  it('allows production construction only through the fail-closed pack loader', () => {
    const violations: string[] = [];
    let loaderConstructionCalls = 0;

    for (const absolutePath of listTypeScriptFiles(ROOT)) {
      const relativePath = path.relative(ROOT, absolutePath).replaceAll(path.sep, '/');
      if (relativePath.startsWith('__tests__/')) continue;

      const source = fs.readFileSync(absolutePath, 'utf8');
      const callsConstructor = /(?<!function\s)\bbuildValidatedPack\s*\(/.test(source);
      const fabricatesBrand = /\bas\s+ValidatedPack\b|\bsatisfies\s+ValidatedPack\b|:\s*ValidatedPack\s*=/.test(source);

      if (relativePath === 'lib/bilans/catalog/load-pack.ts' && callsConstructor) {
        loaderConstructionCalls += 1;
      }
      if ((callsConstructor || fabricatesBrand) && !ALLOWED_PRODUCTION_FILES.has(relativePath)) {
        violations.push(relativePath);
      }
      if (/fixture-non-publiable-v0|__tests__\/bilans\/fixtures\/validated-pack/.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
    expect(loaderConstructionCalls).toBe(1);
  });
});
