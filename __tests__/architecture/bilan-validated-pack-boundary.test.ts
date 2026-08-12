import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOWED_PRODUCTION_FILES = new Set([
  'lib/bilans/catalog/load-pack.ts',
  'lib/bilans/validators/contracts.ts',
]);

/**
 * Balayage sur les fichiers SUIVIS PAR GIT uniquement (`git ls-files`) :
 * un invariant de dépôt ne doit pas échouer sur une machine à cause de
 * worktrees locaux ou d'artefacts de build non versionnés — ce qui n'est
 * pas commité ne peut pas être livré.
 */
function listTrackedTypeScriptFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((entry) => entry.length > 0);
}

describe('ValidatedPack construction boundary', () => {
  it('allows production construction only through the fail-closed pack loader', () => {
    const violations: string[] = [];
    let loaderConstructionCalls = 0;
    const trackedFiles = listTrackedTypeScriptFiles();
    expect(trackedFiles.length).toBeGreaterThan(100);

    for (const relativePath of trackedFiles) {
      if (relativePath.startsWith('__tests__/')) continue;
      const absolutePath = path.join(ROOT, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

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
